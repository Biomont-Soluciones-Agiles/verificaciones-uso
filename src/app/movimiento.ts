/**
 * Vocabulario de movimiento de la app (DESIGN.md, "El Cuaderno de Laboratorio"): el movimiento
 * explica un cambio de estado o de lugar; nunca decora. Las salidas son más rápidas que las entradas.
 */
export const DURACION = {
  /** Respuesta inmediata a un gesto. */
  inmediata: '120ms',
  /** Cambio de estado rutinario (aparece un campo, cambia un resultado). */
  estado: '200ms',
  /** Cambio de vista o de etapa. */
  vista: '320ms',
  /** La lectura del índice: el único momento con autoría. */
  lectura: '520ms',
} as const;

/** Desaceleración natural para llegadas seguras; sin rebotes. */
export const CURVA_SALIDA = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Bloque de estilos para quien pidió menos movimiento al sistema operativo. */
export const MENOS_MOVIMIENTO = '@media (prefers-reduced-motion: reduce)';

export function prefiereMenosMovimiento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Entrada de un elemento que aparece por un cambio de estado: se asienta desde arriba. */
export const aparecer = {
  from: { opacity: 0, transform: 'translateY(-4px)' },
  to: { opacity: 1, transform: 'none' },
};

/** Solo opacidad: la versión con menos movimiento de cualquier entrada. */
export const fundir = {
  from: { opacity: 0 },
  to: { opacity: 1 },
};
