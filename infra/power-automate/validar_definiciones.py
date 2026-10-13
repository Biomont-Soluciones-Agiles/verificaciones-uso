# -*- coding: utf-8 -*-
"""Valida las definiciones de flujos de infra/power-automate contra el diseño.

Uso (desde la raíz del repo):
    python -I infra/power-automate/validar_definiciones.py

Comprueba:
  1. Que todos los *.json de infra/power-automate son JSON válido.
  2. Estructura: runAfter a acciones hermanas existentes, nombres de acción únicos,
     body()/outputs()/actions() a acciones existentes, items() dentro de su Foreach,
     variables inicializadas, parameters() declarados, InitializeVariable solo en el
     nivel superior, Terminate fuera de bucles, connectionName declarado en
     connectionReferences, sin `authentication` en inputs, expresiones con paréntesis,
     corchetes y comillas balanceados.
  3. Columnas: extrae los nombres usados en $filter, $orderby, parámetros item/...,
     body('X')?['...'], items('X')?['...'], triggerOutputs()?['body/...'] y
     ColumnHasChanged, resuelve la lista de SharePoint de cada referencia y los
     compara con los nombres internos de §2.3 de docs/diseno-verificacion-uso.md
     (incluida la subpropiedad según el tipo: Persona, Búsqueda, Elección) y avisa
     de empty() aplicado directamente a columnas numéricas o Id de búsqueda.
  4. Valores de elección: literales escritos en item/<Col>/Value y en $filter, y
     literales de las expresiones que se parecen a un valor válido pero difieren
     (tildes, mayúsculas).
  5. Cada PostItem/PatchItem envía todas las columnas obligatorias (Req. = Sí en §2.3)
     de su lista (el esquema dinámico de Create/Update item las exige).
  6. Si existe infra/sharepoint/schema/listas.json, contrasta las columnas usadas por
     los flujos (existencia, obligatoriedad y valores de elección).
Termina con código 1 si hay errores.
"""
import glob
import json
import os
import re
import sys
import unicodedata

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
CARPETA = os.path.join(RAIZ, "infra", "power-automate")
DOC = os.path.join(RAIZ, "docs", "diseno-verificacion-uso.md")

NATIVAS = {"ID": "number", "Id": "number", "Title": "text", "Created": "date", "Modified": "date",
           "Author": "person", "Editor": "person"}
SUBPROP = {"person": {"Claims", "Email", "DisplayName", "Department", "JobTitle", "Picture"},
           "lookup": {"Id", "Value"},
           "choice": {"Value", "Id"}}
# Propiedades del conector que no son columnas de la lista
PROPS_CONECTOR = {"{Link}", "{Identifier}", "{Name}", "{FilenameWithExtension}", "{Path}", "{FullPath}",
                  "{IsFolder}", "{Thumbnail}", "{HasAttachments}", "{VersionNumber}",
                  "{TriggerWindowStartToken}", "{TriggerWindowEndToken}", "value"}

ESQUEMA_SP = os.path.join(RAIZ, "infra", "sharepoint", "schema", "listas.json")  # opcional
REQUERIDAS = {}  # lista -> columnas obligatorias (Req. = Sí en §2.3)
# Excepciones acordadas con coordinación: (prefijo de acción, lista, columna) que puede omitirse.
# F4: el recordatorio de vencimiento no tiene verificación asociada; VU_Notificaciones.Verificacion
# pasará a ser opcional en el esquema durante la integración.
EXCEPCIONES_REQ = {("Registrar_recordatorio_", "VU_Notificaciones", "Verificacion")}
errores = []
avisos = []


def err(msg):
    errores.append(msg)


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


# ------------------------------------------------------------------ diseño
def leer_diseno():
    with open(DOC, encoding="utf-8") as f:
        texto = f.read()
    sec = texto[texto.index("### 2.3"):texto.index("### 2.4")]
    sec24 = texto[texto.index("### 2.4"):texto.index("### 2.5")]
    listas = {}
    actual = None
    nombre_lista_actual = [None]
    for linea in sec.splitlines():
        m = re.match(r"\*\*(?:Biblioteca )?`(VU_\w+)`\*\*", linea.strip())
        if m:
            actual = listas.setdefault(m.group(1), {})
            nombre_lista_actual[0] = m.group(1)
            continue
        if actual is None or not linea.startswith("|") or linea.startswith("|---"):
            continue
        celdas = [c.strip() for c in linea.strip().strip("|").split("|")]
        if len(celdas) < 2 or celdas[0].startswith("Columna"):
            continue
        nombres = [n.replace("🔎", "").strip() for n in celdas[0].split(",")]
        tipos_celda = [t.strip() for t in celdas[1].split(",")]
        req_celda = [r.strip() for r in celdas[2].split("/")] if len(celdas) > 2 else []
        for i, n in enumerate(nombres):
            if not n or n.startswith("("):
                continue
            tcel = tipos_celda[i] if len(tipos_celda) == len(nombres) else celdas[1]
            actual[n] = tipo_de(tcel, celdas[1])
            rcel = req_celda[i] if len(req_celda) == len(nombres) else (celdas[2] if len(celdas) > 2 else "")
            if rcel.startswith("Sí"):
                REQUERIDAS.setdefault(nombre_lista_actual[0], set()).add(n)
    # valores de Estado (§2.4)
    m = re.search(r"Valores de la elección:\s*(.+)", sec24)
    estado_vals = [v.strip().rstrip(".") for v in m.group(1).split("·")] if m else []
    listas["VU_Verificaciones"]["Estado"] = ("choice", estado_vals)
    return listas


def tipo_de(tcel, completa):
    if "Persona" in tcel:
        return ("person", None)
    if "Búsqueda" in tcel:
        return ("lookup", None)
    if "Elección" in tcel:
        m = re.search(r"Elección:\s*(.+)", completa)
        vals = None
        if m:
            vals = [v.strip() for v in m.group(1).split("/")]
            # "Adopción plena / parcial / baja" -> nombres completos no inferibles: no validar
            if any(len(v.split()) == 1 and v.islower() for v in vals):
                vals = None
        return ("choice", vals)
    if "Sí/No" in tcel:
        return ("bool", None)
    if "Fecha" in tcel:
        return ("date", None)
    if "Número" in tcel:
        return ("number", None)
    return ("text", None)


# ------------------------------------------------------------------ recorrido
def recorrer(acciones, padres, salida):
    """salida[nombre] = (accion, padres, contenedor) ; padres = lista de (nombre, tipo)."""
    for nombre, a in acciones.items():
        if nombre in salida:
            err("nombre de acción duplicado: %s" % nombre)
        salida[nombre] = (a, list(padres), acciones)
        hijos = padres + [(nombre, a.get("type"))]
        if "actions" in a:
            recorrer(a["actions"], hijos, salida)
        if "else" in a and "actions" in a["else"]:
            recorrer(a["else"]["actions"], hijos, salida)
        for caso in (a.get("cases") or {}).values():
            recorrer(caso.get("actions", {}), hijos, salida)
        if "default" in a and "actions" in a["default"]:
            recorrer(a["default"]["actions"], hijos, salida)


def cadenas(obj, ruta=""):
    if isinstance(obj, str):
        yield ruta, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("actions", "else", "cases", "default"):
                continue  # se recorren como acciones propias
            yield from cadenas(v, ruta + "/" + k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from cadenas(v, "%s[%d]" % (ruta, i))


def expresiones(s):
    """Devuelve los fragmentos de expresión de una cadena ('@expr' completa o '@{...}')."""
    if s.startswith("@@"):
        return []
    if s.startswith("@") and not s.startswith("@{"):
        return [s[1:]]
    res = []
    i = 0
    while True:
        i = s.find("@{", i)
        if i < 0:
            break
        j, prof, q = i + 2, 1, False
        while j < len(s) and prof:
            c = s[j]
            if c == "'":
                q = not q
            elif not q and c == "{":
                prof += 1
            elif not q and c == "}":
                prof -= 1
            j += 1
        res.append(s[i + 2:j - 1])
        i = j
    return res


def balanceada(e):
    pila, q = [], False
    pares = {")": "(", "]": "["}
    for c in e:
        if c == "'":
            q = not q
        elif q:
            continue
        elif c in "([":
            pila.append(c)
        elif c in ")]":
            if not pila or pila.pop() != pares[c]:
                return False
    return not pila and not q


# ------------------------------------------------------------------ validación de un flujo
def validar(path, listas):
    rel = os.path.relpath(path, RAIZ)
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    props = doc.get("properties", {})
    d = props.get("definition")
    if not d:
        err("%s: falta properties.definition" % rel)
        return []
    crefs = props.get("connectionReferences", {})
    params = d.get("parameters", {})
    for p in ("$connections", "$authentication"):
        if p not in params:
            err("%s: falta el parámetro %s" % (rel, p))

    acciones = {}
    recorrer(d.get("actions", {}), [], acciones)
    triggers = d.get("triggers", {})
    nombres = set(acciones) | set(triggers)

    def lista_de_param(valor):
        m = re.match(r"^@parameters\('([^']+)'\)$", valor or "")
        if not m:
            return None
        p = params.get(m.group(1))
        if p is None:
            err("%s: parámetro no declarado %s" % (rel, m.group(1)))
            return None
        return p.get("defaultValue")

    # lista asociada a cada acción SharePoint / trigger / bucle / alias
    lista_accion = {}
    usados_conn = set()
    for nombre, (a, padres, cont) in list(acciones.items()) + [(n, (t, [], triggers)) for n, t in triggers.items()]:
        inp = a.get("inputs") if isinstance(a.get("inputs"), dict) else {}
        host = inp.get("host", {})
        if host:
            usados_conn.add(host.get("connectionName"))
            if host.get("connectionName") not in crefs:
                err("%s: %s usa connectionName %s sin connectionReference" % (rel, nombre, host.get("connectionName")))
            if "authentication" in inp:
                err("%s: %s incluye inputs.authentication (PA lo inyecta al guardar)" % (rel, nombre))
            if host.get("connectionName") == "shared_sharepointonline":
                lista = lista_de_param(inp.get("parameters", {}).get("table"))
                if lista:
                    lista_accion[nombre] = lista
    for c in crefs:
        if c not in usados_conn:
            avisos.append("%s: connectionReference %s no se usa" % (rel, c))
    for nombre, (a, padres, cont) in acciones.items():
        if a.get("type") == "Foreach":
            m = re.match(r"^@body\('([^']+)'\)\?\['value'\]$", a.get("foreach", ""))
            if m and m.group(1) in lista_accion:
                lista_accion[nombre] = lista_accion[m.group(1)]
        if a.get("type") == "Compose" and isinstance(a.get("inputs"), str):
            m = re.match(r"^@first\(body\('([^']+)'\)\?\['value'\]\)$", a["inputs"])
            if m and m.group(1) in lista_accion:
                lista_accion[nombre] = lista_accion[m.group(1)]

    # ---- estructura
    for nombre, (a, padres, cont) in acciones.items():
        for previo in (a.get("runAfter") or {}):
            if previo not in cont:
                err("%s: %s.runAfter apunta a %s, que no es una acción hermana" % (rel, nombre, previo))
        if a.get("type") == "InitializeVariable" and padres:
            err("%s: InitializeVariable %s no está en el nivel superior" % (rel, nombre))
        if a.get("type") == "Terminate" and any(t in ("Foreach", "Until") for _, t in padres):
            err("%s: Terminate %s dentro de un bucle" % (rel, nombre))
    variables = {v["name"] for a, _, _ in acciones.values() if a.get("type") == "InitializeVariable"
                 for v in a["inputs"]["variables"]}
    for n, t in triggers.items():
        for c in t.get("conditions", []):
            if not c.get("expression", "").startswith("@"):
                err("%s: condición de desencadenador sin '@': %s" % (rel, c))

    refs = []  # (lista, ruta_columna, origen)

    def revisar_cadenas(nombre, nodo, padres):
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
                # referencias a columnas
                for fn, ref, cadena in re.findall(r"\b(body|items|outputs)\('([^']+)'\)((?:\?\['[^']+'\])+)", e):
                    claves = re.findall(r"\?\['([^']+)'\]", cadena)
                    lista = lista_accion.get(ref)
                    if not lista:
                        continue
                    if fn == "outputs":
                        if acciones.get(ref, ({}, 0, 0))[0].get("type") == "Compose":
                            pass  # alias de un elemento (first(body(...)))
                        elif claves[0].startswith("body/"):
                            claves[0] = claves[0][5:]
                        else:
                            continue
                    if claves[0] == "ColumnHasChanged":
                        if len(claves) > 1:
                            refs.append((lista, claves[1], nombre))
                        continue
                    refs.append((lista, claves[0], nombre))
                for col in re.findall(r"triggerOutputs\(\)\?\['body/([^']+)'\]", e):
                    for tn, t in triggers.items():
                        tl = lista_de_param(t.get("inputs", {}).get("parameters", {}).get("table"))
                        if tl:
                            refs.append((tl, col, nombre))
                # empty() directo sobre una columna: falla en ejecución si la columna es numérica
                for ref, col in re.findall(r"\bempty\(\s*(?:body|items|outputs)\('([^']+)'\)\?\['([^']+)'\]\s*\)", e):
                    if ref in lista_accion:
                        refs.append((lista_accion[ref], col, nombre, None, "empty"))
                for col in re.findall(r"\bempty\(\s*triggerOutputs\(\)\?\['body/([^']+)'\]\s*\)", e):
                    for t in triggers.values():
                        tl = lista_de_param(t.get("inputs", {}).get("parameters", {}).get("table"))
                        if tl:
                            refs.append((tl, col, nombre, None, "empty"))

    for nombre, (a, padres, cont) in acciones.items():
        nodo = {k: v for k, v in a.items() if k not in ("actions", "else", "cases", "default")}
        revisar_cadenas(nombre, nodo, padres + [(nombre, a.get("type"))] if a.get("type") == "Foreach" else padres)
        inp = a.get("inputs") if isinstance(a.get("inputs"), dict) else {}
        lista = lista_accion.get(nombre)
        if inp.get("host", {}).get("operationId") in ("PostItem", "PatchItem") and lista:
            enviadas = {k[5:].split("/")[0] for k in inp.get("parameters", {}) if k.startswith("item/")}
            faltan = sorted(c for c in REQUERIDAS.get(lista, set()) - enviadas
                            if not any(nombre.startswith(pre) and lista == l and c == col
                                       for pre, l, col in EXCEPCIONES_REQ))
            if faltan:
                err("%s: %s (%s en %s) no envía columnas obligatorias: %s"
                    % (rel, nombre, inp["host"]["operationId"], lista, ", ".join(faltan)))
        if inp.get("host", {}).get("connectionName") == "shared_sharepointonline" and lista:
            for k, v in inp.get("parameters", {}).items():
                if k.startswith("item/"):
                    refs.append((lista, k[5:], nombre))
                    if k.endswith("/Value") and isinstance(v, str) and not v.startswith("@") and "@{" not in v:
                        refs.append((lista, k[5:], nombre, v))
                elif k == "$filter":
                    for col, opr in re.findall(r"\b([A-Za-z_]\w*(?:/\w+)?)\s+(eq|ne|lt|le|gt|ge)\b", v):
                        refs.append((lista, col, nombre))
                    for col, val in re.findall(r"\b([A-Za-z_]\w*)\s+(?:eq|ne)\s+'([^'@]*)'", v):
                        refs.append((lista, col + "/Value", nombre, val))
                elif k == "$orderby":
                    for col in re.findall(r"([A-Za-z_]\w*)(?:\s+(?:asc|desc))?", v):
                        if col not in ("asc", "desc"):
                            refs.append((lista, col, nombre))
    for n, t in triggers.items():
        revisar_cadenas(n, t, [])
    return refs


def comprobar_columnas(refs, listas, archivo):
    vistas = set()
    for r in refs:
        lista, ruta, origen = r[0], r[1], r[2]
        valor = r[3] if len(r) > 3 else None
        if ruta in PROPS_CONECTOR or ruta.startswith("{"):
            continue
        partes = ruta.split("/")
        col, sub = partes[0], (partes[1] if len(partes) > 1 else None)
        cols = listas.get(lista)
        if cols is None:
            err("%s: %s usa la lista %s, que no existe en §2.3" % (archivo, origen, lista))
            continue
        tipo = cols.get(col, (NATIVAS.get(col), None)) if col not in NATIVAS else (NATIVAS[col], None)
        if tipo[0] is None:
            err("%s: %s usa la columna %s.%s, que no existe en §2.3" % (archivo, origen, lista, col))
            continue
        if sub and tipo[0] in SUBPROP and sub not in SUBPROP[tipo[0]]:
            err("%s: %s usa %s.%s/%s: subpropiedad no válida para %s" % (archivo, origen, lista, col, sub, tipo[0]))
        if sub and tipo[0] not in SUBPROP:
            err("%s: %s usa %s.%s/%s pero la columna es de tipo %s" % (archivo, origen, lista, col, sub, tipo[0]))
        if valor is not None and tipo[0] == "choice" and tipo[1] and valor not in tipo[1]:
            err("%s: %s escribe/filtra %s.%s = '%s', que no es un valor de la elección %s"
                % (archivo, origen, lista, col, valor, tipo[1]))
        if len(r) > 4 and r[4] == "empty" and (tipo[0] == "number" or sub == "Id"):
            err("%s: %s aplica empty() a %s.%s (numérica): falla en ejecución; use empty(string(coalesce(x, '')))"
                % (archivo, origen, lista, ruta))
        vistas.add("%s.%s" % (lista, col))
    return vistas


def comprobar_esquema_sp(listas, usadas):
    """Contraste opcional con infra/sharepoint/schema/listas.json (si existe): mismas columnas,
    mismas obligatorias y mismos valores de elección que §2.3 para las columnas que usan los flujos."""
    if not os.path.exists(ESQUEMA_SP):
        print("(sin %s: se omite el contraste con el esquema de aprovisionamiento)" % os.path.relpath(ESQUEMA_SP, RAIZ))
        return
    with open(ESQUEMA_SP, encoding="utf-8") as f:
        esquema = {l["name"]: {c["internalName"]: c for c in l.get("columns", [])}
                   for l in json.load(f).get("lists", [])}
    for clave in sorted(usadas):
        lista, col = clave.split(".", 1)
        if col in NATIVAS and col != "Title":
            continue
        c = esquema.get(lista, {}).get(col)
        if c is None:
            err("listas.json: %s.%s (usada por los flujos) no existe en el esquema de aprovisionamiento" % (lista, col))
            continue
        req_doc = col in REQUERIDAS.get(lista, set())
        if bool(c.get("required")) != req_doc:
            err("listas.json: %s.%s required=%s pero §2.3 dice Req.=%s" % (lista, col, c.get("required"), req_doc))
        tipo = listas.get(lista, {}).get(col, (None, None))
        if tipo[0] == "choice" and tipo[1] and c.get("choices") and list(c["choices"]) != list(tipo[1]):
            err("listas.json: %s.%s choices %s difieren de §2.3 %s" % (lista, col, c["choices"], tipo[1]))
    print("Contraste con %s: %d columnas revisadas" % (os.path.relpath(ESQUEMA_SP, RAIZ), len(usadas)))


def comprobar_literales(path, listas, archivo):
    """Literales de expresiones parecidos (sin tildes/mayúsculas) a un valor de elección pero distintos."""
    validos = {}
    for cols in listas.values():
        for t, vals in cols.values():
            for v in vals or []:
                validos.setdefault(norm(v), set()).add(v)
    with open(path, encoding="utf-8") as f:
        texto = f.read()
    # se excluyen las claves de acceso a propiedades (?['clave'])
    for lit in set(re.findall(r"(?<!\[)'([^'\\]{3,40})'", texto)):
        n = norm(lit)
        if n in validos and lit not in validos[n]:
            err("%s: literal '%s' parece el valor de elección %s pero no coincide exactamente"
                % (archivo, lit, sorted(validos[n])))


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass
    archivos = sorted(glob.glob(os.path.join(CARPETA, "**", "*.json"), recursive=True))
    for p in archivos:
        try:
            with open(p, encoding="utf-8") as f:
                json.load(f)
        except Exception as ex:  # noqa: BLE001
            err("%s: JSON inválido: %s" % (os.path.relpath(p, RAIZ), ex))
    print("JSON válidos: %d de %d archivos" % (len(archivos) - len(errores), len(archivos)))
    listas = leer_diseno()
    print("Listas en §2.3: %s" % ", ".join("%s(%d)" % (k, len(v)) for k, v in sorted(listas.items())))
    todas = set()
    for p in archivos:
        if os.path.basename(p) != "definition.json":
            continue
        rel = os.path.relpath(p, RAIZ)
        antes = len(errores)
        refs = validar(p, listas)
        vistas = comprobar_columnas(refs, listas, rel)
        comprobar_literales(p, listas, rel)
        todas |= vistas
        estado = "OK" if len(errores) == antes else "%d error(es)" % (len(errores) - antes)
        print("\n%s: %s" % (rel, estado))
        print("  columnas usadas: %s" % ", ".join(sorted(vistas)))
    print()
    comprobar_esquema_sp(listas, todas)
    for a in avisos:
        print("AVISO: " + a)
    if errores:
        print("\nERRORES:")
        for e in dict.fromkeys(errores):
            print("  - " + e)
        sys.exit(1)
    print("\nSin errores.")


if __name__ == "__main__":
    main()
