import { useCallback, useEffect, useRef, useState } from 'react';
import { mensajeDeError } from '../../data/errores';

export type EstadoAutoguardado = 'guardado' | 'pendiente' | 'guardando' | 'error';

export interface Autoguardado {
  estado: EstadoAutoguardado;
  error: string | null;
  /** Guarda de inmediato los cambios pendientes (antes de completar o salir). */
  guardarAhora: () => Promise<void>;
}

/**
 * Autoguardado con debounce. `valor` debe actualizarse de forma inmutable: cualquier cambio
 * de referencia respecto al último valor guardado programa un guardado tras `retrasoMs`.
 * `guardar(nuevo, anterior)` recibe el último valor persistido para enviar solo lo modificado.
 * Al desmontar con cambios pendientes, se guardan igualmente.
 */
export function useAutoguardado<T>(
  valor: T,
  guardar: (nuevo: T, anterior: T) => Promise<void>,
  { retrasoMs = 800, activo = true }: { retrasoMs?: number; activo?: boolean } = {},
): Autoguardado {
  const [guardado, setGuardado] = useState<T>(valor);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardarRef = useRef(guardar);
  const ultimoRef = useRef({ valor, guardado, activo });
  useEffect(() => {
    guardarRef.current = guardar;
    ultimoRef.current = { valor, guardado, activo };
  });

  const ejecutar = useCallback(async (nuevo: T, anterior: T): Promise<boolean> => {
    setGuardando(true);
    try {
      await guardarRef.current(nuevo, anterior);
      setGuardado(nuevo);
      setError(null);
      return true;
    } catch (e) {
      setError(mensajeDeError(e));
      return false;
    } finally {
      setGuardando(false);
    }
  }, []);

  useEffect(() => {
    if (!activo || Object.is(valor, guardado)) return;
    const temporizador = setTimeout(() => void ejecutar(valor, guardado), retrasoMs);
    return () => clearTimeout(temporizador);
  }, [valor, guardado, activo, retrasoMs, ejecutar]);

  useEffect(
    () => () => {
      const ultimo = ultimoRef.current;
      if (ultimo.activo && !Object.is(ultimo.valor, ultimo.guardado)) {
        void guardarRef.current(ultimo.valor, ultimo.guardado).catch(() => undefined);
      }
    },
    [],
  );

  const pendiente = activo && !Object.is(valor, guardado);
  return {
    estado: error ? 'error' : guardando ? 'guardando' : pendiente ? 'pendiente' : 'guardado',
    error,
    guardarAhora: async () => {
      if (pendiente && !(await ejecutar(valor, guardado))) {
        throw new Error('No se pudieron guardar los cambios de la entrevista. Inténtalo de nuevo.');
      }
    },
  };
}
