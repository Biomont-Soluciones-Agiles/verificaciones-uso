#!/usr/bin/env python3
"""Compara infra/sharepoint/schema/listas.json con el diseño (docs/diseno-verificacion-uso.md).

Revisa, sin conectarse a SharePoint:
  - §2.3: listas, nombres internos de columnas, tipo, formato de fecha, obligatoriedad, 🔎 índices,
    opciones de elección, rangos/decimales/predeterminados numéricos, destino y comportamiento
    de las búsquedas.
  - §2.4 y §2.5: valores de VU_Verificaciones.Estado y VU_Soluciones.EstadoVU.
  - §2.1: listas con historial de versiones.
  - §3.6: grupos y matriz de permisos por categoría de lista.

Uso:  python infra/sharepoint/tools/verificar_esquema.py [--doc RUTA] [--schema RUTA]
Sale con código 1 si encuentra diferencias. Las decisiones tomadas donde el diseño no es
explícito se listan aparte (no son errores).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

AQUI = pathlib.Path(__file__).resolve()
RAIZ_REPO = AQUI.parents[3]
DOC_PREDETERMINADO = RAIZ_REPO / "docs" / "diseno-verificacion-uso.md"
ESQUEMA_PREDETERMINADO = AQUI.parents[1] / "schema" / "listas.json"

LUPA = "\U0001F50E"
ROLES = {"Leer": "Read", "Colaborar": "Contribute", "Editar": "Edit", "Control total": "FullControl", "–": None, "-": None}
COMPORTAMIENTOS = {"cascada": "Cascade", "restringir": "Restrict"}


def seccion(texto: str, inicio: str, fin: str) -> str:
    i = texto.index(inicio)
    j = texto.index(fin, i)
    return texto[i:j]


def celdas(linea: str) -> list[str]:
    return [c.strip() for c in linea.strip().strip("|").split("|")]


def parse_tipo(t: str) -> dict:
    t = t.strip()
    if t.startswith("Una línea"):
        return {"type": "Text"}
    if t.startswith("Varias líneas"):
        return {"type": "Note"}
    if t.startswith("Sí/No"):
        return {"type": "Boolean"}
    if t.startswith("Fecha y hora"):
        return {"type": "DateTime", "format": "DateTime"}
    if t.startswith("Fecha"):
        return {"type": "DateTime", "format": "DateOnly"}
    if t.startswith("Persona"):
        return {"type": "User"}
    if t.startswith("Hipervínculo"):
        return {"type": "URL"}
    if t.startswith("Búsqueda"):
        m = re.match(r"Búsqueda\s*→\s*(VU_\w+)(?:\s*\((\w+)\))?", t)
        if not m:
            return {"type": "?", "raw": t}
        return {"type": "Lookup", "lookupList": m.group(1), "relationshipBehavior": COMPORTAMIENTOS.get(m.group(2) or "")}
    if t.startswith("Elección"):
        m = re.match(r"Elección:\s*(.+)$", t)
        return {"type": "Choice", "choices": [c.strip() for c in m.group(1).split(" / ")] if m else None}
    if t.startswith("Número"):
        d: dict = {"type": "Number"}
        m = re.search(r"(\d+)\s*[–-]\s*(\d+)", t)
        if m:
            d["min"], d["max"] = float(m.group(1)), float(m.group(2))
        m = re.search(r"\((\d+) decimal", t)
        if m:
            d["decimals"] = float(m.group(1))
        m = re.search(r"predeterminado (\d+)", t)
        if m:
            d["default"] = float(m.group(1))
        m = re.search(r"validación:\s*([\d,\s o]+)\)", t)
        if m:
            d["allowed"] = sorted(float(x) for x in re.findall(r"\d+", m.group(1)))
        return d
    return {"type": "?", "raw": t}


def parse_requerido(r: str) -> bool | None:
    r = r.strip()
    if r.startswith("Sí"):
        return True
    if r.startswith("No"):
        return False
    return None


def parse_diccionario(doc: str) -> dict[str, dict]:
    """Devuelve {lista: {"library": bool, "columns": {nombre: {...}}, "orden": [...]}} a partir de §2.3."""
    texto = seccion(doc, "### 2.3", "### 2.4")
    listas: dict[str, dict] = {}
    actual = None
    for linea in texto.splitlines():
        m = re.match(r"^\*\*(Biblioteca )?`(VU_\w+)`\*\*", linea)
        if m:
            actual = {"library": bool(m.group(1)), "columns": {}, "orden": []}
            listas[m.group(2)] = actual
            continue
        if actual is None or not linea.startswith("|") or linea.startswith("|---"):
            continue
        c = celdas(linea)
        if len(c) < 3 or c[0].startswith("Columna"):
            continue
        nombres_txt = c[0].replace("(interna)", "").strip()
        if nombres_txt.startswith("("):  # (Archivo)
            continue
        nombres = [n.strip() for n in nombres_txt.split(",")]
        tipos = [x.strip() for x in c[1].split(", ")] if len(nombres) > 1 and len(c[1].split(", ")) == len(nombres) else [c[1]] * len(nombres)
        reqs = [x.strip() for x in c[2].split("/")] if len(nombres) > 1 and len(c[2].split("/")) == len(nombres) else [c[2]] * len(nombres)
        for nombre, tipo, req in zip(nombres, tipos, reqs):
            indexada = LUPA in nombre
            nombre = nombre.replace(LUPA, "").strip()
            info = parse_tipo(tipo)
            info.update({"required": parse_requerido(req), "indexed": indexada, "raw": tipo})
            actual["columns"][nombre] = info
            actual["orden"].append(nombre)
    return listas


def parse_estados(doc: str) -> list[str]:
    m = re.search(r"Valores de la elección:\s*(.+?)\.\s*$", seccion(doc, "### 2.4", "### 2.5"), re.M)
    return [v.strip() for v in m.group(1).split("·")] if m else []


def parse_estado_vu(doc: str) -> list[str]:
    valores = re.findall(r"\|\s*\*\*([^*]+)\*\*\s*\|", seccion(doc, "### 2.5", "### 2.6"))
    return list(dict.fromkeys(v.strip() for v in valores))


def parse_versionado(doc: str) -> set[str]:
    linea = next(l for l in seccion(doc, "### 2.1", "### 2.2").splitlines() if "historial de versiones" in l)
    return {"VU_" + n for n in re.findall(r"\b(Verificaciones|PuntajesCriterio|Aprobaciones)\b", linea)}


def parse_seguridad(doc: str) -> tuple[list[str], list[str], dict[str, list]]:
    texto = seccion(doc, "### 3.6", "### 3.7")
    filas = [celdas(l) for l in texto.splitlines() if l.startswith("|") and not l.startswith("|---")]
    cabecera, cuerpo = filas[0], filas[1:]
    categorias = cabecera[1:]
    matriz = {f[0]: [ROLES.get(x) if x in ROLES else ROLES.get(x.split(" (")[0], x) for x in f[1:]] for f in cuerpo}
    return cabecera, categorias, matriz


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--doc", type=pathlib.Path, default=DOC_PREDETERMINADO)
    ap.add_argument("--schema", type=pathlib.Path, default=ESQUEMA_PREDETERMINADO)
    args = ap.parse_args()

    doc = args.doc.read_text(encoding="utf-8")
    esquema = json.loads(args.schema.read_text(encoding="utf-8"))
    diferencias: list[str] = []
    decisiones: list[str] = []

    dicc = parse_diccionario(doc)
    listas_json = {l["name"]: l for l in esquema["lists"]}

    # Listas
    n_listas = sum(1 for v in dicc.values() if not v["library"])
    n_bibl = sum(1 for v in dicc.values() if v["library"])
    if (n_listas, n_bibl) != (12, 1):
        diferencias.append(f"El diseño describe {n_listas} listas y {n_bibl} bibliotecas (se esperaban 12 y 1).")
    for faltante in sorted(set(dicc) - set(listas_json)):
        diferencias.append(f"Lista del diseño ausente en el JSON: {faltante}")
    for sobrante in sorted(set(listas_json) - set(dicc)):
        diferencias.append(f"Lista del JSON que no está en el diseño: {sobrante}")
    if [n for n in listas_json if n in dicc] != [n for n in dicc if n in listas_json]:
        decisiones.append("El orden de las listas del JSON difiere del de §2.3 (el JSON va en orden de dependencia).")

    for nombre, ddoc in dicc.items():
        lj = listas_json.get(nombre)
        if lj is None:
            continue
        plantilla = "DocumentLibrary" if ddoc["library"] else "GenericList"
        if lj["template"] != plantilla:
            diferencias.append(f"{nombre}: plantilla {lj['template']}, el diseño indica {plantilla}.")
        cols_json = {c["internalName"]: c for c in lj["columns"]}
        for faltante in [c for c in ddoc["orden"] if c not in cols_json]:
            diferencias.append(f"{nombre}.{faltante}: columna del diseño ausente en el JSON.")
        for sobrante in [c for c in cols_json if c not in ddoc["columns"]]:
            diferencias.append(f"{nombre}.{sobrante}: columna del JSON que no está en el diseño.")
        orden_json = [c for c in cols_json if c in ddoc["columns"]]
        if orden_json != [c for c in ddoc["orden"] if c in cols_json]:
            decisiones.append(f"{nombre}: el orden de las columnas difiere del diseño.")

        for col, d in ddoc["columns"].items():
            j = cols_json.get(col)
            if j is None:
                continue
            et = f"{nombre}.{col}"
            if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,31}", col):
                diferencias.append(f"{et}: el nombre interno no es ASCII o pasa de 32 caracteres.")
            if d["type"] == "?":
                diferencias.append(f"{et}: tipo del diseño no reconocido «{d['raw']}».")
                continue
            if j["type"] != d["type"]:
                diferencias.append(f"{et}: tipo {j['type']}, el diseño indica {d['type']} («{d['raw']}»).")
            if d.get("format") and j.get("format") != d["format"]:
                diferencias.append(f"{et}: formato {j.get('format')}, el diseño indica {d['format']}.")
            if d["required"] is not None and bool(j.get("required")) != d["required"]:
                diferencias.append(f"{et}: required={j.get('required')}, el diseño indica {d['required']}.")
            rel_json = j.get("relationshipBehavior", "None")
            if d["indexed"] and not j.get("indexed"):
                diferencias.append(f"{et}: el diseño la marca 🔎 pero el JSON no la indexa.")
            if j.get("indexed") and not d["indexed"]:
                if j["type"] == "Lookup" and rel_json in ("Cascade", "Restrict"):
                    decisiones.append(f"{et}: índice adicional (lo exige la relación {rel_json}).")
                else:
                    diferencias.append(f"{et}: indexada en el JSON sin 🔎 en el diseño.")
            if d["type"] == "Lookup":
                if j.get("lookupList") != d["lookupList"]:
                    diferencias.append(f"{et}: búsqueda a {j.get('lookupList')}, el diseño indica {d['lookupList']}.")
                if d["relationshipBehavior"]:
                    if rel_json != d["relationshipBehavior"]:
                        diferencias.append(f"{et}: relación {rel_json}, el diseño indica {d['relationshipBehavior']}.")
                else:
                    decisiones.append(f"{et}: relación no indicada en §2.3 → {rel_json}.")
            if d["type"] == "Choice":
                esperadas = d["choices"]
                if esperadas is None and nombre == "VU_Verificaciones" and col == "Estado":
                    esperadas = parse_estados(doc)
                if esperadas is None:
                    diferencias.append(f"{et}: no se pudieron leer las opciones del diseño («{d['raw']}»).")
                elif j.get("choices") != esperadas:
                    expandidas = len(esperadas) == len(j.get("choices", [])) and all(
                        e == c or c.endswith(" " + e) for e, c in zip(esperadas, j["choices"]))
                    if expandidas:
                        decisiones.append(f"{et}: opciones abreviadas en el diseño ({' / '.join(esperadas)}) → {j['choices']}.")
                    else:
                        diferencias.append(f"{et}: opciones {j.get('choices')}, el diseño indica {esperadas}.")
            if d["type"] == "Number":
                for clave in ("min", "max", "decimals", "default"):
                    if clave in d and float(j.get(clave, -1)) != d[clave]:
                        diferencias.append(f"{et}: {clave}={j.get(clave)}, el diseño indica {d[clave]:g}.")
                if "allowed" in d:
                    formula = (j.get("validation") or {}).get("formula", "")
                    valores = sorted(float(x) for x in re.findall(r"=(\d+)", formula))
                    if valores != d["allowed"]:
                        diferencias.append(f"{et}: la validación admite {valores}, el diseño indica {d['allowed']}.")
                extra = [k for k in ("min", "max", "decimals", "default") if k in j and k not in d]
                if extra:
                    decisiones.append(f"{et}: {', '.join(f'{k}={j[k]}' for k in extra)} (no explícito en §2.3).")
            if "default" in j and d["type"] != "Number":
                decisiones.append(f"{et}: valor predeterminado {j['default']!r} (no explícito en §2.3).")

    # §2.4 / §2.5
    estados = parse_estados(doc)
    estado_json = next(c for c in listas_json["VU_Verificaciones"]["columns"] if c["internalName"] == "Estado")["choices"]
    if estados != estado_json:
        diferencias.append(f"VU_Verificaciones.Estado: {estado_json} ≠ §2.4 {estados}.")
    estado_vu = parse_estado_vu(doc)
    estado_vu_json = next(c for c in listas_json["VU_Soluciones"]["columns"] if c["internalName"] == "EstadoVU")["choices"]
    if estado_vu != estado_vu_json:
        diferencias.append(f"VU_Soluciones.EstadoVU: {estado_vu_json} ≠ §2.5 {estado_vu}.")

    # §2.1 versionado
    versionadas = parse_versionado(doc)
    versionadas_json = {l["name"] for l in esquema["lists"] if l.get("enableVersioning")}
    if versionadas != versionadas_json:
        diferencias.append(f"Versionado: JSON {sorted(versionadas_json)} ≠ §2.1 {sorted(versionadas)}.")

    # §3.6 seguridad
    _, categorias, matriz = parse_seguridad(doc)
    grupos_json = {g["name"]: g for g in esquema["security"]["groups"]}
    perfiles = esquema["security"]["profiles"]
    for grupo in [g for g in matriz if g.startswith("VU ")]:
        if grupo not in grupos_json:
            diferencias.append(f"Grupo de §3.6 ausente en el JSON: {grupo}")
    for grupo in grupos_json:
        if grupo not in matriz:
            diferencias.append(f"Grupo del JSON que no está en §3.6: {grupo}")
    for idx, categoria in enumerate(categorias):
        tokens = re.findall(r"\b([A-Z][a-záéíóú]+)\b", categoria.split("(", 1)[1]) if "(" in categoria else re.findall(r"[A-Z][a-z]+", categoria)
        miembros = [n for n in listas_json if any(n[3:].startswith(t) for t in tokens)]
        perfiles_cat = {listas_json[n]["permissionProfile"] for n in miembros}
        if len(perfiles_cat) != 1:
            diferencias.append(f"§3.6 «{categoria}»: las listas {miembros} usan perfiles distintos {sorted(perfiles_cat)}.")
            continue
        perfil = perfiles[perfiles_cat.pop()]
        for grupo, roles in matriz.items():
            esperado = roles[idx]
            if grupo.startswith("Cuenta de servicio"):
                if esquema["security"].get("serviceAccountRole") != esperado:
                    diferencias.append(f"§3.6 cuenta de servicio: {esquema['security'].get('serviceAccountRole')} ≠ {esperado}.")
                continue
            if perfil["breakInheritance"]:
                asignado = next((r["role"] for r in perfil["roles"] if r["group"] == grupo), "(sin definir)")
            else:
                asignado = grupos_json.get(grupo, {}).get("siteRole")
            if asignado != esperado:
                diferencias.append(f"§3.6 «{categoria}» / {grupo}: {asignado} ≠ {esperado}.")

    print(f"Diseño:  {args.doc}")
    print(f"Esquema: {args.schema}")
    print(f"Listas en §2.3: {n_listas} + {n_bibl} biblioteca; columnas: {sum(len(v['columns']) for v in dicc.values())}")
    print()
    if decisiones:
        print(f"Decisiones / notas ({len(decisiones)}):")
        for d in decisiones:
            print(f"  - {d}")
        print()
    if diferencias:
        print(f"DIFERENCIAS ({len(diferencias)}):")
        for d in diferencias:
            print(f"  ✗ {d}")
        return 1
    print("Sin diferencias: el esquema coincide con §2.1, §2.3, §2.4, §2.5 y §3.6 del diseño.")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
