import type { Criterio, Entrevista, Id, PuntajeCriterio, Respuesta, ResultadoAdopcion } from './tipos';

/** RN-09: umbrales del Excel de verificaciones ("Criterios (validar)"), sobre un máximo de 40. */
export const UMBRAL_USABILIDAD_CONFIRMADA = 30;
export const UMBRAL_USABILIDAD_PARCIAL = 20;
/** Máximo del puntaje de usabilidad: 4 criterios × 10, como la suma del Excel. */
export const PUNTAJE_USABILIDAD_MAXIMO = 40;

export const PUNTAJE_MINIMO = 1;
export const PUNTAJE_MAXIMO = 10;
/** Puntaje final con el que nace cada fila de VU_PuntajesCriterio (la columna es obligatoria). */
export const PUNTAJE_INICIAL = 5;
/** Suma obligatoria de los pesos de los criterios activos. */
export const SUMA_PESOS_REQUERIDA = 100;

export function redondear1(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10) / 10;
}

function iguales(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05;
}

export function esPuntajeValido(valor: number | null | undefined): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= PUNTAJE_MINIMO && valor <= PUNTAJE_MAXIMO;
}

/**
 * RN-04: puntaje sugerido de un criterio = promedio simple (1 decimal) de los puntajes
 * no nulos de las respuestas (definidas y surgidas) que impactan ese criterio,
 * considerando solo las entrevistas **completas**. `null` si no hay datos.
 */
export function puntajeSugerido(
  criterioId: Id,
  respuestas: readonly Pick<Respuesta, 'entrevistaId' | 'criterioId' | 'puntaje'>[],
  entrevistas: readonly Pick<Entrevista, 'id' | 'estado'>[],
): number | null {
  const completas = new Set(entrevistas.filter((e) => e.estado === 'Completa').map((e) => e.id));
  const puntajes = respuestas
    .filter((r) => r.criterioId === criterioId && completas.has(r.entrevistaId))
    .map((r) => r.puntaje)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  if (puntajes.length === 0) return null;
  return redondear1(puntajes.reduce((s, p) => s + p, 0) / puntajes.length);
}

/**
 * RN-03: puntaje de usabilidad (0–40) = Σ(puntaje final × peso) × 40 / (10 × 100), a 1 decimal.
 * Es la suma de los 4 criterios del Excel, ponderada: con los 4 pesos en 25 da exactamente la
 * suma de los promedios por criterio (7,3 + 10 + 10 + 6,5 → 33,8).
 */
export function indiceAdopcion(puntajes: readonly Pick<PuntajeCriterio, 'puntajeFinal' | 'peso'>[]): number {
  const total = puntajes.reduce((s, p) => s + p.puntajeFinal * p.peso, 0);
  return redondear1((total * PUNTAJE_USABILIDAD_MAXIMO) / (PUNTAJE_MAXIMO * SUMA_PESOS_REQUERIDA));
}

/** RN-09: interpretación del Excel (≥ 30 confirmada, 20–30 parcial, < 20 no confirmada). */
export function resultado(indice: number): ResultadoAdopcion {
  if (indice >= UMBRAL_USABILIDAD_CONFIRMADA) return 'Usabilidad confirmada';
  if (indice >= UMBRAL_USABILIDAD_PARCIAL) return 'Usabilidad parcial';
  return 'No confirmada';
}

/**
 * RN-05: un ajuste manual exige sustento. Si no hay puntaje sugerido (ninguna respuesta
 * impacta el criterio) el puntaje final es enteramente manual y también lo exige.
 */
export function requiereSustento(p: Pick<PuntajeCriterio, 'puntajeFinal' | 'puntajeSugerido'>): boolean {
  if (p.puntajeSugerido === null) return true;
  return !iguales(p.puntajeFinal, p.puntajeSugerido);
}

export function faltaSustento(p: Pick<PuntajeCriterio, 'puntajeFinal' | 'puntajeSugerido' | 'sustentoAjuste'>): boolean {
  return requiereSustento(p) && p.sustentoAjuste.trim() === '';
}

/**
 * Aplica un nuevo puntaje sugerido. Si el usuario no había ajustado el puntaje
 * (final = sugerido anterior y sin sustento), el final sigue a la nueva sugerencia;
 * si lo había ajustado, se respeta su valor. Es idempotente.
 */
export function aplicarSugerido(p: PuntajeCriterio, nuevoSugerido: number | null): PuntajeCriterio {
  const seguiaSugerencia =
    p.sustentoAjuste.trim() === '' && (p.puntajeSugerido === null || iguales(p.puntajeFinal, p.puntajeSugerido));
  return {
    ...p,
    puntajeSugerido: nuevoSugerido,
    puntajeFinal: seguiaSugerencia && nuevoSugerido !== null ? nuevoSugerido : p.puntajeFinal,
  };
}

export function sumaPesos(criterios: readonly Pick<Criterio, 'peso' | 'activo'>[]): number {
  return criterios.filter((c) => c.activo).reduce((s, c) => s + c.peso, 0);
}

export function pesosValidos(criterios: readonly Pick<Criterio, 'peso' | 'activo'>[]): boolean {
  return sumaPesos(criterios) === SUMA_PESOS_REQUERIDA;
}

/** `33.8` → `33.8 / 40` (separador decimal de es-PE). */
export function formatearIndice(indice: number | null | undefined): string {
  if (indice === null || indice === undefined) return '—';
  return `${indice.toLocaleString('es-PE', { maximumFractionDigits: 1 })} / ${PUNTAJE_USABILIDAD_MAXIMO}`;
}

/** `8` → `8`, `7.5` → `7,5`. */
export function formatearPuntaje(puntaje: number | null | undefined): string {
  if (puntaje === null || puntaje === undefined) return '—';
  return puntaje.toLocaleString('es-PE', { maximumFractionDigits: 1 });
}
