#!/usr/bin/env node
// Crea (de forma idempotente) el esquema de Verificación de uso en Dataverse a partir de schema.json.
// Uso: node infra/dataverse/provision.mjs [--org https://<org>.crmX.dynamics.com] [--dry-run] [--verbose]
import { schema, parseArgs, createClient, log, warn, label, q, primaryKeyOf } from './lib.mjs';

const args = parseArgs();
if (args.help) {
  console.log('node infra/dataverse/provision.mjs [--org URL] [--dry-run] [--verbose]');
  process.exit(0);
}
const SOL = schema.solution.uniqueName;
const api = createClient(args.org, { solution: SOL });
const DRY = args.dryRun;
const stats = { creados: 0, existentes: 0, actualizados: 0, omitidosDry: 0 };

const created = (what) => { stats.creados++; log(`[creado]  ${what}`); };
const exists = (what) => { stats.existentes++; if (args.verbose) log(`[existe]  ${what}`); };
const wouldCreate = (what) => { stats.omitidosDry++; log(`[dry-run] crearía ${what}`); };

const reqLevel = (v) => ({ Value: v, CanBeChanged: true, ManagedPropertyLogicalName: 'canmodifyrequirementlevelsettings' });

// ---------------------------------------------------------------- publicador y solución
async function ensurePublisher() {
  const p = schema.publisher;
  const found = await api.get(`publishers?$select=publisherid,uniquename,customizationprefix,customizationoptionvalueprefix&$filter=uniquename eq '${q(p.uniqueName)}'`);
  if (found.value.length) {
    const f = found.value[0];
    if (f.customizationprefix !== p.customizationPrefix || f.customizationoptionvalueprefix !== p.customizationOptionValuePrefix)
      throw new Error(`El publicador ${p.uniqueName} existe con prefijos distintos (${f.customizationprefix}/${f.customizationoptionvalueprefix}).`);
    exists(`publicador ${p.uniqueName}`); return f.publisherid;
  }
  const clash = await api.get(`publishers?$select=uniquename&$filter=customizationprefix eq '${q(p.customizationPrefix)}'`);
  if (clash.value.length) throw new Error(`El prefijo "${p.customizationPrefix}" ya lo usa el publicador ${clash.value[0].uniquename}.`);
  if (DRY) { wouldCreate(`publicador ${p.uniqueName} (prefijo ${p.customizationPrefix}, opciones ${p.customizationOptionValuePrefix})`); return null; }
  const res = await api.request('POST', 'publishers', {
    uniquename: p.uniqueName, friendlyname: p.friendlyName, description: p.description,
    customizationprefix: p.customizationPrefix, customizationoptionvalueprefix: p.customizationOptionValuePrefix,
  });
  created(`publicador ${p.uniqueName}`);
  return api.idFromHeaders(res.headers);
}

async function ensureSolution(publisherId) {
  const s = schema.solution;
  const found = await api.get(`solutions?$select=solutionid,uniquename,_publisherid_value&$filter=uniquename eq '${q(s.uniqueName)}'`);
  if (found.value.length) {
    if (publisherId && found.value[0]._publisherid_value !== publisherId) throw new Error(`La solución ${s.uniqueName} existe con otro publicador.`);
    exists(`solución ${s.uniqueName}`); return found.value[0].solutionid;
  }
  if (DRY) { wouldCreate(`solución ${s.uniqueName}`); return null; }
  const res = await api.request('POST', 'solutions', {
    uniquename: s.uniqueName, friendlyname: s.friendlyName, description: s.description, version: s.version,
    'publisherid@odata.bind': `/publishers(${publisherId})`,
  });
  created(`solución ${s.uniqueName}`);
  return api.idFromHeaders(res.headers);
}

// ---------------------------------------------------------------- opciones globales
const globalOptionSetIds = {};
async function ensureGlobalOptionSets() {
  for (const os of schema.globalOptionSets) {
    const r = await api.request('GET', `GlobalOptionSetDefinitions(Name='${q(os.name)}')?$select=MetadataId,Name`, undefined, { allow404: true });
    if (r.status !== 404) { globalOptionSetIds[os.name] = r.data.MetadataId; exists(`opción global ${os.name}`); continue; }
    if (DRY) { wouldCreate(`opción global ${os.name} (${os.options.length} valores)`); continue; }
    const res = await api.request('POST', 'GlobalOptionSetDefinitions', {
      '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
      Name: os.name, DisplayName: label(os.displayName), Description: label(os.displayName),
      IsGlobal: true, OptionSetType: 'Picklist',
      Options: os.options.map((o) => ({ Value: o.value, Label: label(o.label) })),
    }, { inSolution: true });
    globalOptionSetIds[os.name] = api.idFromHeaders(res.headers);
    created(`opción global ${os.name}`);
  }
}

// ---------------------------------------------------------------- atributos
function attributeBody(c) {
  const common = { SchemaName: c.schemaName, DisplayName: label(c.displayName), Description: label(c.displayName), RequiredLevel: reqLevel(c.requiredLevel) };
  switch (c.type) {
    case 'String': return { '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata', ...common, MaxLength: c.maxLength, FormatName: { Value: c.format || 'Text' }, ...(c.autoNumberFormat ? { AutoNumberFormat: c.autoNumberFormat } : {}) };
    case 'Memo': return { '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata', ...common, MaxLength: c.maxLength, Format: 'TextArea' };
    case 'Integer': return { '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata', ...common, Format: 'None', MinValue: c.minValue, MaxValue: c.maxValue };
    case 'Decimal': return { '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata', ...common, MinValue: c.minValue, MaxValue: c.maxValue, Precision: c.precision };
    case 'Boolean': return {
      '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata', ...common, DefaultValue: c.defaultValue,
      OptionSet: { '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata', OptionSetType: 'Boolean', TrueOption: { Value: 1, Label: label(c.trueLabel) }, FalseOption: { Value: 0, Label: label(c.falseLabel) } },
    };
    case 'DateTime': return { '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', ...common, Format: c.format, DateTimeBehavior: { Value: c.dateTimeBehavior } };
    case 'Picklist': {
      const b = { '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata', ...common, ...(c.defaultValue !== undefined ? { DefaultFormValue: c.defaultValue } : {}) };
      if (c.globalOptionSet) {
        const id = globalOptionSetIds[c.globalOptionSet];
        if (!id) throw new Error(`Falta la opción global ${c.globalOptionSet}`);
        b['GlobalOptionSet@odata.bind'] = `/GlobalOptionSetDefinitions(${id})`;
      } else {
        b.OptionSet = { '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata', IsGlobal: false, OptionSetType: 'Picklist', Options: c.options.map((o) => ({ Value: o.value, Label: label(o.label) })) };
      }
      return b;
    }
    case 'File': return { '@odata.type': 'Microsoft.Dynamics.CRM.FileAttributeMetadata', ...common, MaxSizeInKB: c.maxSizeInKB };
    default: throw new Error(`Tipo no soportado: ${c.type}`);
  }
}

// ---------------------------------------------------------------- tablas
const existingAttrs = {}; // logicalName → Set(attribute logical names)
async function loadAttributes(t) {
  const d = await api.get(`EntityDefinitions(LogicalName='${t}')/Attributes?$select=LogicalName`);
  existingAttrs[t] = new Set(d.value.map((a) => a.LogicalName));
}

const newTables = new Set();
async function ensureTables() {
  for (const t of schema.tables) {
    const r = await api.request('GET', `EntityDefinitions(LogicalName='${t.logicalName}')?$select=LogicalName,EntitySetName`, undefined, { allow404: true });
    if (r.status !== 404) { exists(`tabla ${t.logicalName}`); await loadAttributes(t.logicalName); continue; }
    if (DRY) { wouldCreate(`tabla ${t.schemaName} (${t.ownershipType}, auditoría ${t.isAuditEnabled ? 'sí' : 'no'})`); existingAttrs[t.logicalName] = new Set(); continue; }
    const p = t.primaryName;
    const body = {
      '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
      SchemaName: t.schemaName, EntitySetName: t.entitySetName,
      DisplayName: label(t.displayName), DisplayCollectionName: label(t.displayCollectionName), Description: label(t.description),
      OwnershipType: t.ownershipType, IsActivity: false, HasActivities: false, HasNotes: false,
      IsAuditEnabled: { Value: t.isAuditEnabled, CanBeChanged: true, ManagedPropertyLogicalName: 'canmodifyauditsettings' },
      Attributes: [{ ...attributeBody({ ...p, type: 'String', format: 'Text' }), IsPrimaryName: true }],
    };
    log(`[creando] tabla ${t.schemaName}…`);
    await api.request('POST', 'EntityDefinitions', body, { inSolution: true });
    created(`tabla ${t.schemaName} (${t.entitySetName})`);
    newTables.add(t.logicalName);
    await loadAttributes(t.logicalName);
  }
}

async function ensureColumns() {
  for (const t of schema.tables) {
    for (const c of t.columns) {
      if (c.type === 'Lookup') continue;
      const what = `columna ${t.logicalName}.${c.logicalName} (${c.type}${c.globalOptionSet ? ' ' + c.globalOptionSet : ''})`;
      if (existingAttrs[t.logicalName]?.has(c.logicalName)) { exists(what); continue; }
      if (DRY) { wouldCreate(what); continue; }
      await api.request('POST', `EntityDefinitions(LogicalName='${t.logicalName}')/Attributes`, attributeBody(c), { inSolution: true });
      existingAttrs[t.logicalName].add(c.logicalName);
      created(what);
    }
  }
}

async function ensureLookups() {
  for (const t of schema.tables) {
    for (const c of t.columns) {
      if (c.type !== 'Lookup') continue;
      const what = `búsqueda ${t.logicalName}.${c.logicalName} → ${c.target} [${c.cascade}] (${c.relationshipSchemaName})`;
      const rel = await api.request('GET', `RelationshipDefinitions(SchemaName='${c.relationshipSchemaName}')?$select=SchemaName`, undefined, { allow404: true });
      if (rel.status !== 404 || existingAttrs[t.logicalName]?.has(c.logicalName)) {
        if (rel.status === 404) warn(`${t.logicalName}.${c.logicalName} existe pero la relación ${c.relationshipSchemaName} no; revisar.`);
        exists(what); continue;
      }
      if (DRY) { wouldCreate(what); continue; }
      const target = schema.tables.find((x) => x.logicalName === c.target);
      await api.request('POST', 'RelationshipDefinitions', {
        '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
        SchemaName: c.relationshipSchemaName,
        ReferencedEntity: c.target, ReferencedAttribute: target?.primaryIdAttribute || primaryKeyOf(c.target),
        ReferencingEntity: t.logicalName,
        CascadeConfiguration: schema.cascadeTemplates[c.cascade],
        AssociatedMenuConfiguration: { Behavior: 'UseCollectionName', Group: 'Details', Label: label(t.displayCollectionName), Order: 10000 },
        Lookup: {
          '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
          SchemaName: c.schemaName, DisplayName: label(c.displayName), Description: label(c.displayName), RequiredLevel: reqLevel(c.requiredLevel),
        },
      }, { inSolution: true });
      existingAttrs[t.logicalName].add(c.logicalName);
      created(what);
    }
  }
}

async function ensureKeys() {
  for (const t of schema.tables) for (const k of t.keys) {
    const what = `clave alternativa ${t.logicalName}.${k.logicalName} (${k.keyAttributes.join(', ')})`;
    if (!existingAttrs[t.logicalName]?.size && DRY) { wouldCreate(what); continue; }
    const d = await api.get(`EntityDefinitions(LogicalName='${t.logicalName}')/Keys?$select=LogicalName,EntityKeyIndexStatus`);
    const f = d.value.find((x) => x.LogicalName === k.logicalName);
    if (f) { exists(`${what} [${f.EntityKeyIndexStatus}]`); continue; }
    if (DRY) { wouldCreate(what); continue; }
    await api.request('POST', `EntityDefinitions(LogicalName='${t.logicalName}')/Keys`, {
      '@odata.type': 'Microsoft.Dynamics.CRM.EntityKeyMetadata',
      SchemaName: k.schemaName, DisplayName: label(k.displayName), KeyAttributes: k.keyAttributes,
    }, { inSolution: true });
    created(`${what} (el índice se construye en segundo plano)`);
  }
}

async function ensureAutoNumberSeed() {
  for (const t of schema.tables) {
    const p = t.primaryName;
    if (!p.autoNumberFormat || p.autoNumberSeed === undefined) continue;
    if (DRY && !existingAttrs[t.logicalName]?.size) { wouldCreate(`semilla de autonumeración ${t.logicalName}.${p.logicalName} = ${p.autoNumberSeed}`); continue; }
    const rows = await api.get(`${t.entitySetName}?$select=${t.primaryIdAttribute}&$top=1`);
    if (rows.value.length) { exists(`semilla de autonumeración (la tabla ya tiene filas)`); continue; }
    const next = (await api.request('POST', 'GetAutoNumberSeed', { EntityName: t.logicalName, AttributeName: p.logicalName })).data;
    if (Number(next.AutoNumberSeedValue) === p.autoNumberSeed) { exists(`semilla de autonumeración ${t.logicalName}.${p.logicalName} = ${p.autoNumberSeed}`); continue; }
    if (DRY) { wouldCreate(`semilla de autonumeración ${t.logicalName}.${p.logicalName} = ${p.autoNumberSeed} (hoy ${next.AutoNumberSeedValue})`); continue; }
    await api.request('POST', 'SetAutoNumberSeed', { EntityName: t.logicalName, AttributeName: p.logicalName, Value: p.autoNumberSeed });
    stats.actualizados++; log(`[ajuste]  semilla de autonumeración ${t.logicalName}.${p.logicalName} = ${p.autoNumberSeed}`);
  }
}


// Al crear la tabla, Dataverse ignora a veces MaxLength y RequiredLevel del atributo primario
// (queda en 850 / None). Se corrigen con PUT (solo componentes vu_*).
async function reconcilePrimaryNames() {
  for (const t of schema.tables) {
    const p = t.primaryName;
    const path = `EntityDefinitions(LogicalName='${t.logicalName}')/Attributes(LogicalName='${p.logicalName}')`;
    if (DRY && !existingAttrs[t.logicalName]?.size) continue;
    const r = await api.request('GET', `${path}/Microsoft.Dynamics.CRM.StringAttributeMetadata`, undefined, { allow404: true });
    if (r.status === 404) continue;
    const a = r.data;
    if (a.MaxLength === p.maxLength && a.RequiredLevel?.Value === p.requiredLevel) { exists(`atributo primario ${t.logicalName}.${p.logicalName}`); continue; }
    const what = `atributo primario ${t.logicalName}.${p.logicalName}: MaxLength ${a.MaxLength}→${p.maxLength}, RequiredLevel ${a.RequiredLevel?.Value}→${p.requiredLevel}`;
    if (DRY) { wouldCreate('ajuste ' + what); continue; }
    const body = { ...a, MaxLength: p.maxLength, RequiredLevel: reqLevel(p.requiredLevel) };
    delete body['@odata.context'];
    body['@odata.type'] = 'Microsoft.Dynamics.CRM.StringAttributeMetadata';
    await api.request('PUT', path, body, { inSolution: true, headers: { 'MSCRM.MergeLabels': 'true' } });
    stats.actualizados++; log(`[ajuste]  ${what}`);
  }
}

// Si schema.json cambia el RequiredLevel de una columna que ya existe (p. ej. vu_responsableid
// pasó a opcional al importar el catálogo), se ajusta con PUT.
const METADATA_TYPE = {
  String: 'StringAttributeMetadata', Memo: 'MemoAttributeMetadata', Integer: 'IntegerAttributeMetadata',
  Decimal: 'DecimalAttributeMetadata', Boolean: 'BooleanAttributeMetadata', DateTime: 'DateTimeAttributeMetadata',
  Picklist: 'PicklistAttributeMetadata', File: 'FileAttributeMetadata', Lookup: 'LookupAttributeMetadata',
};
async function reconcileRequiredLevels() {
  for (const t of schema.tables) {
    for (const c of t.columns) {
      if (!existingAttrs[t.logicalName]?.has(c.logicalName)) continue;
      const cast = `Microsoft.Dynamics.CRM.${METADATA_TYPE[c.type]}`;
      const path = `EntityDefinitions(LogicalName='${t.logicalName}')/Attributes(LogicalName='${c.logicalName}')`;
      const a = await api.get(`${path}/${cast}`);
      if (a.RequiredLevel?.Value === c.requiredLevel) continue;
      const what = `RequiredLevel ${t.logicalName}.${c.logicalName}: ${a.RequiredLevel?.Value}→${c.requiredLevel}`;
      if (DRY) { wouldCreate('ajuste ' + what); continue; }
      const body = { ...a, RequiredLevel: reqLevel(c.requiredLevel) };
      delete body['@odata.context'];
      body['@odata.type'] = cast;
      await api.request('PUT', path, body, { inSolution: true, headers: { 'MSCRM.MergeLabels': 'true' } });
      stats.actualizados++; log(`[ajuste]  ${what}`);
    }
  }
}

// ---------------------------------------------------------------- roles
const RIGHT_ORDER = ['Basic', 'Local', 'Deep', 'Global'];
function desiredPrivileges(role) {
  const m = new Map(); // privilegeName → depth
  for (const p of role.privileges) for (const e of p.entities) for (const r of p.rights) {
    const name = `prv${r}${e}`, prev = m.get(name);
    if (!prev || RIGHT_ORDER.indexOf(p.depth) > RIGHT_ORDER.indexOf(prev)) m.set(name, p.depth);
  }
  return m;
}

async function ensureRoles(solutionId) {
  const root = (await api.get(`businessunits?$select=businessunitid,name&$filter=_parentbusinessunitid_value eq null`)).value[0];
  const privs = await api.getAll(`privileges?$select=privilegeid,name&$filter=contains(name,'vu_')`);
  const privByName = new Map(privs.map((p) => [p.name.toLowerCase(), p.privilegeid]));
  const comps = solutionId ? await api.getAll(`solutioncomponents?$select=objectid&$filter=_solutionid_value eq ${solutionId} and componenttype eq 20`) : [];
  const inSol = new Set(comps.map((c) => c.objectid));

  for (const role of schema.roles) {
    let roleId;
    const found = await api.get(`roles?$select=roleid,name&$filter=name eq '${q(role.name)}' and _businessunitid_value eq ${root.businessunitid}`);
    if (found.value.length) { roleId = found.value[0].roleid; exists(`rol ${role.name}`); }
    else if (DRY) { wouldCreate(`rol ${role.name} en ${root.name}`); }
    else {
      const res = await api.request('POST', 'roles', { name: role.name, description: role.description, 'businessunitid@odata.bind': `/businessunits(${root.businessunitid})` }, { inSolution: true });
      roleId = api.idFromHeaders(res.headers);
      created(`rol ${role.name}`);
    }

    const desired = desiredPrivileges(role);
    let current = new Map();
    if (roleId) {
      const rp = await api.get(`RetrieveRolePrivilegesRole(RoleId=${roleId})`);
      current = new Map((rp.RolePrivileges || []).map((p) => [String(p.PrivilegeId).toLowerCase(), p.Depth]));
    }
    const toAdd = [];
    for (const [name, depth] of desired) {
      const pid = privByName.get(name.toLowerCase());
      if (!pid) { if (DRY) continue; throw new Error(`No existe el privilegio ${name}`); }
      if (current.get(pid.toLowerCase()) !== depth) toAdd.push({ PrivilegeId: pid, Depth: depth, BusinessUnitId: root.businessunitid, name });
    }
    if (!roleId) wouldCreate(`${desired.size} privilegios para ${role.name}`);
    else if (!toAdd.length) exists(`privilegios de ${role.name} (${desired.size})`);
    else if (DRY) wouldCreate(`${toAdd.length} privilegios para ${role.name}`);
    else {
      await api.request('POST', `roles(${roleId})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: toAdd.map(({ name, ...p }) => p) });
      stats.actualizados++; log(`[ajuste]  ${toAdd.length} privilegios en ${role.name}`);
    }

    if (roleId && solutionId && !inSol.has(roleId)) {
      if (DRY) { wouldCreate(`componente rol ${role.name} en la solución`); continue; }
      await api.request('POST', 'AddSolutionComponent', { ComponentId: roleId, ComponentType: 20, SolutionUniqueName: SOL, AddRequiredComponents: false, DoNotIncludeSubcomponents: false });
      created(`componente rol ${role.name} en la solución ${SOL}`);
    } else if (roleId) exists(`rol ${role.name} en la solución`);
  }
}

// ---------------------------------------------------------------- pertenencia a la solución (red de seguridad)
async function ensureSolutionMembership(solutionId) {
  if (!solutionId) return;
  const comps = await api.getAll(`solutioncomponents?$select=objectid,componenttype&$filter=_solutionid_value eq ${solutionId}`);
  const have = new Set(comps.map((c) => `${c.componenttype}:${c.objectid}`));
  const add = async (type, id, what) => {
    if (have.has(`${type}:${id}`)) { exists(`${what} en la solución`); return; }
    if (DRY) { wouldCreate(`componente ${what} en la solución`); return; }
    await api.request('POST', 'AddSolutionComponent', { ComponentId: id, ComponentType: type, SolutionUniqueName: SOL, AddRequiredComponents: false, DoNotIncludeSubcomponents: false });
    created(`componente ${what} en la solución`);
  };
  for (const os of schema.globalOptionSets) if (globalOptionSetIds[os.name]) await add(9, globalOptionSetIds[os.name], `opción global ${os.name}`);
  for (const t of schema.tables) {
    const r = await api.request('GET', `EntityDefinitions(LogicalName='${t.logicalName}')?$select=MetadataId`, undefined, { allow404: true });
    if (r.status !== 404) await add(1, r.data.MetadataId, `tabla ${t.logicalName}`);
  }
}

// ---------------------------------------------------------------- publicación
async function publish() {
  const xml = `<importexportxml><entities>${schema.tables.map((t) => `<entity>${t.logicalName}</entity>`).join('')}</entities>`
    + `<optionsets>${schema.globalOptionSets.map((o) => `<optionset>${o.name}</optionset>`).join('')}</optionsets></importexportxml>`;
  if (DRY) { log('[dry-run] publicaría las personalizaciones (PublishXml)'); return; }
  if (stats.creados === 0 && stats.actualizados === 0) { log('[publicar] sin cambios; no hace falta publicar'); return; }
  log('[publicar] PublishXml de tablas y opciones vu_…');
  await api.request('POST', 'PublishXml', { ParameterXml: xml });
  log('[publicar] listo');
}

// ---------------------------------------------------------------- main
(async () => {
  log(`Entorno: ${args.org}${DRY ? '  (DRY-RUN: no se escribe nada)' : ''}`);
  const who = await api.get('WhoAmI');
  log(`Usuario: ${who.UserId}  Organización: ${who.OrganizationId}`);
  const publisherId = await ensurePublisher();
  const solutionId = publisherId ? await ensureSolution(publisherId) : (DRY ? null : null);
  if (!DRY && !solutionId) throw new Error('No se pudo obtener la solución');
  await ensureGlobalOptionSets();
  await ensureTables();
  await reconcilePrimaryNames();
  await ensureColumns();
  await ensureLookups();
  await reconcileRequiredLevels();
  await ensureKeys();
  await ensureAutoNumberSeed();
  await ensureSolutionMembership(solutionId);
  await publish();
  await ensureRoles(solutionId);
  log(`Resumen: creados ${stats.creados} · ajustes ${stats.actualizados} · ya existían ${stats.existentes}${DRY ? ` · pendientes (dry-run) ${stats.omitidosDry}` : ''}`);
})().catch((e) => { console.error('\nERROR:', e.message); if (e.body?.error) console.error(JSON.stringify(e.body.error, null, 2).slice(0, 2000)); process.exit(1); });
