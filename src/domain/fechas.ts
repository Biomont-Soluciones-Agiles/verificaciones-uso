import type { FechaHoraISO, FechaISO } from './tipos';

/**
 * Utilidades de fechas. Las fechas sin hora se manejan como texto `YYYY-MM-DD`
 * y la aritmética se hace en UTC para no depender de la zona horaria del navegador.
 */

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})/;

function aFechaUTC(fecha: FechaISO): Date {
  const m = RE_FECHA.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: "${fecha}"`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCDate() !== Number(m[3])) throw new Error(`Fecha inválida: "${fecha}"`);
  return d;
}

function aTextoISO(d: Date): FechaISO {
  return d.toISOString().slice(0, 10);
}

export function esFechaValida(fecha: string | null | undefined): fecha is FechaISO {
  if (!fecha) return false;
  try {
    aFechaUTC(fecha);
    return true;
  } catch {
    return false;
  }
}

export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  const d = aFechaUTC(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return aTextoISO(d);
}

/** Suma meses ajustando al último día del mes cuando el día no existe (31/08 + 6 → 28/02). */
export function sumarMeses(fecha: FechaISO, meses: number): FechaISO {
  const d = aFechaUTC(fecha);
  const dia = d.getUTCDate();
  const destino = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0)).getUTCDate();
  destino.setUTCDate(Math.min(dia, ultimoDia));
  return aTextoISO(destino);
}

/** RN-01: fecha de alerta = fecha objetivo − días de anticipación. */
export function calcularFechaAlerta(fechaObjetivo: FechaISO, diasAnticipacion: number): FechaISO {
  if (!Number.isInteger(diasAnticipacion) || diasAnticipacion < 0) {
    throw new Error(`Días de anticipación inválidos: ${diasAnticipacion}`);
  }
  return sumarDias(fechaObjetivo, -diasAnticipacion);
}

/**
 * RN-10: próxima VU = fecha de aprobación + periodicidad (meses) de la solución.
 * Acepta una fecha (`YYYY-MM-DD`) o una fecha y hora ISO (se toma la parte de fecha).
 */
export function calcularProximaVU(fechaAprobacion: FechaISO | FechaHoraISO, periodicidadMeses: number): FechaISO {
  if (!Number.isInteger(periodicidadMeses) || periodicidadMeses <= 0) {
    throw new Error(`Periodicidad inválida: ${periodicidadMeses}`);
  }
  return sumarMeses(fechaAprobacion.slice(0, 10), periodicidadMeses);
}

export function compararFechas(a: FechaISO, b: FechaISO): number {
  return a.slice(0, 10).localeCompare(b.slice(0, 10));
}

/** Fecha local de hoy como `YYYY-MM-DD`. */
export function hoyISO(ahora: Date = new Date()): FechaISO {
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mm}-${dd}`;
}

export function ahoraISO(): FechaHoraISO {
  return new Date().toISOString();
}

/** `2026-08-15` → `15/08/2026`; vacío → `—`. */
export function formatearFecha(fecha: FechaISO | FechaHoraISO | null | undefined): string {
  if (!fecha) return '—';
  const m = RE_FECHA.exec(fecha);
  if (!m) return fecha;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** `2026-08-12T15:00:00Z` → `12/08/2026, 10:00` (hora local). */
export function formatearFechaHora(fechaHora: FechaHoraISO | null | undefined): string {
  if (!fechaHora) return '—';
  const d = new Date(fechaHora);
  if (Number.isNaN(d.getTime())) return fechaHora;
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `2026-08-12T15:00:00Z` → `12/08` (fecha local). */
export function formatearDiaMes(fechaHora: FechaHoraISO | null | undefined): string {
  if (!fechaHora) return '—';
  const d = new Date(fechaHora);
  if (Number.isNaN(d.getTime())) return fechaHora;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Valor para `<input type="datetime-local">` a partir de una fecha y hora ISO. */
export function aValorDatetimeLocal(fechaHora: FechaHoraISO | null | undefined): string {
  if (!fechaHora) return '';
  const d = new Date(fechaHora);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Inverso de {@link aValorDatetimeLocal}. */
export function desdeValorDatetimeLocal(valor: string): FechaHoraISO | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
