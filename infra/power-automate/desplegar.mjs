#!/usr/bin/env node
// Despliega F1–F4 en la solución VerificacionUso del entorno de desarrollo. Idempotente.
//
// Uso:
//   node infra/power-automate/desplegar.mjs [--dry-run] [--org URL] [--sin-activar]
//
// 1. Conexiones: usa las del usuario de `az` (la primera "Connected" de cada conector en el entorno).
//    Approvals no pide credenciales, así que si falta se crea. Las demás (Dataverse, Outlook, Teams)
//    piden consentimiento OAuth: si faltan, el script se detiene y hay que crearlas en make.powerapps.com.
// 2. Referencias de conexión vu_dataverse, vu_approvals, vu_office365 y vu_teams en la solución
//    (las existentes se reenlazan a la conexión elegida).
// 3. Flujos (workflow, category 5): se crean o se actualiza su `clientdata` con cada definition.json.
// 4. Activación (statecode 1): registra los disparadores. Con --sin-activar quedan en borrador.
//
// Pensado para PROBAR en desarrollo con la cuenta propia; antes de producción, enlaza las referencias
// a conexiones de la cuenta de servicio (§3.6) y promueve la solución administrada.
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schema, parseArgs, createClient, log, warn, q } from '../dataverse/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const SIN_ACTIVAR = argv.includes('--sin-activar');
const args = parseArgs(argv.filter((a) => a !== '--sin-activar'));
const DRY = args.dryRun;
const SOLUCION = schema.solution.uniqueName;
const ENTORNO = schema.environment.id;
const api = createClient(args.org, { solution: SOLUCION });

const REFERENCIAS = [
  { logico: 'vu_dataverse', conector: 'shared_commondataserviceforapps', nombre: 'VU · Dataverse' },
  { logico: 'vu_approvals', conector: 'shared_approvals', nombre: 'VU · Approvals' },
  { logico: 'vu_office365', conector: 'shared_office365', nombre: 'VU · Office 365 Outlook' },
  { logico: 'vu_teams', conector: 'shared_teams', nombre: 'VU · Microsoft Teams' },
];

const FLUJOS = [
  { carpeta: 'F1-AlertaAnticipada', nombre: 'VU · F1 Alerta anticipada' },
  { carpeta: 'F2-EnvioRevision', nombre: 'VU · F2 Envío a revisión' },
  { carpeta: 'F3-EstadoSolucion', nombre: 'VU · F3 Estado de la solución' },
  { carpeta: 'F4-Vencimiento', nombre: 'VU · F4 Vencimiento' },
];

// ---------------------------------------------------------------- API de Power Apps (conexiones)
const PA = 'https://api.powerapps.com/providers/Microsoft.PowerApps';
const tokenPA = execSync('az account get-access-token --resource https://service.powerapps.com/ --query accessToken -o tsv', {
  shell: true,
  encoding: 'utf8',
}).trim();
const usuario = execSync('az account show --query user.name -o tsv', { shell: true, encoding: 'utf8' }).trim();

async function pa(method, path, body) {
  const res = await fetch(`${PA}${path}${path.includes('?') ? '&' : '?'}api-version=2016-11-01`, {
    method,
    headers: { Authorization: `Bearer ${tokenPA}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${data?.error?.message ?? ''}`);
  return data;
}

async function conexionDe(conector) {
  const filtro = encodeURIComponent(`environment eq '${ENTORNO}'`);
  const { value } = await pa('GET', `/apis/${conector}/connections?$filter=${filtro}`);
  const propias = value.filter(
    (c) =>
      c.properties.createdBy?.userPrincipalName?.toLowerCase() === usuario.toLowerCase() &&
      (c.properties.statuses ?? []).some((s) => s.status === 'Connected'),
  );
  if (propias.length) return propias[0].name;
  if (conector !== 'shared_approvals') {
    throw new Error(
      `No tienes una conexión activa de ${conector} en el entorno. Créala en make.powerapps.com ` +
        `(Conexiones → Nueva conexión) con ${usuario} y vuelve a ejecutar.`,
    );
  }
  if (DRY) {
    log(`[dry-run] crearía una conexión de Approvals para ${usuario}`);
    return 'dry-approvals';
  }
  const nombre = randomUUID().replace(/-/g, '');
  await pa('PUT', `/apis/${conector}/connections/${nombre}?$filter=${filtro}`, {
    properties: { environment: { id: `/providers/Microsoft.PowerApps/environments/${ENTORNO}`, name: ENTORNO }, displayName: usuario },
  });
  log(`[creado]  conexión de Approvals (${nombre})`);
  return nombre;
}

// ---------------------------------------------------------------- Dataverse
async function asegurarReferencia(r, conexion) {
  const cuerpo = {
    connectionreferencedisplayname: r.nombre,
    connectorid: `/providers/Microsoft.PowerApps/apis/${r.conector}`,
    connectionid: conexion,
  };
  const [actual] = (
    await api.get(
      `connectionreferences?$select=connectionreferenceid,connectionid&$filter=connectionreferencelogicalname eq '${q(r.logico)}'`,
    )
  ).value;
  if (actual?.connectionid === conexion) return log(`[existe]  referencia ${r.logico}`);
  if (DRY) return log(`[dry-run] ${actual ? 'reenlazaría' : 'crearía'} la referencia ${r.logico} → ${conexion}`);
  if (actual) {
    await api.request('PATCH', `connectionreferences(${actual.connectionreferenceid})`, cuerpo);
    return log(`[actual.] referencia ${r.logico} → ${conexion}`);
  }
  await api.request('POST', 'connectionreferences', { ...cuerpo, connectionreferencelogicalname: r.logico }, { inSolution: true });
  log(`[creado]  referencia ${r.logico} → ${conexion}`);
}

async function asegurarFlujo(f) {
  const clientdata = readFileSync(join(HERE, f.carpeta, 'definition.json'), 'utf8');
  JSON.parse(clientdata); // falla pronto si el JSON está roto
  const [actual] = (
    await api.get(`workflows?$select=workflowid,statecode,clientdata&$filter=category eq 5 and name eq '${q(f.nombre)}'`)
  ).value;
  let id = actual?.workflowid;
  const mismo = actual && JSON.stringify(JSON.parse(actual.clientdata)) === JSON.stringify(JSON.parse(clientdata));

  if (DRY) {
    log(`[dry-run] ${!actual ? 'crearía' : mismo ? 'ya está al día' : 'actualizaría'} ${f.nombre}${SIN_ACTIVAR ? '' : ' y lo activaría'}`);
    return;
  }
  if (!actual) {
    const res = await api.request(
      'POST',
      'workflows',
      { category: 5, type: 1, primaryentity: 'none', name: f.nombre, clientdata, description: `Verificación de uso · ${f.carpeta}` },
      { inSolution: true },
    );
    id = api.idFromHeaders(res.headers);
    log(`[creado]  ${f.nombre} (${id})`);
  } else if (!mismo) {
    // La definición de un flujo activo no se puede cambiar: se desactiva, se actualiza y se reactiva.
    if (actual.statecode === 1) await api.request('PATCH', `workflows(${id})`, { statecode: 0, statuscode: 1 });
    await api.request('PATCH', `workflows(${id})`, { clientdata });
    log(`[actual.] ${f.nombre}`);
  } else {
    log(`[existe]  ${f.nombre}`);
  }

  if (SIN_ACTIVAR) return;
  const { statecode } = await api.get(`workflows(${id})?$select=statecode`);
  if (statecode === 1) return log(`[activo]  ${f.nombre}`);
  try {
    await api.request('PATCH', `workflows(${id})`, { statecode: 1, statuscode: 2 });
    log(`[activo]  ${f.nombre}`);
  } catch (e) {
    warn(`no se pudo activar ${f.nombre}: ${e.body?.error?.message ?? e.message}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------- main
(async () => {
  log(`Entorno: ${args.org} · solución ${SOLUCION} · cuenta ${usuario}${DRY ? '  (DRY-RUN)' : ''}`);
  for (const r of REFERENCIAS) await asegurarReferencia(r, await conexionDe(r.conector));
  for (const f of FLUJOS) await asegurarFlujo(f);
})().catch((e) => {
  console.error('\nERROR:', e.message);
  if (e.body?.error) console.error(JSON.stringify(e.body.error, null, 2).slice(0, 2000));
  process.exit(1);
});
