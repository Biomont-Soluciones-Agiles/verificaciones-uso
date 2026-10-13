#!/usr/bin/env node
// Semilla idempotente de la configuración de Verificación de uso: áreas, criterios, pregunta y
// opciones (busca por vu_name + padre antes de crear). El catálogo de soluciones lo carga importar-apps.mjs.
// Uso: node infra/dataverse/seed.mjs [--org URL] [--dry-run] [--verbose]
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
  log(`Entorno: ${args.org}${DRY ? '  (DRY-RUN)' : ''}`);

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
      vu_name: p.vu_name, vu_tiporespuesta: p.vu_tiporespuesta, vu_orden: p.vu_orden, vu_obligatoria: p.vu_obligatoria ?? true, ...bind('vu_pregunta', 'vu_criterioid', 'vu_criterio', crit),
    }, `pregunta "${p.vu_name}"`);
    preguntas[p.vu_name] = pid;
    for (const o of p.opciones) {
      opciones[`${p.vu_name}|${o.vu_name}`] = await ensure('vu_opcionrespuesta', `${eqName(o.vu_name)}${isDry(pid) ? '' : ' and ' + eqLookup('vu_preguntaid', pid)}`, {
        vu_name: o.vu_name, vu_puntajesugerido: o.vu_puntajesugerido, vu_orden: o.vu_orden, ...bind('vu_opcionrespuesta', 'vu_preguntaid', 'vu_pregunta', pid),
      }, `opción ${o.vu_name} (${o.vu_puntajesugerido})`);
    }
  }

  log(`Resumen semilla: creados ${stats.creados} · ajustes ${stats.actualizados} · ya existían ${stats.existentes}`);
})().catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
