import type { FechaHoraISO, FechaISO, Id } from '../../domain/tipos';

/**
 * Utilidades puras de la Web API de Dataverse (sin dependencias del SDK, para poder probarlas).
 * Nombres: `infra/dataverse/schema.json` (entitySetName, navigationProperty, readProperty).
 */

/** Fila tal como la devuelve la Web API (con anotaciones `@OData.Community.Display.V1.FormattedValue`). */
export type Fila = Record<string, unknown>;
/** Cuerpo de creación/actualización (columnas lógicas y `Nav@odata.bind`). */
export type Registro = Record<string, unknown>;

/** EntitySetName de cada tabla (colección de la Web API). */
export const CONJUNTOS = {
  area: 'vu_areas',
  solucion: 'vu_solucions',
  documento: 'vu_documentosolucions',
  criterio: 'vu_criterios',
  pregunta: 'vu_preguntas',
  opcion: 'vu_opcionrespuestas',
  verificacion: 'vu_verificacions',
  entrevista: 'vu_entrevistas',
  respuesta: 'vu_respuestas',
  evidencia: 'vu_evidencias',
  puntaje: 'vu_puntajecriterios',
  aprobacion: 'vu_aprobacions',
  notificacion: 'vu_notificacions',
  usuario: 'systemusers',
} as const;
export type Conjunto = (typeof CONJUNTOS)[keyof typeof CONJUNTOS];

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esGuid(valor: string): boolean {
  return GUID.test(valor);
}

/**
 * Valor de una búsqueda para crear/actualizar: `{"vu_SolucionId@odata.bind": "/vu_solucions(<guid>)"}`.
 * Con `null` se quita la referencia (PATCH con `@odata.bind: null`).
 */
export function bind(navegacion: string, conjunto: Conjunto, id: Id | null): Registro {
  if (id === null) return { [`${navegacion}@odata.bind`]: null };
  if (!esGuid(id)) throw new Error(`"${id}" no es un GUID válido para ${navegacion}.`);
  return { [`${navegacion}@odata.bind`]: `/${conjunto}(${id})` };
}

/** Propiedad de lectura de una búsqueda: `vu_solucionid` → `_vu_solucionid_value`. */
export function propiedadLectura(columna: string): string {
  return `_${columna}_value`;
}

/** GUID de una búsqueda (`_x_value`) o null. */
export function leerId(fila: Fila, columna: string): Id | null {
  const v = fila[propiedadLectura(columna)];
  return typeof v === 'string' && v ? v : null;
}

/** Valor formateado por el servidor (nombre de la búsqueda, etiqueta de opción…). */
export function formateado(fila: Fila, propiedad: string): string | null {
  const v = fila[`${propiedad}@OData.Community.Display.V1.FormattedValue`];
  return typeof v === 'string' ? v : null;
}

/** Nombre visible de una búsqueda (`_x_value@...FormattedValue`). */
export function nombreBusqueda(fila: Fila, columna: string): string | null {
  return formateado(fila, propiedadLectura(columna));
}

export function texto(fila: Fila, columna: string): string {
  const v = fila[columna];
  return typeof v === 'string' ? v : '';
}

export function textoONull(fila: Fila, columna: string): string | null {
  const v = fila[columna];
  return typeof v === 'string' && v !== '' ? v : null;
}

export function numero(fila: Fila, columna: string, predeterminado = 0): number {
  const v = fila[columna];
  return typeof v === 'number' && Number.isFinite(v) ? v : predeterminado;
}

export function numeroONull(fila: Fila, columna: string): number | null {
  const v = fila[columna];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function booleano(fila: Fila, columna: string): boolean {
  return fila[columna] === true;
}

/**
 * Columna *DateOnly*: Dataverse la devuelve como `2026-08-15` (sin zona). Por robustez
 * se acepta también un `2026-08-15T00:00:00Z` y se toma solo la fecha.
 */
export function fechaSolo(fila: Fila, columna: string): FechaISO | null {
  const v = fila[columna];
  if (typeof v !== 'string' || !v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return m ? m[1] : null;
}

/** Valor para escribir una columna *DateOnly*: siempre `yyyy-MM-dd` (o null). */
export function aFechaSolo(fecha: FechaISO | null | undefined): string | null {
  if (!fecha) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: "${fecha}"`);
  return m[1];
}

/** Columna *Fecha y hora* (UTC ISO 8601). */
export function fechaHora(fila: Fila, columna: string): FechaHoraISO | null {
  const v = fila[columna];
  return typeof v === 'string' && v ? v : null;
}

/** Literal OData de texto: comillas simples duplicadas. */
export function literal(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`;
}

/** `$filter` por una búsqueda: `_vu_verificacionid_value eq <guid>`. */
export function filtroPorBusqueda(columna: string, id: Id): string {
  if (!esGuid(id)) throw new Error(`"${id}" no es un GUID válido para filtrar por ${columna}.`);
  return `${propiedadLectura(columna)} eq ${id}`;
}

/** Quita las claves con `undefined` (los cambios parciales solo envían lo modificado). */
export function sinIndefinidos(registro: Registro): Registro {
  return Object.fromEntries(Object.entries(registro).filter(([, v]) => v !== undefined));
}
