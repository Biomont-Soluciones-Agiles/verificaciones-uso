#!/usr/bin/env node
// Compara los metadatos del entorno con schema.json. Termina con código 1 si hay diferencias.
// Uso: node infra/dataverse/verify.mjs [--org URL] [--verbose]
import { schema, parseArgs, createClient, log, labelText, q } from './lib.mjs';

const args = parseArgs();
const api = createClient(args.org);
const diffs = [];
let checks = 0;
const check = (cond, msg) => { checks++; if (!cond) diffs.push(msg); else if (args.verbose) log(`ok  ${msg}`); };
const eq = (where, prop, actual, expected) => check(actual === expected, `${where}: ${prop} = ${JSON.stringify(actual)}, se esperaba ${JSON.stringify(expected)}`);

const TYPE = {
  String: ['String', 'StringAttributeMetadata', 'MaxLength,FormatName,AutoNumberFormat'],
  Memo: ['Memo', 'MemoAttributeMetadata', 'MaxLength'],
  Integer: ['Integer', 'IntegerAttributeMetadata', 'MinValue,MaxValue'],
  Decimal: ['Decimal', 'DecimalAttributeMetadata', 'MinValue,MaxValue,Precision'],
  Boolean: ['Boolean', 'BooleanAttributeMetadata', 'DefaultValue'],
  DateTime: ['DateTime', 'DateTimeAttributeMetadata', 'Format,DateTimeBehavior'],
  Picklist: ['Picklist', 'PicklistAttributeMetadata', 'DefaultFormValue'],
  File: ['Virtual', 'FileAttributeMetadata', 'MaxSizeInKB'],
  Lookup: ['Lookup', 'LookupAttributeMetadata', 'Targets'],
};

function compareOptions(where, actual, expected) {
  const a = (actual || []).map((o) => `${o.Value}=${labelText(o.Label)}`).join(' | ');
  const e = expected.map((o) => `${o.value}=${o.label}`).join(' | ');
  check(a === e, `${where}: opciones [${a}] ≠ [${e}]`);
}

(async () => {
  log(`Verificando ${args.org} contra schema.json`);

  // Publicador y solución
  const pub = (await api.get(`publishers?$select=publisherid,customizationprefix,customizationoptionvalueprefix&$filter=uniquename eq '${q(schema.publisher.uniqueName)}'`)).value[0];
  check(!!pub, `publicador ${schema.publisher.uniqueName} existe`);
  if (pub) { eq('publicador', 'prefijo', pub.customizationprefix, schema.publisher.customizationPrefix); eq('publicador', 'prefijo de opciones', pub.customizationoptionvalueprefix, schema.publisher.customizationOptionValuePrefix); }
  const sol = (await api.get(`solutions?$select=solutionid,_publisherid_value,ismanaged&$filter=uniquename eq '${q(schema.solution.uniqueName)}'`)).value[0];
  check(!!sol, `solución ${schema.solution.uniqueName} existe`);
  if (sol && pub) eq('solución', 'publicador', sol._publisherid_value, pub.publisherid);
  const comps = sol ? await api.getAll(`solutioncomponents?$select=objectid,componenttype,rootcomponentbehavior&$filter=_solutionid_value eq ${sol.solutionid}`) : [];
  const inSol = new Map(comps.map((c) => [`${c.componenttype}:${c.objectid}`, c]));

  // Opciones globales
  for (const os of schema.globalOptionSets) {
    const r = await api.request('GET', `GlobalOptionSetDefinitions(Name='${os.name}')`, undefined, { allow404: true });
    check(r.status !== 404, `opción global ${os.name} existe`);
    if (r.status === 404) continue;
    compareOptions(`opción global ${os.name}`, r.data.Options, os.options);
    check(inSol.has(`9:${r.data.MetadataId}`), `opción global ${os.name} pertenece a la solución`);
  }

  // Tablas
  for (const t of schema.tables) {
    const where = `tabla ${t.logicalName}`;
    const r = await api.request('GET', `EntityDefinitions(LogicalName='${t.logicalName}')?$select=MetadataId,SchemaName,EntitySetName,OwnershipType,IsAuditEnabled,PrimaryNameAttribute,PrimaryIdAttribute,DisplayName,DisplayCollectionName`
      + `&$expand=Keys($select=LogicalName,KeyAttributes,EntityKeyIndexStatus,MetadataId),ManyToOneRelationships($select=SchemaName,ReferencedEntity,ReferencingAttribute,CascadeConfiguration,ReferencingEntityNavigationPropertyName,MetadataId)`, undefined, { allow404: true });
    check(r.status !== 404, `${where} existe`);
    if (r.status === 404) continue;
    const e = r.data;
    eq(where, 'SchemaName', e.SchemaName, t.schemaName);
    eq(where, 'EntitySetName', e.EntitySetName, t.entitySetName);
    eq(where, 'OwnershipType', e.OwnershipType, t.ownershipType);
    eq(where, 'IsAuditEnabled', e.IsAuditEnabled?.Value, t.isAuditEnabled);
    eq(where, 'PrimaryNameAttribute', e.PrimaryNameAttribute, t.primaryName.logicalName);
    eq(where, 'PrimaryIdAttribute', e.PrimaryIdAttribute, t.primaryIdAttribute);
    eq(where, 'DisplayName', labelText(e.DisplayName), t.displayName);
    eq(where, 'DisplayCollectionName', labelText(e.DisplayCollectionName), t.displayCollectionName);
    const entInSol = inSol.get(`1:${e.MetadataId}`);
    check(!!entInSol, `${where} pertenece a la solución`);

    // atributos por tipo
    const cols = [{ ...t.primaryName, type: 'String', format: 'Text' }, ...t.columns];
    const all = (await api.get(`EntityDefinitions(LogicalName='${t.logicalName}')/Attributes?$select=LogicalName,SchemaName,AttributeType,RequiredLevel,DisplayName,MetadataId`)).value;
    const byName = new Map(all.map((a) => [a.LogicalName, a]));
    const detail = {};
    for (const type of new Set(cols.map((c) => c.type))) {
      const [, cast, sel] = TYPE[type];
      let url = `EntityDefinitions(LogicalName='${t.logicalName}')/Attributes/Microsoft.Dynamics.CRM.${cast}?$select=LogicalName,${sel}`;
      if (type === 'Picklist') url += '&$expand=OptionSet($select=Name,IsGlobal,Options),GlobalOptionSet($select=Name)';
      for (const a of (await api.get(url)).value) detail[a.LogicalName] = a;
    }
    for (const c of cols) {
      const w = `${t.logicalName}.${c.logicalName}`;
      const a = byName.get(c.logicalName);
      check(!!a, `${w} existe`);
      if (!a) continue;
      const d = detail[c.logicalName] || {};
      eq(w, 'tipo', a.AttributeType, TYPE[c.type][0]);
      eq(w, 'SchemaName', a.SchemaName, c.schemaName);
      eq(w, 'RequiredLevel', a.RequiredLevel?.Value, c.requiredLevel);
      eq(w, 'DisplayName', labelText(a.DisplayName), c.displayName);
      const attrInSol = inSol.has(`2:${a.MetadataId}`) || (entInSol && entInSol.rootcomponentbehavior === 0);
      check(attrInSol, `${w} pertenece a la solución`);
      switch (c.type) {
        case 'String':
          eq(w, 'MaxLength', d.MaxLength, c.maxLength); eq(w, 'Formato', d.FormatName?.Value, c.format);
          eq(w, 'AutoNumberFormat', d.AutoNumberFormat || undefined, c.autoNumberFormat); break;
        case 'Memo': eq(w, 'MaxLength', d.MaxLength, c.maxLength); break;
        case 'Integer': eq(w, 'MinValue', d.MinValue, c.minValue); eq(w, 'MaxValue', d.MaxValue, c.maxValue); break;
        case 'Decimal': eq(w, 'MinValue', d.MinValue, c.minValue); eq(w, 'MaxValue', d.MaxValue, c.maxValue); eq(w, 'Precision', d.Precision, c.precision); break;
        case 'Boolean': eq(w, 'DefaultValue', d.DefaultValue, c.defaultValue); break;
        case 'DateTime': eq(w, 'Format', d.Format, c.format); eq(w, 'DateTimeBehavior', d.DateTimeBehavior?.Value, c.dateTimeBehavior); break;
        case 'Picklist':
          if (c.defaultValue !== undefined) eq(w, 'DefaultFormValue', d.DefaultFormValue, c.defaultValue);
          if (c.globalOptionSet) eq(w, 'opción global', d.GlobalOptionSet?.Name, c.globalOptionSet);
          else { eq(w, 'opción local', d.OptionSet?.IsGlobal, false); compareOptions(w, d.OptionSet?.Options, c.options); }
          break;
        case 'File': eq(w, 'MaxSizeInKB', d.MaxSizeInKB, c.maxSizeInKB); break;
        case 'Lookup': {
          eq(w, 'Targets', (d.Targets || []).join(','), c.target);
          const rel = e.ManyToOneRelationships.find((x) => x.ReferencingAttribute === c.logicalName);
          check(!!rel, `${w}: relación existe`);
          if (!rel) break;
          eq(w, 'relación SchemaName', rel.SchemaName, c.relationshipSchemaName);
          eq(w, 'ReferencedEntity', rel.ReferencedEntity, c.target);
          eq(w, 'navegación', rel.ReferencingEntityNavigationPropertyName, c.navigationProperty);
          for (const [k, v] of Object.entries(schema.cascadeTemplates[c.cascade])) eq(w, `cascada ${k}`, rel.CascadeConfiguration?.[k], v);
          check(inSol.has(`10:${rel.MetadataId}`) || (entInSol && entInSol.rootcomponentbehavior === 0), `${w}: relación pertenece a la solución`);
        }
      }
    }
    for (const k of t.keys) {
      const f = e.Keys.find((x) => x.LogicalName === k.logicalName);
      check(!!f, `${where}: clave ${k.logicalName} existe`);
      if (!f) continue;
      eq(`${where} clave ${k.logicalName}`, 'KeyAttributes', [...f.KeyAttributes].sort().join(','), [...k.keyAttributes].sort().join(','));
      check(f.EntityKeyIndexStatus === 'Active', `${where}: clave ${k.logicalName} índice ${f.EntityKeyIndexStatus} (se esperaba Active)`);
    }
  }

  // Roles
  const root = (await api.get(`businessunits?$select=businessunitid&$filter=_parentbusinessunitid_value eq null`)).value[0];
  const privs = await api.getAll(`privileges?$select=privilegeid,name&$filter=contains(name,'vu_')`);
  const privName = new Map(privs.map((p) => [p.privilegeid.toLowerCase(), p.name.toLowerCase()]));
  const ORDER = ['Basic', 'Local', 'Deep', 'Global'];
  for (const role of schema.roles) {
    const r = (await api.get(`roles?$select=roleid&$filter=name eq '${q(role.name)}' and _businessunitid_value eq ${root.businessunitid}`)).value[0];
    check(!!r, `rol ${role.name} existe`);
    if (!r) continue;
    check(inSol.has(`20:${r.roleid}`), `rol ${role.name} pertenece a la solución`);
    const desired = new Map();
    for (const p of role.privileges) for (const en of p.entities) for (const rt of p.rights) {
      const n = `prv${rt}${en}`.toLowerCase(), prev = desired.get(n);
      if (!prev || ORDER.indexOf(p.depth) > ORDER.indexOf(prev)) desired.set(n, p.depth);
    }
    const rp = (await api.get(`RetrieveRolePrivilegesRole(RoleId=${r.roleid})`)).RolePrivileges || [];
    const actual = new Map(rp.filter((p) => privName.has(String(p.PrivilegeId).toLowerCase())).map((p) => [privName.get(String(p.PrivilegeId).toLowerCase()), p.Depth]));
    for (const [n, d] of desired) eq(`rol ${role.name}`, n, actual.get(n), d);
    for (const [n, d] of actual) if (!desired.has(n)) check(false, `rol ${role.name}: privilegio extra ${n} (${d})`);
  }

  log(`Comprobaciones: ${checks} · diferencias: ${diffs.length}`);
  for (const d of diffs) console.log('  ✗', d);
  process.exit(diffs.length ? 1 : 0);
})().catch((e) => { console.error('\nERROR:', e.message); process.exit(2); });
