#!/usr/bin/env node
// Importa el catálogo real de soluciones desde la lista SharePoint "Apps" (exportada a Excel y
// convertida con tools/apps_xlsx_a_json.py). Idempotente: busca por vu_name antes de crear.
//
// Uso:
//   node infra/dataverse/importar-apps.mjs --file apps.json [--reemplazar] [--dry-run] [--org URL]
//
// --reemplazar  borra antes el catálogo de ejemplo de seed/ (soluciones de seed/soluciones.json con sus
//               documentos y verificaciones, y las áreas de seed/areas.json que dejen de usarse).
// Las VU marcadas "Realizada" en la lista se crean como vu_verificacion Aprobada con sus 4 puntajes.
import { readFileSync } from 'node:fs';
import { schema, parseArgs, createClient, log, warn, readJson, q } from './lib.mjs';

// ---------------------------------------------------------------- argumentos
const argv = process.argv.slice(2);
const take = (flag) => { const i = argv.indexOf(flag); if (i < 0) return undefined; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const flag = (f) => { const i = argv.indexOf(f); if (i < 0) return false; argv.splice(i, 1); return true; };
const file = take('--file');
const REEMPLAZAR = flag('--reemplazar');
const args = parseArgs(argv);
if (!file) { console.error('Falta --file <apps.json>'); process.exit(2); }
const DRY = args.dryRun;
const api = createClient(args.org);
const stats = { creados: 0, actualizados: 0, borrados: 0, existentes: 0 };

// ---------------------------------------------------------------- metadatos de schema.json
const T = Object.fromEntries(schema.tables.map((t) => [t.logicalName, t]));
const set = (l) => T[l].entitySetName;
const pk = (l) => T[l].primaryIdAttribute;
const col = (table, logical) => T[table].columns.find((c) => c.logicalName === logical);
const bind = (table, lookup, target, id) => ({ [col(table, lookup).odataBind]: `/${set(target)}(${id})` });
/** Valor numérico de una opción local por su etiqueta (falla si no existe). */
function opcion(table, logical, etiqueta) {
  if (etiqueta == null) return undefined;
  const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  const o = col(table, logical).options.find((x) => norm(x.label) === norm(etiqueta));
  if (!o) throw new Error(`${table}.${logical}: valor "${etiqueta}" sin opción equivalente`);
  return o.value;
}
const global = (name, etiqueta) => schema.globalOptionSets.find((g) => g.name === name).options.find((o) => o.label === etiqueta).value;
const eqName = (n) => `vu_name eq '${q(n)}'`;
const sinIndefinidos = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

async function buscar(table, filter, select = pk(table)) {
  return (await api.get(`${set(table)}?$select=${select}&$filter=${filter}`)).value;
}
async function crear(table, body, what) {
  if (DRY) { log(`[dry-run] crearía ${what}`); stats.creados++; return `dry-${stats.creados}`; }
  const res = await api.request('POST', set(table), body);
  stats.creados++; log(`[creado]  ${what}`);
  return api.idFromHeaders(res.headers);
}
async function actualizar(table, id, body, what) {
  if (DRY) { log(`[dry-run] actualizaría ${what}`); stats.actualizados++; return; }
  await api.request('PATCH', `${set(table)}(${id})`, body);
  stats.actualizados++; log(`[actual.] ${what}`);
}
async function borrar(table, id, what) {
  if (DRY) { log(`[dry-run] BORRARÍA ${what}`); stats.borrados++; return; }
  await api.request('DELETE', `${set(table)}(${id})`);
  stats.borrados++; log(`[borrado] ${what}`);
}

// ---------------------------------------------------------------- reglas (§1.3)
const UMBRAL_PLENA = 85, UMBRAL_PARCIAL = 60;
const indice = (puntajes, pesos) => Math.round(Object.keys(pesos).reduce((s, c) => s + puntajes[c] * pesos[c], 0) / 10 * 10) / 10;
const resultado = (i) => (i >= UMBRAL_PLENA ? 'Adopción plena' : i >= UMBRAL_PARCIAL ? 'Adopción parcial' : 'Adopción baja');
const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }); // yyyy-MM-dd

// ---------------------------------------------------------------- 1) borrar el catálogo de ejemplo
async function reemplazarEjemplo(nombresImportados) {
  for (const s of readJson('seed/soluciones.json').soluciones) {
    if (nombresImportados.has(s.vu_name)) continue; // la lista real la reutiliza: se actualiza, no se borra
    for (const sol of await buscar('vu_solucion', eqName(s.vu_name))) {
      const id = sol[pk('vu_solucion')];
      // vu_verificacion → vu_solucion es Restrict: primero las verificaciones (cascada a sus hijas)
      for (const v of await buscar('vu_verificacion', `_vu_solucionid_value eq ${id}`, 'vu_verificacionid,vu_name')) {
        await borrar('vu_verificacion', v.vu_verificacionid, `verificación ${v.vu_name} (de ${s.vu_name}, con entrevistas, respuestas, evidencias, puntajes y aprobaciones)`);
      }
      await borrar('vu_solucion', id, `solución de ejemplo "${s.vu_name}" (con sus documentos)`);
    }
  }
}
async function limpiarAreasEjemplo(areasUsadas) {
  for (const a of [...readJson('seed/areas.json').areas].reverse()) { // hijas antes que padres
    if (areasUsadas.has(a.vu_name)) continue;
    for (const fila of await buscar('vu_area', eqName(a.vu_name))) {
      const id = fila.vu_areaid;
      const enUso = (await buscar('vu_solucion', `_vu_procesoid_value eq ${id}`)).length
        + (await buscar('vu_entrevista', `_vu_areaid_value eq ${id}`)).length;
      if (enUso && !DRY) { warn(`el área "${a.vu_name}" sigue en uso; no se borra`); continue; }
      await borrar('vu_area', id, `área de ejemplo "${a.vu_name}"`);
    }
  }
}

// ---------------------------------------------------------------- 2) importar
async function asegurarArea(nombre, cache) {
  if (cache[nombre]) return cache[nombre];
  const f = await buscar('vu_area', eqName(nombre));
  cache[nombre] = f.length ? f[0].vu_areaid
    : await crear('vu_area', { vu_name: nombre, vu_tipoarea: opcion('vu_area', 'vu_tipoarea', 'Área') }, `área "${nombre}"`);
  return cache[nombre];
}

function cuerpoSolucion(app, areaId) {
  return sinIndefinidos({
    vu_name: app.nombre,
    ...bind('vu_solucion', 'vu_procesoid', 'vu_area', areaId),
    vu_tipoproceso: opcion('vu_solucion', 'vu_tipoproceso', app.tipoProceso),
    vu_proveedor: app.proveedor,
    vu_tipodiseno: opcion('vu_solucion', 'vu_tipodiseno', app.tipoDiseno),
    vu_basedatos: opcion('vu_solucion', 'vu_basedatos', app.baseDatos),
    vu_tienedashboard: app.dashboard,
    vu_estadodesarrollo: opcion('vu_solucion', 'vu_estadodesarrollo', app.estadoDesarrollo),
    vu_evolucion: opcion('vu_solucion', 'vu_evolucion', app.evolucion),
    vu_beneficioanualpen: app.beneficioAnualPen,
    vu_capexpen: app.capexPen,
    vu_capexusd: app.capexUsd,
    vu_fechaimplementacion: app.fechaImplementacion,
    vu_resultadovu: opcion('vu_solucion', 'vu_resultadovu', app.resultadoVu),
    vu_proximavu: app.proximaVu,
    vu_periodicidadmeses: 6, // Dataverse no admite predeterminado en enteros (§2.3: 6)
    vu_tiposolucion: opcion('vu_solucion', 'vu_tiposolucion', 'Power App'),
  });
}

/** §2.5 con la información disponible al importar (F3 aún no está desplegado). */
function estadoVu(app, tieneVuAprobada) {
  if (tieneVuAprobada && app.proximaVu && app.proximaVu >= hoy) return global('vu_estadovu', 'Vigente');
  return global('vu_estadovu', 'Pendiente');
}

async function importarVuHistorica(app, solucionId, criterios) {
  const aprobada = global('vu_estadoverificacion', 'Aprobada');
  const existentes = isDryId(solucionId) ? [] : await buscar('vu_verificacion', `_vu_solucionid_value eq ${solucionId} and vu_estado eq ${aprobada}`, 'vu_verificacionid,vu_name');
  if (existentes.length) { stats.existentes++; return existentes[0].vu_verificacionid; }
  const pesos = Object.fromEntries(Object.entries(criterios).map(([n, c]) => [n, c.peso]));
  const i = indice(app.vuRealizada.puntajes, pesos);
  const vid = await crear('vu_verificacion', sinIndefinidos({
    ...bind('vu_verificacion', 'vu_solucionid', 'vu_solucion', solucionId),
    vu_estado: aprobada,
    vu_indiceadopcion: i,
    vu_resultado: opcion('vu_verificacion', 'vu_resultado', resultado(i)),
    vu_recomendacionesconsolidadas: app.vuRealizada.recomendaciones,
    vu_sustentoglobal: `VU histórica importada de la lista SharePoint "Apps" el ${hoy}. Solo incluye los 4 puntajes y las recomendaciones; no hay entrevistas registradas.`,
    vu_entrevistascompletas: 0,
    vu_alertaenviada: true,
    vu_notificaralfinalizar: false,
  }), `VU histórica Aprobada de "${app.nombre}" (índice ${i} %, ${resultado(i)})`);
  for (const [nombre, c] of Object.entries(criterios)) {
    await crear('vu_puntajecriterio', {
      vu_name: nombre,
      ...bind('vu_puntajecriterio', 'vu_verificacionid', 'vu_verificacion', vid),
      ...bind('vu_puntajecriterio', 'vu_criterioid', 'vu_criterio', c.id),
      vu_peso: c.peso,
      vu_puntajefinal: app.vuRealizada.puntajes[nombre],
    }, `  puntaje ${nombre} = ${app.vuRealizada.puntajes[nombre]}`);
  }
  return vid;
}
const isDryId = (id) => typeof id === 'string' && id.startsWith('dry-');

// ---------------------------------------------------------------- main
(async () => {
  const { apps } = JSON.parse(readFileSync(file, 'utf8'));
  log(`Entorno: ${args.org}${DRY ? '  (DRY-RUN)' : ''} · ${apps.length} apps${REEMPLAZAR ? ' · REEMPLAZA el catálogo de ejemplo' : ''}`);
  const nombres = new Set(apps.map((a) => a.nombre));

  const criterios = {};
  for (const c of await api.get(`${set('vu_criterio')}?$select=vu_criterioid,vu_name,vu_peso&$filter=statecode eq 0`).then((d) => d.value)) {
    criterios[c.vu_name] = { id: c.vu_criterioid, peso: Number(c.vu_peso) };
  }
  const suma = Object.values(criterios).reduce((s, c) => s + c.peso, 0);
  if (suma !== 100) throw new Error(`Los pesos de los criterios activos suman ${suma}, no 100`);

  if (REEMPLAZAR) await reemplazarEjemplo(nombres);

  const areas = {};
  for (const app of apps) {
    if (!app.area) throw new Error(`"${app.nombre}" no tiene Resp. Funcional (área)`);
    const areaId = await asegurarArea(app.area, areas);
    const body = cuerpoSolucion(app, areaId);
    const prev = await buscar('vu_solucion', eqName(app.nombre));
    if (prev.length > 1) throw new Error(`Hay ${prev.length} soluciones "${app.nombre}"; resolver a mano`);
    const sid = prev.length ? prev[0].vu_solucionid : null;
    const id = sid ?? await crear('vu_solucion', { ...body, vu_estadovu: global('vu_estadovu', 'Pendiente') }, `solución "${app.nombre}" (${app.area})`);
    if (sid) await actualizar('vu_solucion', sid, body, `solución "${app.nombre}"`);

    let vid = null;
    if (app.vuRealizada) vid = await importarVuHistorica(app, id, criterios);
    if (!isDryId(id)) {
      await actualizar('vu_solucion', id, sinIndefinidos({
        vu_estadovu: estadoVu(app, !!vid),
        ...(vid && !isDryId(vid) ? bind('vu_solucion', 'vu_ultimaverificacionid', 'vu_verificacion', vid) : {}),
      }), `  estado VU de "${app.nombre}"`);
    }
  }

  if (REEMPLAZAR) await limpiarAreasEjemplo(new Set(apps.map((a) => a.area)));
  log(`Resumen: creados ${stats.creados} · actualizados ${stats.actualizados} · borrados ${stats.borrados} · ya existían ${stats.existentes}`);
})().catch((e) => { console.error('\nERROR:', e.message); if (e.body?.error) console.error(JSON.stringify(e.body.error, null, 2).slice(0, 2000)); process.exit(1); });
