"""Convierte la exportación a Excel de la lista SharePoint "Apps" al JSON que lee importar-apps.mjs.

Uso: python -I infra/dataverse/tools/apps_xlsx_a_json.py <Libro.xlsx> <salida.json>

El JSON contiene datos de negocio (beneficios, CAPEX): no se versiona en el repo.
"""
import datetime
import json
import sys

import openpyxl

MESES = {m: i for i, m in enumerate(
    ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
     "agosto", "septiembre", "octubre", "noviembre", "diciembre"], start=1)}

COLUMNAS = {
    "Título": "nombre", "Proveedor": "proveedor", "Tipo de diseño": "tipoDiseno",
    "Database": "baseDatos", "Dashboard": "dashboard", "Estado": "estadoDesarrollo",
    "Evolución": "evolucion", "Proceso": "tipoProceso", "Resp. Funcional": "area",
    "Beneficio anual S/.": "beneficioAnualPen", "CAPEX S/.": "capexPen", "CAPEX $": "capexUsd",
    "Verificación de uso": "verificacionUso", "Mes verificación": "mesVerificacion",
    "Año Verficación": "anioVerificacion", "Año de implementación": "fechaImplementacion",
    "Resultado VU": "resultadoVu", "Recomendaciones_VU": "recomendaciones",
    "Frecuencia": "Frecuencia", "Cobertura": "Cobertura",
    "Sustitución": "Sustitución", "Satisfacción": "Satisfacción",
}
CRITERIOS = ["Frecuencia", "Cobertura", "Sustitución", "Satisfacción"]


def texto(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def proxima_vu(mes, anio):
    """'Octubre-' + '2026' → '2026-10-01' (día 1 del mes de la próxima VU)."""
    mes, anio = texto(mes), texto(anio)
    if not mes or not anio:
        return None
    n = MESES.get(mes.rstrip("-").strip().lower())
    if not n:
        raise ValueError(f"Mes no reconocido: {mes!r}")
    return f"{int(anio):04d}-{n:02d}-01"


def fecha(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    if v is None:
        return None
    s = str(v).strip()
    if s.isdigit() and len(s) == 4:  # solo el año
        return f"{s}-01-01"
    raise ValueError(f"Fecha de implementación no reconocida: {v!r}")


def main(origen, destino):
    ws = openpyxl.load_workbook(origen, read_only=True, data_only=True).worksheets[0]
    filas = list(ws.iter_rows(values_only=True))
    cabecera = [texto(c) for c in filas[0]]
    faltan = [c for c in COLUMNAS if c not in cabecera]
    if faltan:
        raise SystemExit(f"Faltan columnas en el Excel: {faltan}")
    apps = []
    for fila in filas[1:]:
        r = {COLUMNAS[c]: fila[cabecera.index(c)] for c in COLUMNAS}
        if not texto(r["nombre"]):
            continue
        puntajes = {c: r.pop(c) for c in CRITERIOS}
        realizada = texto(r["verificacionUso"]) == "Realizada"
        if realizada and any(puntajes[c] is None for c in CRITERIOS):
            raise SystemExit(f"{r['nombre']}: VU realizada sin los 4 puntajes")
        dash = texto(r["dashboard"])
        apps.append({
            "nombre": texto(r["nombre"]),
            "proveedor": texto(r["proveedor"]),
            "tipoDiseno": texto(r["tipoDiseno"]),
            "baseDatos": texto(r["baseDatos"]),
            "dashboard": None if dash is None else dash.lower() in ("si", "sí"),
            "estadoDesarrollo": texto(r["estadoDesarrollo"]),
            "evolucion": texto(r["evolucion"]),
            "tipoProceso": texto(r["tipoProceso"]),
            "area": texto(r["area"]),
            "beneficioAnualPen": r["beneficioAnualPen"],
            "capexPen": r["capexPen"],
            "capexUsd": r["capexUsd"],
            "proximaVu": proxima_vu(r["mesVerificacion"], r["anioVerificacion"]),
            "fechaImplementacion": fecha(r["fechaImplementacion"]),
            "resultadoVu": texto(r["resultadoVu"]),
            "vuRealizada": {"puntajes": puntajes, "recomendaciones": texto(r["recomendaciones"])} if realizada else None,
        })
    with open(destino, "w", encoding="utf-8") as f:
        json.dump({"origen": "Lista SharePoint Apps (exportación a Excel)", "apps": apps}, f, ensure_ascii=False, indent=2)
    print(f"{len(apps)} apps -> {destino}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
