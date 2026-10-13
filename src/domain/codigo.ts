import type { Id, NivelAprobacion } from './tipos';

/** `Title` de la verificación: `VU-` + ID con 5 dígitos (SharePoint no tiene autonumeración). */
export function formatearCodigoVU(id: Id): string {
  if (!Number.isInteger(id) || id <= 0) throw new Error(`ID de verificación inválido: ${id}`);
  return `VU-${String(id).padStart(5, '0')}`;
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

/** Carpeta de la biblioteca de evidencias: `VU-00012/Entrevista-03`. */
export function carpetaEvidencias(codigo: string, numeroEntrevista: number): string {
  return `${codigo}/Entrevista-${String(numeroEntrevista).padStart(2, '0')}`;
}
