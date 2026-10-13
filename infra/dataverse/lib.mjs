// Utilidades comunes de provision.mjs, seed.mjs y verify.mjs (sin dependencias npm).
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const readJson = (rel) => JSON.parse(readFileSync(join(HERE, rel), 'utf8'));
export const schema = readJson('schema.json');

// ---------- argumentos ----------
export function parseArgs(argv = process.argv.slice(2)) {
  const args = { dryRun: false, org: process.env.DATAVERSE_URL || schema.environment.url, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--org') args.org = argv[++i];
    else if (a.startsWith('--org=')) args.org = a.slice(6);
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  args.org = args.org.replace(/\/+$/, '');
  return args;
}

// ---------- registro ----------
const t0 = Date.now();
const stamp = () => `[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s]`;
export const log = (...m) => console.log(stamp(), ...m);
export const warn = (...m) => console.warn(stamp(), 'AVISO:', ...m);

// ---------- token (az CLI) ----------
let tokenCache = { value: null, at: 0 };
const TOKEN_TTL_MS = 45 * 60 * 1000; // se renueva antes de que caduque (~60-75 min)
function getToken(org) {
  if (tokenCache.value && Date.now() - tokenCache.at < TOKEN_TTL_MS) return tokenCache.value;
  const cmd = `az account get-access-token --resource ${org} --query accessToken -o tsv`;
  const value = execSync(cmd, { shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (!value) throw new Error('az no devolvió token. Ejecuta "az login".');
  tokenCache = { value, at: Date.now() };
  return value;
}

// ---------- cliente Web API ----------
export class DataverseError extends Error {
  constructor(status, body, method, path) {
    const msg = body?.error?.message || (typeof body === 'string' ? body : JSON.stringify(body));
    super(`${method} ${path} → HTTP ${status}: ${msg}`);
    this.status = status; this.body = body; this.code = body?.error?.code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createClient(org, { solution } = {}) {
  const base = `${org}/api/data/v9.2/`;
  async function request(method, path, body, { headers = {}, allow404 = false, inSolution = false, retries = 6 } = {}) {
    const url = path.startsWith('http') ? path : base + path;
    for (let attempt = 0; ; attempt++) {
      const h = {
        Authorization: `Bearer ${getToken(org)}`,
        Accept: 'application/json',
        'OData-MaxVersion': '4.0', 'OData-Version': '4.0',
        ...(body !== undefined ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
        ...(inSolution && solution ? { 'MSCRM.SolutionUniqueName': solution } : {}),
        ...headers,
      };
      let res;
      try {
        res = await fetch(url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
      } catch (e) {
        if (method === 'GET' && attempt < retries) { warn(`error de red en ${method} ${path}: ${e.message}; reintento`); await sleep(2000 * (attempt + 1)); continue; }
        throw e;
      }
      if ((res.status === 429 || res.status === 503 || (res.status === 502 && method === 'GET') || (res.status === 504 && method === 'GET')) && attempt < retries) {
        const ra = Number(res.headers.get('Retry-After'));
        const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 3000 * (attempt + 1);
        warn(`HTTP ${res.status} en ${method} ${path}; espero ${Math.round(wait / 1000)} s (intento ${attempt + 1}/${retries})`);
        await sleep(wait); continue;
      }
      const text = await res.text();
      let data = null;
      if (text) { try { data = JSON.parse(text); } catch { data = text; } }
      if (res.status === 401 && attempt < 1) { tokenCache.value = null; continue; }
      if (res.status === 404 && allow404) return { status: 404, data: null, headers: res.headers };
      if (!res.ok) {
        // bloqueo de personalización concurrente: se reintenta
        const code = data?.error?.code;
        if (attempt < retries && (code === '0x80071151' || /customization.*(in progress|lock)|another .*operation/i.test(data?.error?.message || ''))) {
          warn(`personalización en curso; reintento en 10 s (${code})`); await sleep(10000); continue;
        }
        throw new DataverseError(res.status, data, method, path);
      }
      return { status: res.status, data, headers: res.headers };
    }
  }
  const get = async (path, opts) => (await request('GET', path, undefined, opts)).data;
  async function getAll(path) {
    const out = []; let next = path;
    while (next) {
      const d = await get(next, { headers: { Prefer: 'odata.maxpagesize=5000' } });
      out.push(...(d.value || [])); next = d['@odata.nextLink'] || null;
    }
    return out;
  }
  const idFromHeaders = (headers) => {
    const loc = headers.get('OData-EntityId') || headers.get('Location') || '';
    const m = loc.match(/\(([0-9a-fA-F-]{36})\)\s*$/) || loc.match(/([0-9a-fA-F-]{36})/);
    return m ? m[1] : null;
  };
  return { request, get, getAll, idFromHeaders, base };
}

// ---------- metadatos ----------
export const label = (text) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.Label',
  LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: schema.environment.languageCode }],
});
export const labelText = (l) => l?.UserLocalizedLabel?.Label ?? l?.LocalizedLabels?.[0]?.Label ?? null;
export const q = (s) => encodeURIComponent(String(s).replace(/'/g, "''"));
export const primaryKeyOf = (logicalName) => `${logicalName}id`;
