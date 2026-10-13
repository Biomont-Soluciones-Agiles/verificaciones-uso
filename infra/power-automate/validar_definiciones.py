# -*- coding: utf-8 -*-
"""Valida las definiciones de flujos de infra/power-automate (conector Microsoft Dataverse)
contra el diseño (docs/diseno-verificacion-uso.md).

Uso (desde la raíz del repo):
    python -I infra/power-automate/validar_definiciones.py [carpeta]

`carpeta` es opcional (por defecto, la carpeta de este script); sirve para validar una copia
alterada sin tocar el repo.

Comprueba:
  1. Que todos los *.json son JSON válido y tienen la forma de un flujo de solución.
  2. Estructura: runAfter a acciones hermanas, body()/outputs()/actions() a acciones existentes,
     items() dentro de su Foreach, variables inicializadas, parameters() declarados,
     InitializeVariable solo en el nivel superior, Terminate fuera de bucles, paréntesis,
     corchetes y comillas balanceados, sin `authentication` en inputs, connectionName
     declarado en connectionReferences (con el nombre lógico acordado) y usado.
  3. Dataverse: cada entityName es el EntitySetName de una tabla de §2.3 (o `systemusers`), el
     disparador usa el nombre lógico singular; las columnas de $select, $filter, $orderby,
     filteringattributes, filterexpression, item/<col>, <Nav>@odata.bind, body()/items()/
     triggerOutputs() existen en esa tabla; las búsquedas se leen como _<col>_value y se
     escriben con @odata.bind hacia la tabla destino correcta.
  4. Valores de opción: literales en $filter, filterexpression, item/<col>, condiciones
     equals(<columna>, N) y variables asociadas a una columna (VARIABLES_COLUMNA).
  5. Cada CreateRecord envía todas las columnas obligatorias (Req. = Sí) sin valor
     predeterminado ni autonumeración.
  6. Fechas solo fecha: no se comparan con cadenas entre comillas ni con marcas de tiempo.
  7. Disparadores esperados según §3.3 (ESPERADOS).
  8. Ninguna referencia al almacenamiento anterior (listas, conector shared_sh…online).
  9. Si existe infra/dataverse/schema.json, contrasta EntitySetName, columnas, valores de
     opción y nombres de navegación (SchemaName) de las búsquedas.
Termina con código 1 si hay errores.
"""
import glob
import json
import os
import re
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CARPETA = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
DOC = os.path.join(RAIZ, "docs", "diseno-verificacion-uso.md")
ESQUEMA_DV = os.path.join(RAIZ, "infra", "dataverse", "schema.json")  # opcional

DV = "shared_commondataserviceforapps"
REFERENCIAS = {DV: "vu_dataverse", "shared_approvals": "vu_approvals",
               "shared_office365": "vu_office365", "shared_teams": "vu_teams"}
OPS_DV = {"ListRecords", "GetItem", "CreateRecord", "UpdateOnlyRecord", "UpdateRecord", "SubscribeWebhookTrigger"}

# Columnas de sistema que existen en toda tabla personalizada
SISTEMA = {"createdon": "datetime", "modifiedon": "datetime", "statecode": "int", "statuscode": "int",
           "createdby": "lookup", "modifiedby": "lookup", "ownerid": "lookup", "versionnumber": "int"}
# systemuser: solo las columnas que usan los flujos
SYSTEMUSER = {"systemuserid", "fullname", "internalemailaddress", "domainname"}

# Variables cuyo valor es un valor de opción de una columna
VARIABLES_COLUMNA = {"varEstadoFinal": ("vu_verificacion", "vu_estado")}

# Disparadores esperados (§3.3): carpeta -> propiedades
ESPERADOS = {
    "F1-AlertaAnticipada": {"tipo": "Recurrence", "frequency": "Day"},
    "F2-EnvioRevision": {"tipo": "dataverse", "message": 3, "entityname": "vu_verificacion",
                         "filteringattributes": "vu_estado", "filterexpression": "vu_estado eq 100000004",
                         "concurrency": 25},
    "F3-EstadoSolucion": {"tipo": "dataverse", "message": 4, "entityname": "vu_verificacion",
                          "filteringattributes": "vu_estado", "filterexpression": None},
    "F4-Vencimiento": {"tipo": "Recurrence", "frequency": "Week"},
}

# Conector del almacenamiento anterior; se arma por partes para que este archivo no lo contenga literal.
ANTERIOR = "share" + "point"

errores = []
avisos = []


def err(msg):
    errores.append(msg)


# ------------------------------------------------------------------ diseño (§2.3)
def leer_diseno():
    with open(DOC, encoding="utf-8") as f:
        texto = f.read()
    sec = texto[texto.index("### 2.3"):texto.index("### 2.4")]
    globales = {}
    for m in re.finditer(r"^\|\s*`(vu_\w+)`\s*\|(.*)\|\s*$", sec, re.M):
        globales[m.group(1)] = {int(v) for v in re.findall(r"\b(1000000\d\d)\b", m.group(2))}
    tablas = {}
    actual = None
    for linea in sec.splitlines():
        m = re.match(r"\*\*`(vu_\w+)`\*\*", linea.strip())
        if m:
            actual = tablas.setdefault(m.group(1), {})
            continue
        if actual is None or not linea.startswith("| vu_"):
            continue
        celdas = [c.strip() for c in linea.strip().strip("|").split("|")]
        col, tipo, req = celdas[0], celdas[1], celdas[2]
        info = {"req": req.startswith("Sí"), "tipo": "otro", "opciones": None, "destino": None,
                "predeterminado": "predeterminado" in tipo or "autonumeración" in tipo}
        if tipo.startswith("Búsqueda"):
            info["tipo"] = "lookup"
            info["destino"] = re.search(r"→\s*(\w+)", tipo).group(1)
        elif tipo.startswith("Opción local"):
            info["tipo"] = "choice"
            info["opciones"] = {int(v) for v in re.findall(r"\b(1000000\d\d)\b", tipo)}
        elif tipo.startswith("Opción global"):
            info["tipo"] = "choice"
            g = re.search(r"`(vu_\w+)`", tipo).group(1)
            info["opciones"] = globales.get(g)
            if info["opciones"] is None:
                err("diseño: la opción global %s de %s no está en la tabla de opciones globales" % (g, col))
        elif "solo fecha" in tipo:
            info["tipo"] = "dateonly"
        elif tipo.startswith("Sí/No"):
            info["tipo"] = "bool"
        elif tipo.startswith("Entero") or tipo.startswith("Decimal"):
            info["tipo"] = "number"
        actual[col] = info
    for t, cols in tablas.items():
        cols.setdefault(t + "id", {"req": False, "tipo": "pk", "opciones": None, "destino": None, "predeterminado": True})
    if not tablas:
        err("diseño: no se pudo leer ninguna tabla de §2.3")
    return tablas


TABLAS = leer_diseno()
CONJUNTOS = {t + "s": t for t in TABLAS}  # EntitySetName por defecto
CONJUNTOS["systemusers"] = "systemuser"
NAVEGACION = {}  # (tabla, nav en minúsculas) -> SchemaName exacto (si hay schema.json)


# ------------------------------------------------------------------ schema.json (opcional)
def leer_esquema_dv():
    if not os.path.exists(ESQUEMA_DV):
        avisos.append("No existe %s: solo se contrasta con §2.3" % os.path.relpath(ESQUEMA_DV, RAIZ))
        return
    try:
        with open(ESQUEMA_DV, encoding="utf-8") as f:
            esquema = json.load(f)
    except Exception as e:  # noqa: BLE001
        err("schema.json no es JSON válido: %s" % e)
        return

    def g(d, *claves):
        for c in claves:
            if c in d:
                return d[c]
        return None

    globales = {}
    for os_ in esquema.get("globalOptionSets", []) if isinstance(esquema, dict) else []:
        globales[os_.get("name")] = {o.get("value") for o in os_.get("options", [])}
    encontradas = 0

    def recorrer(n):
        nonlocal encontradas
        if isinstance(n, dict):
            nombre = g(n, "logicalName", "LogicalName", "logicalname")
            cols = g(n, "columns", "attributes", "Attributes", "columnas")
            if isinstance(nombre, str) and nombre in TABLAS and isinstance(cols, (list, dict)):
                encontradas += 1
                conj = g(n, "entitySetName", "EntitySetName", "collectionName", "entitysetname")
                if conj and conj != nombre + "s":
                    CONJUNTOS.pop(nombre + "s", None)
                    CONJUNTOS[conj] = nombre
                lista = list(cols.values() if isinstance(cols, dict) else cols)
                if isinstance(n.get("primaryName"), dict):
                    lista.append(n["primaryName"])
                vistos = set()
                for c in lista:
                    if not isinstance(c, dict):
                        continue
                    cl = g(c, "logicalName", "LogicalName", "logicalname")
                    sn = g(c, "schemaName", "SchemaName")
                    if not cl and sn:
                        cl = sn.lower()
                    if not cl:
                        continue
                    vistos.add(cl)
                    info = TABLAS[nombre].get(cl)
                    if info is None:
                        err("schema.json: %s.%s no está en §2.3" % (nombre, cl))
                        continue
                    nivel = g(c, "requiredLevel", "RequiredLevel")
                    if nivel is not None and (nivel in ("ApplicationRequired", "SystemRequired")) != info["req"]:
                        err("schema.json: %s.%s tiene requiredLevel %s y §2.3 dice Req. = %s"
                            % (nombre, cl, nivel, "Sí" if info["req"] else "No"))
                    if info["tipo"] == "lookup":
                        nav = g(c, "navigationProperty", "schemaName", "SchemaName")
                        if nav:
                            NAVEGACION[(nombre, cl)] = nav
                        destino = g(c, "target", "Target", "targets")
                        if isinstance(destino, str) and destino != info["destino"]:
                            err("schema.json: %s.%s apunta a %s y §2.3 a %s" % (nombre, cl, destino, info["destino"]))
                    if info.get("opciones"):
                        vals = set()
                        for o in g(c, "options", "Options", "opciones") or []:
                            v = g(o, "value", "Value") if isinstance(o, dict) else o
                            if isinstance(v, int):
                                vals.add(v)
                        gl = g(c, "globalOptionSet", "GlobalOptionSet")
                        if gl:
                            vals = globales.get(gl, set())
                        if vals and vals != info["opciones"]:
                            err("schema.json: valores de %s.%s %s difieren de §2.3 %s"
                                % (nombre, cl, sorted(vals), sorted(info["opciones"])))
                for cl, info in TABLAS[nombre].items():
                    if info["tipo"] != "pk" and vistos and cl not in vistos:
                        err("schema.json: %s.%s (§2.3) no aparece en schema.json" % (nombre, cl))
            for v in n.values():
                recorrer(v)
        elif isinstance(n, list):
            for v in n:
                recorrer(v)

    recorrer(esquema)
    if not encontradas:
        avisos.append("schema.json existe pero no se reconoció su formato: solo se contrasta con §2.3")
    else:
        avisos.append("Contrastado también con %s (%d tablas)" % (os.path.relpath(ESQUEMA_DV, RAIZ), encontradas))


leer_esquema_dv()


# ------------------------------------------------------------------ utilidades
def cadenas(nodo, ruta=""):
    if isinstance(nodo, str):
        yield ruta, nodo
    elif isinstance(nodo, dict):
        for k, v in nodo.items():
            yield from cadenas(v, ruta + "/" + k)
    elif isinstance(nodo, list):
        for i, v in enumerate(nodo):
            yield from cadenas(v, "%s[%d]" % (ruta, i))


def expresiones(s):
    """Expresiones de una cadena: '@expr' completa o cada '@{...}'."""
    if s.startswith("@") and not s.startswith("@{") and not s.startswith("@@"):
        return [s[1:]]
    res = []
    i = 0
    while True:
        i = s.find("@{", i)
        if i < 0:
            return res
        prof, j, en_cad = 0, i + 1, False
        while j < len(s):
            c = s[j]
            if c == "'":
                en_cad = not en_cad
            elif not en_cad and c == "{":
                prof += 1
            elif not en_cad and c == "}":
                prof -= 1
                if prof == 0:
                    break
            j += 1
        res.append(s[i + 2:j])
        i = j


def balanceada(e):
    pila, en_cad = [], False
    for c in e:
        if c == "'":
            en_cad = not en_cad
        elif en_cad:
            continue
        elif c in "([":
            pila.append(c)
        elif c in ")]":
            if not pila or pila.pop() != {")": "(", "]": "["}[c]:
                return False
    return not pila and not en_cad


def recoger_acciones(acts, padres, todas):
    for nombre, a in acts.items():
        if nombre in todas:
            err("acción duplicada: %s" % nombre)
        todas[nombre] = (a, padres, acts)
        hijos = padres + [(nombre, a.get("type"))]
        if "actions" in a:
            recoger_acciones(a["actions"], hijos, todas)
        if "else" in a:
            recoger_acciones(a["else"].get("actions", {}), hijos, todas)
        for caso in (a.get("cases") or {}).values():
            recoger_acciones(caso.get("actions", {}), hijos, todas)
        if "default" in a:
            recoger_acciones(a["default"].get("actions", {}), hijos, todas)


def columna_base(clave):
    """'_vu_x_value' -> ('vu_x', True); 'vu_x@OData...' -> ('vu_x', False)."""
    clave = clave.split("@")[0]
    m = re.match(r"^_(\w+)_value$", clave)
    if m:
        return m.group(1), True
    return clave, False


def comprobar_columna(rel, donde, tabla, clave):
    if tabla == "systemuser":
        if clave.split("@")[0] not in SYSTEMUSER:
            err("%s: %s usa systemuser.%s, que no está entre las columnas admitidas %s"
                % (rel, donde, clave, sorted(SYSTEMUSER)))
        return None
    col, es_valor = columna_base(clave)
    info = TABLAS[tabla].get(col)
    if info is None and col in SISTEMA:
        if es_valor and SISTEMA[col] != "lookup":
            err("%s: %s: _%s_value no es una búsqueda" % (rel, donde, col))
        return {"tipo": SISTEMA[col], "opciones": None}
    if info is None:
        err("%s: %s: la columna %s no existe en %s (§2.3)" % (rel, donde, clave, tabla))
        return None
    if info["tipo"] == "lookup" and not es_valor:
        err("%s: %s: la búsqueda %s.%s se lee como _%s_value" % (rel, donde, tabla, col, col))
    if es_valor and info["tipo"] != "lookup":
        err("%s: %s: %s.%s no es una búsqueda (no existe _%s_value)" % (rel, donde, tabla, col, col))
    return info


def comprobar_opcion(rel, donde, tabla, col, valor):
    if tabla not in TABLAS:
        return
    info = TABLAS[tabla].get(col)
    if not info or not info.get("opciones"):
        return
    if valor not in info["opciones"]:
        err("%s: %s: %s no es un valor válido de %s.%s %s" % (rel, donde, valor, tabla, col, sorted(info["opciones"])))


OP_ODATA = r"(eq|ne|gt|ge|lt|le)"


def comprobar_odata(rel, donde, tabla, texto, orderby=False):
    """Columnas y literales de opción en $filter / $orderby / filterexpression."""
    limpio = re.sub(r"@\{[^}]*\}", "X", texto)
    limpio = re.sub(r"'[^']*'", "''", limpio)
    for tok in re.findall(r"\b(_?[a-z]+_\w+|createdon|modifiedon|statecode|statuscode)\b", limpio):
        comprobar_columna(rel, donde, tabla, tok)
    if orderby:
        return
    for col, opx, val in re.findall(r"\b(vu_\w+)\s+" + OP_ODATA + r"\s+(\d+)\b", limpio):
        comprobar_opcion(rel, donde, tabla, col, int(val))
    # fechas solo fecha
    for col, opx, rhs in re.findall(r"\b(vu_\w+)\s+" + OP_ODATA + r"\s+(\S+)", re.sub(r"'[^']*'", "'Q'", texto)):
        info = TABLAS.get(tabla, {}).get(col)
        if info and info["tipo"] == "dateonly":
            if rhs.startswith("'") or "T" in re.sub(r"@\{[^}]*\}", "", rhs):
                err("%s: %s: %s es solo fecha; compárela con yyyy-MM-dd sin comillas ni hora (%s)"
                    % (rel, donde, col, rhs))
        if info and info["tipo"] == "bool" and rhs not in ("true", "false"):
            err("%s: %s: %s es Sí/No; compárela con true/false" % (rel, donde, col))


# ------------------------------------------------------------------ validación de un flujo
def validar(ruta):
    rel = os.path.relpath(ruta, CARPETA)
    carpeta = os.path.basename(os.path.dirname(ruta))
    try:
        with open(ruta, encoding="utf-8") as f:
            texto = f.read()
        flujo = json.loads(texto)
    except Exception as e:  # noqa: BLE001
        err("%s: JSON inválido: %s" % (rel, e))
        return
    if re.search(ANTERIOR, texto, re.I):
        err("%s: contiene referencias al almacenamiento anterior (%s)" % (rel, ANTERIOR))
    props = flujo.get("properties", {})
    d = props.get("definition")
    if not isinstance(d, dict) or "triggers" not in d or "actions" not in d:
        err("%s: falta properties.definition con triggers y actions" % rel)
        return
    if flujo.get("schemaVersion") != "1.0.0.0":
        err("%s: schemaVersion debe ser 1.0.0.0" % rel)
    crefs = props.get("connectionReferences", {})
    for k, v in crefs.items():
        esperado = REFERENCIAS.get(k)
        real = v.get("connection", {}).get("connectionReferenceLogicalName")
        if esperado is None:
            err("%s: connectionReference %s no es una de las acordadas %s" % (rel, k, sorted(REFERENCIAS)))
        elif real != esperado:
            err("%s: connectionReference %s debe usar el nombre lógico %s (tiene %s)" % (rel, k, esperado, real))
        if v.get("api", {}).get("name") != k:
            err("%s: connectionReference %s: api.name debe ser %s" % (rel, k, k))
    params = set(d.get("parameters", {}))
    triggers = d["triggers"]
    acciones = {}
    recoger_acciones(d["actions"], [], acciones)
    if len(triggers) != 1:
        err("%s: debe tener exactamente un disparador" % rel)

    usados = set()
    tabla_accion = {}  # acción (o bucle) -> tabla lógica

    def revisar_host(nombre, a):
        inp = a.get("inputs")
        if not isinstance(inp, dict):
            return None
        if "authentication" in inp:
            err("%s: %s lleva inputs.authentication (lo añade Power Automate al guardar)" % (rel, nombre))
        host = inp.get("host")
        if not host:
            return None
        cn = host.get("connectionName")
        usados.add(cn)
        if cn not in crefs:
            err("%s: %s usa la conexión %s, que no está en connectionReferences" % (rel, nombre, cn))
        if host.get("apiId") != "/providers/Microsoft.PowerApps/apis/%s" % cn:
            err("%s: %s: apiId no coincide con %s" % (rel, nombre, cn))
        return host

    # ---- disparador
    for tn, t in triggers.items():
        host = revisar_host(tn, t)
        esp = ESPERADOS.get(carpeta)
        if host and host.get("connectionName") == DV:
            if host.get("operationId") != "SubscribeWebhookTrigger" or t.get("type") != "OpenApiConnectionWebhook":
                err("%s: el disparador Dataverse debe ser OpenApiConnectionWebhook / SubscribeWebhookTrigger" % rel)
            p = t["inputs"].get("parameters", {})
            ent = p.get("subscriptionRequest/entityname")
            if ent not in TABLAS:
                err("%s: entityname del disparador (%s) debe ser el nombre lógico singular de una tabla de §2.3" % (rel, ent))
            else:
                tabla_accion["@trigger"] = ent
                for c in (p.get("subscriptionRequest/filteringattributes") or "").split(","):
                    if c.strip():
                        info = comprobar_columna(rel, tn + ".filteringattributes", ent, c.strip())
                        if info and info["tipo"] == "lookup":
                            err("%s: %s: las búsquedas no se admiten en filteringattributes" % (rel, tn))
                fe = p.get("subscriptionRequest/filterexpression")
                if fe:
                    comprobar_odata(rel, tn + ".filterexpression", ent, fe)
            if p.get("subscriptionRequest/message") not in range(1, 8):
                err("%s: subscriptionRequest/message debe estar entre 1 y 7" % rel)
            if p.get("subscriptionRequest/scope") not in (1, 2, 3, 4):
                err("%s: subscriptionRequest/scope debe estar entre 1 y 4" % rel)
            if esp and esp["tipo"] == "dataverse":
                for k in ("message", "entityname", "filteringattributes", "filterexpression"):
                    if p.get("subscriptionRequest/" + k) != esp[k]:
                        err("%s: §3.3 exige subscriptionRequest/%s = %r (tiene %r)"
                            % (rel, k, esp[k], p.get("subscriptionRequest/" + k)))
                if p.get("subscriptionRequest/scope") != 4:
                    err("%s: el disparador debe tener scope 4 (Organization)" % rel)
                if "concurrency" in esp and t.get("runtimeConfiguration", {}).get("concurrency", {}).get("runs") != esp["concurrency"]:
                    err("%s: la concurrencia del disparador debe ser %s" % (rel, esp["concurrency"]))
        elif esp:
            if esp["tipo"] != t.get("type") or t.get("recurrence", {}).get("frequency") != esp.get("frequency"):
                err("%s: §3.3 exige un disparador %s %s" % (rel, esp["tipo"], esp.get("frequency", "")))
            if t.get("recurrence", {}).get("timeZone") != "SA Pacific Standard Time":
                err("%s: la recurrencia debe usar la zona SA Pacific Standard Time (Lima)" % rel)

    # ---- acciones Dataverse
    for nombre, (a, padres, cont) in acciones.items():
        host = revisar_host(nombre, a)
        if not host:
            continue
        if host.get("connectionName") != DV:
            continue
        opid = host.get("operationId")
        if opid not in OPS_DV:
            err("%s: %s: operación Dataverse no prevista %s" % (rel, nombre, opid))
        if opid == "UpdateRecord":
            avisos.append("%s: %s usa UpdateRecord (Upsert); se recomienda UpdateOnlyRecord" % (rel, nombre))
        p = a["inputs"].get("parameters", {})
        conj = p.get("entityName")
        tabla = CONJUNTOS.get(conj)
        if tabla is None:
            sugerencia = " (¿%s?)" % (conj + "s") if conj in TABLAS else ""
            err("%s: %s: entityName %r no es el EntitySetName de ninguna tabla%s" % (rel, nombre, conj, sugerencia))
            continue
        tabla_accion[nombre] = tabla
        if opid in ("GetItem", "UpdateOnlyRecord", "UpdateRecord") and not p.get("recordId"):
            err("%s: %s: falta recordId" % (rel, nombre))
        for c in (p.get("$select") or "").split(","):
            if c.strip():
                comprobar_columna(rel, nombre + ".$select", tabla, c.strip())
        if p.get("$filter"):
            comprobar_odata(rel, nombre + ".$filter", tabla, p["$filter"])
        if p.get("$orderby"):
            comprobar_odata(rel, nombre + ".$orderby", tabla, re.sub(r"\b(asc|desc)\b", "", p["$orderby"]), orderby=True)
        if tabla == "systemuser":
            if any(k.startswith("item/") for k in p):
                err("%s: %s: los flujos no escriben en systemuser" % (rel, nombre))
            continue
        enviados = set()
        for k, v in p.items():
            if not k.startswith("item/"):
                continue
            clave = k[5:]
            if clave.endswith("@odata.bind"):
                nav = clave[:-len("@odata.bind")]
                col = nav.lower()
                info = TABLAS[tabla].get(col)
                if not info or info["tipo"] != "lookup":
                    err("%s: %s: %s no corresponde a ninguna búsqueda de %s" % (rel, nombre, nav, tabla))
                    continue
                exacto = NAVEGACION.get((tabla, col))
                if exacto and exacto != nav:
                    err("%s: %s: el nombre de navegación de %s.%s es %s (no %s)" % (rel, nombre, tabla, col, exacto, nav))
                m = re.match(r"^/(\w+)\(", str(v))
                destino = CONJUNTOS.get(m.group(1)) if m else None
                if destino != info["destino"]:
                    err("%s: %s: %s debe enlazar /%s(<guid>) (tiene %s)"
                        % (rel, nombre, nav, [c for c, t in CONJUNTOS.items() if t == info["destino"]], v))
                enviados.add(col)
                continue
            info = TABLAS[tabla].get(clave)
            if info is None:
                err("%s: %s: item/%s no existe en %s (§2.3)" % (rel, nombre, clave, tabla))
                continue
            if info["tipo"] == "lookup":
                err("%s: %s: la búsqueda %s se escribe con <SchemaName>@odata.bind" % (rel, nombre, clave))
            if info["tipo"] == "pk":
                err("%s: %s: no se escribe la clave primaria %s" % (rel, nombre, clave))
            enviados.add(clave)
            if info.get("opciones"):
                if isinstance(v, bool) or (not isinstance(v, int) and not (isinstance(v, str) and v.startswith("@"))):
                    err("%s: %s: item/%s es una opción: use el valor numérico (tiene %r)" % (rel, nombre, clave, v))
                vals = [v] if isinstance(v, int) and not isinstance(v, bool) else \
                    [int(x) for x in re.findall(r"\b(\d{9})\b", v)] if isinstance(v, str) else []
                for x in vals:
                    comprobar_opcion(rel, nombre + ".item/" + clave, tabla, clave, x)
            if info["tipo"] == "bool" and not isinstance(v, bool) and not (isinstance(v, str) and v.startswith("@")):
                err("%s: %s: item/%s es Sí/No: use true/false" % (rel, nombre, clave))
        if opid == "CreateRecord":
            faltan = [c for c, i in TABLAS[tabla].items() if i["req"] and not i["predeterminado"] and c not in enviados]
            if faltan:
                err("%s: %s: CreateRecord en %s sin las columnas obligatorias %s" % (rel, nombre, tabla, faltan))

    for k in crefs:
        if k not in usados:
            err("%s: connectionReference %s no se usa" % (rel, k))

    # alias: bucles sobre ListRecords
    for nombre, (a, padres, cont) in acciones.items():
        if a.get("type") == "Foreach":
            m = re.match(r"^@body\('([^']+)'\)\?\['value'\]$", a.get("foreach", ""))
            if m and m.group(1) in tabla_accion:
                tabla_accion[nombre] = tabla_accion[m.group(1)]

    # ---- estructura y referencias en expresiones
    nombres = set(acciones)
    variables = {v["name"] for a, _, _ in acciones.values() if a.get("type") == "InitializeVariable"
                 for v in a["inputs"]["variables"]}
    for nombre, (a, padres, cont) in acciones.items():
        for previo in (a.get("runAfter") or {}):
            if previo not in cont:
                err("%s: %s.runAfter apunta a %s, que no es una acción hermana" % (rel, nombre, previo))
        if a.get("type") == "InitializeVariable" and padres:
            err("%s: InitializeVariable %s no está en el nivel superior" % (rel, nombre))
        if a.get("type") == "Terminate" and any(t in ("Foreach", "Until") for _, t in padres):
            err("%s: Terminate %s dentro de un bucle" % (rel, nombre))
        if a.get("type") in ("SetVariable", "InitializeVariable"):
            lista = a["inputs"]["variables"] if a["type"] == "InitializeVariable" else [a["inputs"]]
            for v in lista:
                if v["name"] in VARIABLES_COLUMNA:
                    t, c = VARIABLES_COLUMNA[v["name"]]
                    for x in re.findall(r"\b(\d{9})\b", str(v.get("value"))):
                        comprobar_opcion(rel, nombre, t, c, int(x))

    def tabla_de(fn, ref):
        if fn == "triggerOutputs":
            return tabla_accion.get("@trigger")
        return tabla_accion.get(ref)

    patron_ref = r"\b(body|items|outputs)\('([^']+)'\)\?\['([^']+)'\]|\b(triggerOutputs)\(\)\?\['body/([^']+)'\]"

    def revisar(nombre, nodo, padres):
        bucles = {n for n, t in padres if t == "Foreach"}
        for ruta, s in cadenas(nodo):
            for e in expresiones(s):
                if not balanceada(e):
                    err("%s: %s%s: expresión desbalanceada: %s" % (rel, nombre, ruta, e[:120]))
                for fn, ref in re.findall(r"\b(body|outputs|actions|items|variables|parameters)\('([^']+)'\)", e):
                    if fn in ("body", "outputs", "actions") and ref not in nombres:
                        err("%s: %s referencia la acción inexistente %s" % (rel, nombre, ref))
                    if fn == "items" and ref not in bucles:
                        err("%s: %s usa items('%s') fuera de ese bucle" % (rel, nombre, ref))
                    if fn == "variables" and ref not in variables:
                        err("%s: %s usa la variable no inicializada %s" % (rel, nombre, ref))
                    if fn == "parameters" and ref not in params:
                        err("%s: %s usa el parámetro no declarado %s" % (rel, nombre, ref))
                for m in re.finditer(patron_ref, e):
                    if m.group(4):
                        fn, ref, clave = "triggerOutputs", None, m.group(5)
                    else:
                        fn, ref, clave = m.group(1), m.group(2), m.group(3)
                        if fn == "outputs":
                            continue  # salidas de Compose: alias, no columnas
                    t = tabla_de(fn, ref)
                    if not t or clave in ("value", "SdkMessage", "@odata.etag"):
                        continue
                    info = comprobar_columna(rel, "%s%s" % (nombre, ruta), t, clave)
                    # equals(<columna>, N)
                    resto = e[m.end():]
                    mm = re.match(r"\s*,\s*(\d{9})\s*\)", resto)
                    if info and mm:
                        comprobar_opcion(rel, nombre + ruta, t, columna_base(clave)[0], int(mm.group(1)))
        # condiciones de If en forma de objeto: {"equals": ["@body('X')?['col']", N]}
        def objetos(n):
            if isinstance(n, dict):
                for k, v in n.items():
                    if k in ("equals", "greater", "less", "greaterOrEquals", "lessOrEquals") and isinstance(v, list) and len(v) == 2:
                        izq, der = v
                        if isinstance(izq, str) and isinstance(der, int) and not isinstance(der, bool):
                            m = re.fullmatch(r"@(?:" + patron_ref + r")", izq)
                            if m:
                                if m.group(4):
                                    t, clave = tabla_de("triggerOutputs", None), m.group(5)
                                elif m.group(1) != "outputs":
                                    t, clave = tabla_de(m.group(1), m.group(2)), m.group(3)
                                else:
                                    t = None
                                if t and t in TABLAS:
                                    comprobar_opcion(rel, nombre + ".expression", t, columna_base(clave)[0], der)
                            if izq == "@variables('varEstadoFinal')":
                                comprobar_opcion(rel, nombre + ".expression", "vu_verificacion", "vu_estado", der)
                    objetos(v)
            elif isinstance(n, list):
                for v in n:
                    objetos(v)
        objetos(nodo.get("expression") if isinstance(nodo, dict) else None)

    for nombre, (a, padres, cont) in acciones.items():
        propio = {k: v for k, v in a.items() if k not in ("actions", "else", "cases", "default")}
        revisar(nombre, propio, padres)
    for tn, t in triggers.items():
        revisar(tn, t, [])


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        pass
    rutas = sorted(glob.glob(os.path.join(CARPETA, "**", "*.json"), recursive=True))
    if not rutas:
        err("no hay definiciones en %s" % CARPETA)
    for carpeta in ESPERADOS:
        if not os.path.exists(os.path.join(CARPETA, carpeta, "definition.json")):
            err("falta %s/definition.json" % carpeta)
    for r in rutas:
        validar(r)
    for a in avisos:
        print("AVISO:", a)
    for e in errores:
        print("ERROR:", e)
    print("%d definiciones, %d errores, %d avisos" % (len(rutas), len(errores), len(avisos)))
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
