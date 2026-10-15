import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Id } from '../../domain/tipos';
import { useRepositorios } from '../contexto';
import {
  abrirVerificacion,
  cambiarEntrevistasPrevistas,
  cancelarVerificacion,
  finalizarYEnviar,
  guardarConsolidado,
  programarVerificacion,
  simularLevantamientoCompleto,
  type DatosConsolidado,
  type DatosProgramacion,
} from '../servicios';
import { claves } from './claves';

/** Invalida todo lo que depende del estado de una verificación (incluye la solución, por F3). */
export function invalidarVerificacion(qc: QueryClient, id: Id) {
  void qc.invalidateQueries({ queryKey: claves.verificaciones });
  void qc.invalidateQueries({ queryKey: claves.entrevistas(id) });
  void qc.invalidateQueries({ queryKey: claves.puntajes(id) });
  void qc.invalidateQueries({ queryKey: claves.aprobaciones(id) });
  void qc.invalidateQueries({ queryKey: claves.historialPuntajes(id) });
  void qc.invalidateQueries({ queryKey: claves.soluciones });
}

export function useVerificaciones() {
  const repos = useRepositorios();
  return useQuery({ queryKey: claves.verificaciones, queryFn: () => repos.verificaciones.listar() });
}

/** Verificaciones de una solución, de la más reciente a la más antigua (historial). */
export function useVerificacionesDeSolucion(solucionId: Id | null) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.verificacionesDeSolucion(solucionId ?? ''),
    queryFn: async () =>
      (await repos.verificaciones.listar({ solucionId: solucionId ?? '' })).sort((a, b) =>
        b.codigo.localeCompare(a.codigo, 'es', { numeric: true }),
      ),
    enabled: !!solucionId,
  });
}

/** Lee la verificación reparando, si faltan, los puntajes por criterio (§3.4, idempotente). */
export function useVerificacion(id: Id | null) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.verificacion(id ?? ''),
    queryFn: () => abrirVerificacion(repos, id ?? ''),
    enabled: !!id,
  });
}

export function useAprobaciones(verificacionId: Id) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.aprobaciones(verificacionId),
    queryFn: () => repos.aprobaciones.listarPorVerificacion(verificacionId),
  });
}

export function useProgramarVerificacion() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { datos: DatosProgramacion; activar: boolean; verificacionId?: Id }) =>
      programarVerificacion(repos, p.datos, { activar: p.activar, verificacionId: p.verificacionId }),
    onSuccess: (v) => {
      qc.setQueryData(claves.verificacion(v.id), v);
      invalidarVerificacion(qc, v.id);
    },
  });
}

/** Cambia las entrevistas previstas (en cualquier etapa antes del envío) y recuenta. */
export function useCambiarEntrevistasPrevistas(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (previstas: number) => cambiarEntrevistasPrevistas(repos, verificacionId, previstas),
    onSuccess: (v) => {
      qc.setQueryData(claves.verificacion(v.id), v);
      invalidarVerificacion(qc, v.id);
    },
  });
}

export function useCancelarVerificacion() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => cancelarVerificacion(repos, id),
    onSuccess: (v) => {
      qc.setQueryData(claves.verificacion(v.id), v);
      invalidarVerificacion(qc, v.id);
    },
  });
}

export function useGuardarConsolidado(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosConsolidado) => guardarConsolidado(repos, verificacionId, datos),
    onSuccess: (v) => {
      qc.setQueryData(claves.verificacion(v.id), v);
      void qc.invalidateQueries({ queryKey: claves.verificaciones, exact: true });
    },
  });
}

export function useFinalizarYEnviar(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosConsolidado) => finalizarYEnviar(repos, verificacionId, datos),
    onSuccess: (v) => {
      qc.setQueryData(claves.verificacion(v.id), v);
      invalidarVerificacion(qc, v.id);
    },
    // Si falla a mitad de camino, recargar para reflejar los pasos que sí se aplicaron.
    onError: () => invalidarVerificacion(qc, verificacionId),
  });
}

/** Solo demo (modo mock). */
export function useSimularLevantamiento(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => simularLevantamientoCompleto(repos, verificacionId),
    onSuccess: (v) => {
      qc.setQueryData(claves.verificacion(v.id), v);
      invalidarVerificacion(qc, v.id);
    },
  });
}
