#!/usr/bin/env node
// Semilla idempotente de Verificación de uso (busca por vu_name + padre antes de crear).
// Uso: node infra/dataverse/seed.mjs [--org URL] [--demo] [--dry-run] [--verbose]
import { schema, parseArgs, createClient, log, readJson, q } from './lib.mjs';

const args = parseArgs();
const api = createClient(args.org);
const DRY = args.dryRun;
const stats = { creados: 0, existentes: 0, actualizados: 0 };

const T = Object.fromEntries(schema.tables.map((t) => [t.logicalName, t]));
const set = (logical) => T[logical].entitySetName;
const pk = (logical) => T[logical].primaryIdAttribute;
const nav = (table, lookup) => {
  const c = T[table].columns.find((x) => x.logicalName === lookup);
  if (!c) throw new Error(`No existe ${table}.${lookup} en schema.json`);
  return c.odataBind; // p. ej. "vu_SolucionId@odata.bind"
};
const bind = (table, lookup, targetTable, id) => ({ [nav(table, lookup)]: `/${targetTable === 'systemuser' ? 'systemusers' : set(targetTable)}(${id})` });

/** Busca por filtro; si no existe, crea. Devuelve el id (o un marcador en dry-run). */
async function ensure(table, filter, body, what) {
  const found = await api.get(`${set(table)}?$select=${pk(table)}&$filter=${filter}&$top=2`);
  if (found.value.length > 1) throw new Error(`Hay ${found.value.length} filas para ${what}; resolver duplicados a mano.`);
  if (found.value.length) { stats.existentes++; if (args.verbose) log(`[existe]  ${what}`); return found.value[0][pk(table)]; }
  if (DRY) { log(`[dry-run] crearía ${what}`); return `dry-${Math.random().toString(16).slice(2)}`; }
  const res = await api.request('POST', set(table), body);
  stats.creados++; log(`[creado]  ${what}`);
  return api.idFromHeaders(res.headers);
}
const eqName = (name) => `vu_name eq '${q(name)}'`;
const eqLookup = (lookup, id) => `_${lookup}_value eq ${id}`;
const isDry = (id) => typeof id === 'string' && id.startsWith('dry-');

(async () => {
  log(`Entorno: ${args.org}${DRY ? '  (DRY-RUN)' : ''}${args.demo ? '  (+ demo)' : ''}`);
  const me = (await api.get('WhoAmI')).UserId;
  log(`Responsable de la semilla (WhoAmI): ${me}`);

  // Áreas
  const areas = {};
  for (const a of readJson('seed/areas.json').areas) {
    const parent = a.padre ? areas[a.padre] : null;
    const filter = eqName(a.vu_name) + (parent && !isDry(parent) ? ` and ${eqLookup('vu_areapadreid', parent)}` : '');
    areas[a.vu_name] = await ensure('vu_area', filter, {
      vu_name: a.vu_name, vu_tipoarea: a.vu_tipoarea, ...(parent ? bind('vu_area', 'vu_areapadreid', 'vu_area', parent) : {}),
    }, `área ${a.vu_name}${a.padre ? ' (← ' + a.padre + ')' : ''}`);
  }

  // Criterios, preguntas y opciones
  const cp = readJson('seed/criterios.json');
  const criterios = {}, preguntas = {}, opciones = {};
  for (const c of cp.criterios) criterios[c.vu_name] = await ensure('vu_criterio', eqName(c.vu_name), { vu_name: c.vu_name, vu_peso: c.vu_peso, vu_orden: c.vu_orden }, `criterio ${c.vu_name} (${c.vu_peso})`);
  for (const p of cp.preguntas) {
    const crit = criterios[p.criterio];
    const pid = await ensure('vu_pregunta', `${eqName(p.vu_name)}${isDry(crit) ? '' : ' and ' + eqLookup('vu_criterioid', crit)}`, {
      vu_name: p.vu_name, vu_tiporespuesta: p.vu_tiporespuesta, vu_orden: p.vu_orden, ...bind('vu_pregunta', 'vu_criterioid', 'vu_criterio', crit),
    }, `pregunta "${p.vu_name}"`);
    preguntas[p.vu_name] = pid;
    for (const o of p.opciones) {
      opciones[`${p.vu_name}|${o.vu_name}`] = await ensure('vu_opcionrespuesta', `${eqName(o.vu_name)}${isDry(pid) ? '' : ' and ' + eqLookup('vu_preguntaid', pid)}`, {
        vu_name: o.vu_name, vu_puntajesugerido: o.vu_puntajesugerido, vu_orden: o.vu_orden, ...bind('vu_opcionrespuesta', 'vu_preguntaid', 'vu_pregunta', pid),
      }, `opción ${o.vu_name} (${o.vu_puntajesugerido})`);
    }
  }

  // Soluciones y documentos
  const sd = readJson('seed/soluciones.json');
  const soluciones = {};
  for (const s of sd.soluciones) {
    const body = {
      vu_name: s.vu_name, vu_descripcion: s.vu_descripcion, vu_tiposolucion: s.vu_tiposolucion,
      vu_usuariosobjetivo: s.vu_usuariosobjetivo, vu_fechaactualizacion: s.vu_fechaactualizacion,
      vu_periodicidadmeses: s.vu_periodicidadmeses, vu_estadovu: s.vu_estadovu,
      ...(s.vu_proximavu ? { vu_proximavu: s.vu_proximavu } : {}),
      ...bind('vu_solucion', 'vu_procesoid', 'vu_area', areas[s.proceso]),
      ...bind('vu_solucion', 'vu_responsableid', 'systemuser', me),
    };
    const sid = await ensure('vu_solucion', eqName(s.vu_name), body, `solución ${s.vu_name}`);
    soluciones[s.vu_name] = sid;
    for (const d of sd.documentosPorSolucion) {
      await ensure('vu_documentosolucion', `${eqName(d.vu_name)}${isDry(sid) ? '' : ' and ' + eqLookup('vu_solucionid', sid)}`, {
        vu_name: d.vu_name, vu_tipodocumento: d.vu_tipodocumento, vu_formato: d.vu_formato, vu_version: d.vu_version,
        vu_enlace: `${sd.baseEnlaceEjemplo}${s.slug}/${d.slug}`, vu_vigente: true,
        ...bind('vu_documentosolucion', 'vu_solucionid', 'vu_solucion', sid),
      }, `  documento ${d.vu_name} de ${s.vu_name}`);
    }
  }

  // Demostración (solo desarrollo)
  if (args.demo) {
    const demo = readJson('seed/demo.json');
    const sid = soluciones[demo.solucion];
    const v = demo.verificacion;
    const vFilter = isDry(sid) ? `vu_fechaobjetivo eq ${v.vu_fechaobjetivo}` : `${eqLookup('vu_solucionid', sid)} and vu_fechaobjetivo eq ${v.vu_fechaobjetivo}`;
    const vid = await ensure('vu_verificacion', vFilter, {
      ...v, ...bind('vu_verificacion', 'vu_solucionid', 'vu_solucion', sid), ...bind('vu_verificacion', 'vu_responsableid', 'systemuser', me),
    }, `verificación demo de ${demo.solucion} (${v.vu_fechaobjetivo})`);

    for (const e of demo.entrevistas) {
      const { area, respuestas = [], ...fields } = e;
      const eid = await ensure('vu_entrevista', `${eqName(e.vu_name)}${isDry(vid) ? '' : ' and ' + eqLookup('vu_verificacionid', vid)}`, {
        ...fields, ...bind('vu_entrevista', 'vu_verificacionid', 'vu_verificacion', vid), ...(area ? bind('vu_entrevista', 'vu_areaid', 'vu_area', areas[area]) : {}),
      }, `  ${e.vu_name}`);
      for (const r of respuestas) {
        const { pregunta, criterio, opcion, ...rf } = r;
        await ensure('vu_respuesta', `${eqName(r.vu_name)}${isDry(eid) ? '' : ' and ' + eqLookup('vu_entrevistaid', eid)}`, {
          ...rf,
          ...bind('vu_respuesta', 'vu_entrevistaid', 'vu_entrevista', eid),
          ...bind('vu_respuesta', 'vu_verificacionid', 'vu_verificacion', vid),
          ...bind('vu_respuesta', 'vu_criterioid', 'vu_criterio', criterios[criterio]),
          ...(pregunta ? bind('vu_respuesta', 'vu_preguntaid', 'vu_pregunta', preguntas[pregunta]) : {}),
          ...(opcion ? bind('vu_respuesta', 'vu_opcionid', 'vu_opcionrespuesta', opciones[`${pregunta}|${opcion}`]) : {}),
        }, `    respuesta "${r.vu_name}" (${criterio}, ${r.vu_puntaje})`);
      }
    }

    const pesos = Object.fromEntries(cp.criterios.map((c) => [c.vu_name, c.vu_peso]));
    for (const p of demo.puntajes) {
      const cid = criterios[p.criterio];
      await ensure('vu_puntajecriterio', isDry(vid) ? eqName(p.criterio) : `${eqLookup('vu_verificacionid', vid)} and ${eqLookup('vu_criterioid', cid)}`, {
        vu_name: p.criterio, vu_peso: pesos[p.criterio], vu_puntajesugerido: p.vu_puntajesugerido, vu_puntajefinal: p.vu_puntajefinal,
        ...bind('vu_puntajecriterio', 'vu_verificacionid', 'vu_verificacion', vid),
        ...bind('vu_puntajecriterio', 'vu_criterioid', 'vu_criterio', cid),
      }, `  puntaje ${p.criterio} = ${p.vu_puntajefinal}`);
    }

    // La solución refleja la verificación en curso (§2.5: En levantamiento → En proceso)
    if (!isDry(sid) && !isDry(vid)) {
      const cur = await api.get(`${set('vu_solucion')}(${sid})?$select=vu_estadovu,_vu_ultimaverificacionid_value`);
      if (cur.vu_estadovu !== demo.actualizarSolucion.vu_estadovu || cur._vu_ultimaverificacionid_value !== vid) {
        if (DRY) log(`[dry-run] actualizaría ${demo.solucion}: vu_estadovu y vu_ultimaverificacionid`);
        else {
          await api.request('PATCH', `${set('vu_solucion')}(${sid})`, { ...demo.actualizarSolucion, ...bind('vu_solucion', 'vu_ultimaverificacionid', 'vu_verificacion', vid) });
          stats.actualizados++; log(`[ajuste]  ${demo.solucion}: vu_estadovu = En proceso, vu_ultimaverificacionid = demo`);
        }
      } else stats.existentes++;
    }
    if (!isDry(vid)) {
      const vv = await api.get(`${set('vu_verificacion')}(${vid})?$select=vu_name`);
      log(`Verificación demo: ${vv.vu_name} (${vid})`);
    }
  }

  log(`Resumen semilla: creados ${stats.creados} · ajustes ${stats.actualizados} · ya existían ${stats.existentes}`);
})().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
