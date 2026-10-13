import { useSyncExternalStore } from 'react';
import { idDeTexto } from '../domain/codigo';
import type { Id } from '../domain/tipos';

/**
 * Recuerda la última verificación abierta para que la barra de navegación
 * (Programación / Entrevistas / Evaluación / Revisión) apunte a ella desde el Catálogo.
 */

const CLAVE = 'vu.verificacionActiva';
const suscriptores = new Set<() => void>();

function leerInicial(): Id | null {
  try {
    return idDeTexto(sessionStorage.getItem(CLAVE));
  } catch {
    return null;
  }
}

let actual: Id | null = typeof window === 'undefined' ? null : leerInicial();

export function recordarVerificacion(id: Id) {
  if (actual === id) return;
  actual = id;
  try {
    sessionStorage.setItem(CLAVE, String(id));
  } catch {
    // Almacenamiento no disponible: se recuerda solo en memoria.
  }
  suscriptores.forEach((s) => s());
}

function suscribir(s: () => void) {
  suscriptores.add(s);
  return () => {
    suscriptores.delete(s);
  };
}

export function useVerificacionRecordada(): Id | null {
  return useSyncExternalStore(suscribir, () => actual, () => null);
}
