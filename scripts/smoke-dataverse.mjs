#!/usr/bin/env node
/**
 * Prueba de humo (SOLO LECTURA) de la capa Dataverse de la app, sin el host de Power Apps.
 *
 * Ejecuta contra la Web API las MISMAS consultas OData que `src/data/dataverse/repositoriosDataverse.ts`
 * (mismos `$select`, `$filter`, `$orderby` y la cabecera `Prefer: odata.include-annotations=*`
 * que pone el SDK) y comprueba que existen las columnas, las propiedades `_x_value`, las
 * propiedades de navegación que la app usa en `@odata.bind`, y que los valores de opción
 * devueltos pertenecen al contrato (`infra/dataverse/schema.json`). No escribe nada.
 *
 *   node scripts/smoke-dataverse.mjs [--org https://org4d363b5e.crm2.dynamics.com]
 *
 * Requisitos: `az login` con acceso al entorno. Sale con código ≠ 0 si algo falla.
 * `SELECT` debe coincidir con `src/data/dataverse/mapeadores.ts` (lo comprueba una prueba de Vitest).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SELECT = {
  area: ['vu_areaid', 'vu_name', 'vu_tipoarea', '_vu_areapadreid_value', 'statecode'],
  solucion: [
    'vu_solucionid',
    'vu_name',
    'vu_descripcion',
    'vu_tiposolucion',
    '_vu_procesoid_value',
    '_vu_responsableid_value',
    'vu_usuariosobjetivo',
    'vu_fechaactualizacion',
    'vu_periodicidadmeses',
    'vu_proximavu',
    'vu_estadovu',
    '_vu_ultimaverificacionid_value',
    'vu_tipoproceso',
    'vu_proveedor',
    'vu_tipodiseno',
    'vu_basedatos',
    'vu_tienedashboard',
    'vu_estadodesarrollo',
    'vu_evolucion',
    'vu_beneficioanualpen',
    'vu_capexpen',
    'vu_capexusd',
    'vu_fechaimplementacion',
    'vu_resultadovu',
  ],
  documento: [
    'vu_documentosolucionid',
    'vu_name',
    '_vu_solucionid_value',
    'vu_tipodocumento',
    'vu_formato',
    'vu_enlace',
    'vu_version',
    'vu_vigente',
  ],
  criterio: ['vu_criterioid', 'vu_name', 'vu_peso', 'vu_orden', 'statecode'],
  pregunta: ['vu_preguntaid', 'vu_name', '_vu_criterioid_value', 'vu_tiporespuesta', 'vu_orden', 'statecode'],
  opcion: ['vu_opcionrespuestaid', 'vu_name', '_vu_preguntaid_value', 'vu_puntajesugerido', 'vu_orden'],
  verificacion: [
    'vu_verificacionid',
    'vu_name',
    '_vu_solucionid_value',
    '_vu_responsableid_value',
    'vu_fechaobjetivo',
    'vu_diasanticipacion',
    'vu_fechaalerta',
    'vu_alertaenviada',
    'vu_entrevistasprevistas',
    'vu_entrevistascompletas',
    'vu_modalidad',
    'vu_objetivo',
    'vu_estado',
    'vu_indiceadopcion',
    'vu_resultado',
    'vu_sustentoglobal',
    'vu_oportunidadesconsolidadas',
    'vu_recomendacionesconsolidadas',
    '_vu_aprobadorpilotoid_value',
    '_vu_aprobadorproductivoid_value',
    'vu_notificaralfinalizar',
    'vu_fechaenvio',
    'vu_fechaaprobacion',
  ],
  entrevista: [
    'vu_entrevistaid',
    'vu_name',
    '_vu_verificacionid_value',
    'vu_numero',
    '_vu_entrevistadoid_value',
    'vu_entrevistadonombre',
    'vu_entrevistadocorreo',
    '_vu_areaid_value',
    'vu_fechahora',
    'vu_modalidad',
    'vu_estadoentrevista',
    'vu_urlgrabacion',
    'vu_oportunidadesmejora',
    'vu_recomendaciones',
    'vu_fechacompletada',
  ],
  respuesta: [
    'vu_respuestaid',
    'vu_name',
    '_vu_entrevistaid_value',
    '_vu_verificacionid_value',
    'vu_origen',
    '_vu_preguntaid_value',
    '_vu_criterioid_value',
    '_vu_opcionid_value',
    'vu_respuestatexto',
    'vu_puntaje',
    'vu_sustento',
    'vu_orden',
  ],
  evidencia: [
    'vu_evidenciaid',
    'vu_name',
    '_vu_entrevistaid_value',
    '_vu_verificacionid_value',
    '_vu_respuestaid_value',
    'vu_tipoevidencia',
  ],
  puntaje: [
    'vu_puntajecriterioid',
    'vu_name',
    '_vu_verificacionid_value',
    '_vu_criterioid_value',
    'vu_peso',
    'vu_puntajesugerido',
    'vu_puntajefinal',
    'vu_sustentoajuste',
  ],
  aprobacion: [
    'vu_aprobacionid',
    'vu_name',
    '_vu_verificacionid_value',
    'vu_nivel',
    '_vu_aprobadorid_value',
    'vu_decision',
    'vu_comentario',
    'vu_fechasolicitud',
    'vu_fechadecision',
    'vu_approvalid',
  ],
  usuario: ['systemuserid', 'fullname', 'internalemailaddress', 'domainname'],
};

/** Propiedades de navegación que la app escribe con `@odata.bind` (mapeadores.ts), por entity set. */
export const BINDS = {
  vu_solucions: ['vu_ProcesoId', 'vu_ResponsableId'],
  vu_documentosolucions: ['vu_SolucionId'],
  vu_preguntas: ['vu_CriterioId'],
  vu_opcionrespuestas: ['vu_PreguntaId'],
  vu_verificacions: ['vu_SolucionId', 'vu_ResponsableId', 'vu_AprobadorPilotoId', 'vu_AprobadorProductivoId'],
  vu_entrevistas: ['vu_VerificacionId', 'vu_EntrevistadoId', 'vu_AreaId'],
  vu_respuestas: ['vu_EntrevistaId', 'vu_VerificacionId', 'vu_PreguntaId', 'vu_CriterioId', 'vu_OpcionId'],
  vu_evidencias: ['vu_VerificacionId', 'vu_EntrevistaId', 'vu_RespuestaId'],
  vu_puntajecriterios: ['vu_VerificacionId', 'vu_CriterioId'],
};

const FV = '@OData.Community.Display.V1.FormattedValue';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const args = process.argv.slice(2);
  const iOrg = args.indexOf('--org');
  const esquema = JSON.parse(readFileSync(resolve(RAIZ, 'infra/dataverse/schema.json'), 'utf8'));
  const org = (iOrg >= 0 ? args[iOrg + 1] : process.env.DATAVERSE_URL ?? esquema.environment.url).replace(/\/$/, '');

  if (!/^https:\/\/[\w.-]+$/.test(org)) throw new Error(`URL de organización inválida: ${org}`);
  const token = execSync(`az account get-access-token --resource ${org} --query accessToken -o tsv`, {
    encoding: 'utf8',
  }).trim();

  let fallos = 0;
  const ok = (m) => console.log(`  ✔ ${m}`);
  const mal = (m) => {
    fallos++;
    console.log(`  ✘ ${m}`);
  };
  const comprobar = (cond, m) => (cond ? ok(m) : mal(m));

  /** GET como el SDK: misma cabecera Prefer y `$select/$filter/$orderby/$top`. */
  const consultar = async (conjunto, { select, filter, orderBy, top, expand } = {}) => {
    const qs = [];
    if (select) qs.push(`$select=${encodeURIComponent(select.join(','))}`);
    if (filter) qs.push(`$filter=${encodeURIComponent(filter)}`);
    if (orderBy) qs.push(`$orderby=${encodeURIComponent(orderBy.join(','))}`);
    if (top) qs.push(`$top=${top}`);
    if (expand) qs.push(`$expand=${encodeURIComponent(expand)}`);
    const url = `${org}/api/data/v9.2/${conjunto}${qs.length ? `?${qs.join('&')}` : ''}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'OData-Version': '4.0',
        'OData-MaxVersion': '4.0',
        Prefer: 'odata.maxpagesize=500,odata.include-annotations=*',
      },
    });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${conjunto}: HTTP ${r.status} ${cuerpo?.error?.message ?? ''}`);
    return cuerpo.value ?? [];
  };

  /** Ejecuta una consulta y valida columnas, búsquedas y opciones de las filas. */
  const tabla = async (titulo, conjunto, select, opciones = {}) => {
    try {
      const filas = await consultar(conjunto, { select, ...opciones });
      ok(`${titulo}: ${filas.length} fila(s) · ${conjunto}`);
      const def = esquema.tables.find((t) => t.entitySetName === conjunto);
      for (const f of filas) {
        const faltan = select.filter((c) => !(c in f));
        if (faltan.length) mal(`${conjunto} sin columnas en la respuesta: ${faltan.join(', ')}`);
        for (const c of select.filter((x) => x.startsWith('_') && f[x])) {
          if (typeof f[`${c}${FV}`] !== 'string') mal(`${conjunto}.${c} sin nombre formateado (FormattedValue)`);
        }
        for (const col of def?.columns.filter((x) => x.type === 'Picklist') ?? []) {
          if (f[col.logicalName] == null) continue;
          const valores = (col.options ?? esquema.globalOptionSets.find((g) => g.name === col.globalOptionSet)?.options ?? []).map(
            (o) => o.value,
          );
          if (!valores.includes(f[col.logicalName])) mal(`${conjunto}.${col.logicalName} = ${f[col.logicalName]} fuera del contrato`);
        }
      }
      return filas;
    } catch (e) {
      mal(`${titulo}: ${e.message}`);
      return [];
    }
  };

  const porVerificacion = (id) => `_vu_verificacionid_value eq ${id}`;
  console.log(`Dataverse: ${org}\n`);

  console.log('Catálogo');
  await tabla('Áreas', 'vu_areas', SELECT.area, { orderBy: ['vu_name asc'] });
  const criterios = await tabla('Criterios', 'vu_criterios', SELECT.criterio, { orderBy: ['vu_orden asc'] });
  const suma = criterios.filter((c) => c.statecode === 0).reduce((s, c) => s + c.vu_peso, 0);
  comprobar(suma === 100, `Pesos activos suman ${suma}`);
  await tabla('Preguntas', 'vu_preguntas', SELECT.pregunta, { orderBy: ['vu_orden asc'] });
  await tabla('Opciones', 'vu_opcionrespuestas', SELECT.opcion, { orderBy: ['vu_orden asc'] });
  const soluciones = await tabla('Soluciones', 'vu_solucions', SELECT.solucion, { orderBy: ['vu_name asc'] });
  comprobar(soluciones.length === 4, `4 soluciones (hay ${soluciones.length})`);
  for (const s of soluciones) {
    console.log(
      `      · ${s.vu_name} — proceso ${s[`_vu_procesoid_value${FV}`]}, estado VU ${s[`vu_estadovu${FV}`]}, responsable ${s[`_vu_responsableid_value${FV}`]}`,
    );
  }
  if (soluciones[0]) {
    await tabla('Documentos (1.ª solución)', 'vu_documentosolucions', SELECT.documento, {
      filter: `_vu_solucionid_value eq ${soluciones[0].vu_solucionid}`,
      orderBy: ['vu_name asc'],
    });
  }

  console.log('\nVerificación demo');
  const verificaciones = await tabla('Verificaciones', 'vu_verificacions', SELECT.verificacion, { orderBy: ['vu_name desc'] });
  const demo = verificaciones.find((v) => v.vu_name === 'VU-00001');
  comprobar(!!demo, 'Existe VU-00001 (autonumeración)');
  if (demo) {
    console.log(
      `      · ${demo.vu_name} — ${demo[`_vu_solucionid_value${FV}`]} · ${demo[`vu_estado${FV}`]} · objetivo ${demo.vu_fechaobjetivo} · alerta ${demo.vu_fechaalerta} · ${demo.vu_entrevistascompletas}/${demo.vu_entrevistasprevistas}`,
    );
    comprobar(/^\d{4}-\d{2}-\d{2}$/.test(demo.vu_fechaobjetivo), 'DateOnly llega como yyyy-MM-dd');
    const id = demo.vu_verificacionid;
    const entrevistas = await tabla('Entrevistas', 'vu_entrevistas', SELECT.entrevista, {
      filter: porVerificacion(id),
      orderBy: ['vu_numero asc'],
    });
    const completas = entrevistas.filter((e) => e.vu_estadoentrevista === 100000002).length;
    comprobar(completas === demo.vu_entrevistascompletas, `Recuento de completas = ${completas}`);
    await tabla('Respuestas (por verificación)', 'vu_respuestas', SELECT.respuesta, {
      filter: porVerificacion(id),
      orderBy: ['vu_orden asc'],
    });
    if (entrevistas[2]) {
      await tabla('Respuestas (entrevista 3)', 'vu_respuestas', SELECT.respuesta, {
        filter: `_vu_entrevistaid_value eq ${entrevistas[2].vu_entrevistaid}`,
        orderBy: ['vu_orden asc'],
      });
    }
    const puntajes = await tabla('Puntajes', 'vu_puntajecriterios', SELECT.puntaje, { filter: porVerificacion(id) });
    comprobar(puntajes.length === criterios.length, `Un puntaje por criterio (${puntajes.length})`);
    await tabla('Evidencias', 'vu_evidencias', SELECT.evidencia, { filter: porVerificacion(id), orderBy: ['createdon asc'] });
    await tabla('Aprobaciones', 'vu_aprobacions', SELECT.aprobacion, {
      filter: porVerificacion(id),
      orderBy: ['vu_fechasolicitud asc'],
    });

    console.log('\nPersonas (systemuser)');
    const ids = [...new Set([demo._vu_responsableid_value, ...soluciones.map((s) => s._vu_responsableid_value)].filter(Boolean))];
    const usuarios = await tabla('Responsables', 'systemusers', SELECT.usuario, {
      filter: ids.map((u) => `systemuserid eq ${u}`).join(' or '),
      orderBy: ['fullname asc'],
    });
    for (const u of usuarios) console.log(`      · ${u.fullname} <${u.internalemailaddress}>`);
  }
  const directorio = await tabla('Directorio', 'systemusers', SELECT.usuario, {
    filter: 'isdisabled eq false and accessmode eq 0 and internalemailaddress ne null',
    orderBy: ['fullname asc'],
    top: 500,
  });
  comprobar(directorio.length > 0, 'El selector de personas tiene usuarios');
  try {
    const who = await fetch(`${org}/api/data/v9.2/WhoAmI`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const [yo] = await consultar('systemusers', { select: [...SELECT.usuario, 'azureactivedirectoryobjectid'], filter: `systemuserid eq ${who.UserId}` });
    const [porOid] = await consultar('systemusers', {
      select: SELECT.usuario,
      filter: `azureactivedirectoryobjectid eq ${yo.azureactivedirectoryobjectid}`,
      top: 1,
    });
    comprobar(porOid?.systemuserid === who.UserId, `Usuario actual por azureactivedirectoryobjectid: ${porOid?.fullname}`);
  } catch (e) {
    mal(`Usuario actual: ${e.message}`);
  }

  console.log('\nPropiedades de navegación (@odata.bind)');
  for (const [conjunto, navs] of Object.entries(BINDS)) {
    try {
      await consultar(conjunto, { select: [SELECT_ID[conjunto]], expand: navs.map((n) => `${n}($select=createdon)`).join(','), top: 1 });
      ok(`${conjunto}: ${navs.join(', ')}`);
    } catch (e) {
      mal(e.message);
    }
  }

  console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : '\nTodo OK.');
  process.exit(fallos ? 1 : 0);
}

const SELECT_ID = {
  vu_solucions: 'vu_solucionid',
  vu_documentosolucions: 'vu_documentosolucionid',
  vu_preguntas: 'vu_preguntaid',
  vu_opcionrespuestas: 'vu_opcionrespuestaid',
  vu_verificacions: 'vu_verificacionid',
  vu_entrevistas: 'vu_entrevistaid',
  vu_respuestas: 'vu_respuestaid',
  vu_evidencias: 'vu_evidenciaid',
  vu_puntajecriterios: 'vu_puntajecriterioid',
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
