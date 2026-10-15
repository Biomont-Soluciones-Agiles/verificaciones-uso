#!/usr/bin/env node
// Copia el catálogo (vu_area + vu_solucion) y la configuración de la evaluación (vu_criterio,
// vu_pregunta, vu_opcionrespuesta) de un entorno a otro. Idempotente: busca por vu_name (y por su
// padre en preguntas y opciones); crea lo que falta y actualiza lo que existe.
//
// Uso:
//   node infra/dataverse/copiar-catalogo.mjs --destino https://orgXXXX.crm2.dynamics.com [--origen URL] [--dry-run]
//
// - Origen por defecto: el entorno de desarrollo de schema.json.
// - Áreas: todas las del origen (las soluciones las necesitan: vu_procesoid es obligatoria), con su
//   área padre y su estado activo/inactivo.
// - Soluciones: todas las columnas de vu_solucion en schema.json. El responsable se busca por correo
//   en el destino (los systemuserid cambian entre entornos); si no existe, queda vacío.
//   vu_ultimaverificacionid no se copia: las verificaciones no viajan con el catálogo.
// - Configuración: criterios (peso, orden, activo), solo las preguntas activas (criterio, tipo,
//   orden, obligatoria) y sus opciones de respuesta.
// - El destino debe tener la solución VerificacionUso importada (verify.mjs --org <destino>).
import { schema, createClient, log, warn, q } from './lib.mjs';

// ---------------------------------------------------------------- argumentos
const argv = process.argv.slice(2);
const valor = (flag) => {
  const i = argv.indexOf(flag);
  return i < 0 ? undefined : argv[i + 1];
};
const DRY = argv.includes('--dry-run');
const ORIGEN = (valor('--origen') ?? schema.environment.url).replace(/\/+$/, '');
const DESTINO = valor('--destino')?.replace(/\/+$/, '');
if (!DESTINO) {
  console.error('Falta --destino <URL del entorno>');
  process.exit(2);
}
if (DESTINO === ORIGEN) {
  console.error('El destino no puede ser el mismo entorno que el origen.');
  process.exit(2);
}
const origen = createClient(ORIGEN);
const destino = createClient(DESTINO);
const stats = { creados: 0, actualizados: 0, sinCambios: 0 };

// ---------------------------------------------------------------- metadatos de schema.json
const T = Object.fromEntries(schema.tables.map((t) => [t.logicalName, t]));
const set = (l) => T[l].entitySetName;
const col = (tabla, logical) => T[tabla].columns.find((c) => c.logicalName === logical);
const bind = (tabla, lookup, destinoTabla, id) => ({ [col(tabla, lookup).odataBind]: `/${destinoTabla}(${id})` });
const ESCALARES = T.vu_solucion.columns.filter((c) => c.type !== 'Lookup').map((c) => c.logicalName);

const todas = (cliente, path) => cliente.getAll(path);

async function crear(cliente, tabla, cuerpo, que) {
  stats.creados++;
  if (DRY) {
    log(`[dry-run] crearía ${que}`);
    return `dry-${stats.creados}`;
  }
  const res = await cliente.request('POST', set(tabla), cuerpo);
  log(`[creado]  ${que}`);
  return cliente.idFromHeaders(res.headers);
}

async function actualizar(cliente, tabla, id, cuerpo, que) {
  stats.actualizados++;
  if (DRY) return log(`[dry-run] actualizaría ${que}`);
  await cliente.request('PATCH', `${set(tabla)}(${id})`, cuerpo);
  log(`[actual.] ${que}`);
}

// ---------------------------------------------------------------- áreas
async function copiarAreas() {
  const areas = await todas(origen, `${set('vu_area')}?$select=vu_areaid,vu_name,vu_tipoarea,_vu_areapadreid_value,statecode`);
  const nombrePorId = new Map(areas.map((a) => [a.vu_areaid, a.vu_name]));
  const existentes = new Map(
    (await todas(destino, `${set('vu_area')}?$select=vu_areaid,vu_name`)).map((a) => [a.vu_name, a.vu_areaid]),
  );
  // Padres antes que hijas.
  const pendientes = [...areas];
  const ordenadas = [];
  while (pendientes.length) {
    const i = pendientes.findIndex(
      (a) => !a._vu_areapadreid_value || ordenadas.some((o) => o.vu_areaid === a._vu_areapadreid_value),
    );
    ordenadas.push(...pendientes.splice(i < 0 ? 0 : i, 1));
  }
  const idDestino = new Map(); // nombre -> id en destino
  for (const a of ordenadas) {
    const padre = a._vu_areapadreid_value ? idDestino.get(nombrePorId.get(a._vu_areapadreid_value)) : null;
    const previo = existentes.get(a.vu_name);
    if (previo) {
      idDestino.set(a.vu_name, previo);
      stats.sinCambios++;
      continue;
    }
    const id = await crear(
      destino,
      'vu_area',
      { vu_name: a.vu_name, vu_tipoarea: a.vu_tipoarea, ...(padre ? bind('vu_area', 'vu_areapadreid', set('vu_area'), padre) : {}) },
      `área "${a.vu_name}"`,
    );
    idDestino.set(a.vu_name, id);
    if (a.statecode === 1 && !DRY) await destino.request('PATCH', `${set('vu_area')}(${id})`, { statecode: 1, statuscode: 2 });
  }
  return { idDestino, nombrePorId };
}

// ---------------------------------------------------------------- responsables (por correo)
async function mapaResponsables(soluciones) {
  const ids = [...new Set(soluciones.map((s) => s._vu_responsableid_value).filter(Boolean))];
  const mapa = new Map();
  for (const id of ids) {
    const u = await origen.get(`systemusers(${id})?$select=internalemailaddress,domainname,fullname`);
    const correo = u.internalemailaddress || u.domainname;
    const [enDestino] = correo
      ? (
          await destino.get(
            `systemusers?$select=systemuserid&$filter=internalemailaddress eq '${q(correo)}' or domainname eq '${q(correo)}'&$top=1`,
          )
        ).value
      : [];
    if (enDestino) mapa.set(id, enDestino.systemuserid);
    else warn(`${u.fullname} <${correo}> no existe en el destino: sus soluciones quedan sin responsable`);
  }
  return mapa;
}

// ---------------------------------------------------------------- soluciones
async function copiarSoluciones({ idDestino, nombrePorId }) {
  const soluciones = await todas(
    origen,
    `${set('vu_solucion')}?$select=${['vu_name', ...ESCALARES, '_vu_procesoid_value', '_vu_responsableid_value'].join(',')}`,
  );
  const responsables = await mapaResponsables(soluciones);
  const existentes = new Map(
    (await todas(destino, `${set('vu_solucion')}?$select=vu_solucionid,vu_name`)).map((s) => [s.vu_name, s.vu_solucionid]),
  );
  for (const s of soluciones) {
    const area = idDestino.get(nombrePorId.get(s._vu_procesoid_value));
    if (!area) {
      warn(`"${s.vu_name}": su área no se pudo copiar; se omite`);
      continue;
    }
    const responsable = s._vu_responsableid_value ? responsables.get(s._vu_responsableid_value) : null;
    const previo = existentes.get(s.vu_name);
    const cuerpo = {
      vu_name: s.vu_name,
      ...Object.fromEntries(ESCALARES.filter((c) => !(previo === undefined && s[c] === null)).map((c) => [c, s[c]])),
      ...bind('vu_solucion', 'vu_procesoid', set('vu_area'), area),
      ...(responsable ? bind('vu_solucion', 'vu_responsableid', 'systemusers', responsable) : {}),
    };
    if (previo) await actualizar(destino, 'vu_solucion', previo, cuerpo, `solución "${s.vu_name}"`);
    else await crear(destino, 'vu_solucion', cuerpo, `solución "${s.vu_name}"`);
  }
  return soluciones.length;
}

// ---------------------------------------------------------------- configuración de la evaluación
async function copiarConfiguracion() {
  const criterios = await todas(origen, `${set('vu_criterio')}?$select=vu_criterioid,vu_name,vu_peso,vu_orden,statecode`);
  const criteriosDestino = new Map(
    (await todas(destino, `${set('vu_criterio')}?$select=vu_criterioid,vu_name`)).map((c) => [c.vu_name, c.vu_criterioid]),
  );
  const criterioDestino = new Map(); // id origen -> id destino
  for (const c of criterios) {
    const cuerpo = { vu_name: c.vu_name, vu_peso: c.vu_peso, vu_orden: c.vu_orden };
    const previo = criteriosDestino.get(c.vu_name);
    const id = previo ?? (await crear(destino, 'vu_criterio', cuerpo, `criterio "${c.vu_name}" (${c.vu_peso})`));
    if (previo) await actualizar(destino, 'vu_criterio', previo, cuerpo, `criterio "${c.vu_name}" (${c.vu_peso})`);
    if (!DRY) await destino.request('PATCH', `${set('vu_criterio')}(${id})`, c.statecode === 1 ? { statecode: 1, statuscode: 2 } : { statecode: 0, statuscode: 1 });
    criterioDestino.set(c.vu_criterioid, id);
  }

  const preguntas = await todas(
    origen,
    `${set('vu_pregunta')}?$select=vu_preguntaid,vu_name,_vu_criterioid_value,vu_tiporespuesta,vu_orden,vu_obligatoria&$filter=statecode eq 0`,
  );
  const preguntasDestino = await todas(destino, `${set('vu_pregunta')}?$select=vu_preguntaid,vu_name,_vu_criterioid_value`);
  for (const pr of preguntas) {
    const criterio = criterioDestino.get(pr._vu_criterioid_value);
    const cuerpo = {
      vu_name: pr.vu_name,
      vu_tiporespuesta: pr.vu_tiporespuesta,
      vu_orden: pr.vu_orden,
      vu_obligatoria: pr.vu_obligatoria ?? true,
      ...bind('vu_pregunta', 'vu_criterioid', set('vu_criterio'), criterio),
    };
    const previa = preguntasDestino.find((x) => x.vu_name === pr.vu_name && x._vu_criterioid_value === criterio);
    const que = `pregunta ${pr.vu_orden}${pr.vu_obligatoria === false ? ' (opcional)' : ''}: "${pr.vu_name}"`;
    const id = previa?.vu_preguntaid ?? (await crear(destino, 'vu_pregunta', cuerpo, que));
    if (previa) await actualizar(destino, 'vu_pregunta', previa.vu_preguntaid, cuerpo, que);

    const opciones = await todas(
      origen,
      `${set('vu_opcionrespuesta')}?$select=vu_name,vu_puntajesugerido,vu_orden&$filter=_vu_preguntaid_value eq ${pr.vu_preguntaid}`,
    );
    const opcionesDestino = String(id).startsWith('dry-')
      ? []
      : await todas(destino, `${set('vu_opcionrespuesta')}?$select=vu_opcionrespuestaid,vu_name&$filter=_vu_preguntaid_value eq ${id}`);
    for (const o of opciones) {
      const cuerpoOpcion = {
        vu_name: o.vu_name,
        vu_puntajesugerido: o.vu_puntajesugerido,
        vu_orden: o.vu_orden,
        ...bind('vu_opcionrespuesta', 'vu_preguntaid', set('vu_pregunta'), id),
      };
      const previaOpcion = opcionesDestino.find((x) => x.vu_name === o.vu_name);
      if (previaOpcion) await actualizar(destino, 'vu_opcionrespuesta', previaOpcion.vu_opcionrespuestaid, cuerpoOpcion, `  opción "${o.vu_name}"`);
      else await crear(destino, 'vu_opcionrespuesta', cuerpoOpcion, `  opción "${o.vu_name}"`);
    }
  }
  return { criterios: criterios.length, preguntas: preguntas.length };
}

// ---------------------------------------------------------------- main
(async () => {
  log(`Origen: ${ORIGEN} → destino: ${DESTINO}${DRY ? '  (DRY-RUN)' : ''}`);
  const areas = await copiarAreas();
  const total = await copiarSoluciones(areas);
  const config = await copiarConfiguracion();
  log(
    `Resumen: ${total} soluciones · ${config.criterios} criterios · ${config.preguntas} preguntas activas · ` +
      `creados ${stats.creados} · actualizados ${stats.actualizados} · áreas que ya existían ${stats.sinCambios}`,
  );
})().catch((e) => {
  console.error('\nERROR:', e.message);
  if (e.body?.error) console.error(JSON.stringify(e.body.error, null, 2).slice(0, 2000));
  process.exit(1);
});
