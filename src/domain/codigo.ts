import type { NivelAprobacion } from './tipos';

/**
 * Código de la verificación `VU-{SEQNUM:5}`. En Dataverse lo asigna la autonumeración de
 * `vu_verificacion.vu_name`; esta función solo la imita en el modo mock.
 */
export function formatearCodigoVU(secuencia: number): string {
  if (!Number.isInteger(secuencia) || secuencia <= 0) throw new Error(`Secuencia de verificación inválida: ${secuencia}`);
  return `VU-${String(secuencia).padStart(5, '0')}`;
}

/** Orden descendente por código (`VU-00012` antes que `VU-00009`): la más reciente primero. */
export function compararCodigoDesc(a: { codigo: string }, b: { codigo: string }): number {
  return b.codigo.localeCompare(a.codigo, 'en', { numeric: true });
}

/** `Title` de la entrevista: "Entrevista 3 – Lucía Campos". */
export function tituloEntrevista(numero: number, entrevistado: string): string {
  const nombre = entrevistado.trim();
  return nombre ? `Entrevista ${numero} – ${nombre}` : `Entrevista ${numero}`;
}

/** `Title` de la aprobación: "VU-00012 · Piloto". */
export function tituloAprobacion(codigo: string, nivel: NivelAprobacion): string {
  return `${codigo} · ${nivel}`;
}

/** Prefijo de nombre de archivo de evidencia: `VU-00012/Entrevista-03`. */
export function carpetaEvidencias(codigo: string, numeroEntrevista: number): string {
  return `${codigo}/Entrevista-${String(numeroEntrevista).padStart(2, '0')}`;
}

/** Normaliza un identificador recibido como texto (ruta, consulta, almacenamiento): vacío → null. */
export function idDeTexto(valor: string | null | undefined): string | null {
  const t = valor?.trim() ?? '';
  return t && /^[A-Za-z0-9-]+$/.test(t) ? t : null;
}
