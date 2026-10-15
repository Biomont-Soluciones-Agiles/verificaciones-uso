import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Evidencia, Id, Respuesta } from '../../domain/tipos';
import { useRepositorios } from '../contexto';
import type { Cambios, NuevaEvidencia, SinId } from '../repositorios';
import {
  agregarEntrevista,
  agregarPreguntaSurgida,
  completarEntrevista,
  guardarBorradorEntrevista,
  prepararRespuestasEntrevista,
  type CambiosBorradorEntrevista,
  type DatosNuevaEntrevista,
} from '../servicios';
import { CLAVE_AUTOGUARDADO, claves } from './claves';
import { invalidarVerificacion } from './useVerificaciones';

export function useEntrevistas(verificacionId: Id) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.entrevistas(verificacionId),
    queryFn: () => repos.entrevistas.listarPorVerificacion(verificacionId),
  });
}

/**
 * Historial de cambios de puntaje de la verificación (del más reciente al más antiguo). Omite
 * los cambios que volvieron al valor original.
 */
export function useHistorialPuntajes(verificacionId: Id) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.historialPuntajes(verificacionId),
    queryFn: async () =>
      (await repos.historialPuntajes.listarPorVerificacion(verificacionId)).filter(
        (c) => c.puntajeAnterior !== c.puntajeNuevo,
      ),
  });
}

export function useRespuestas(verificacionId: Id) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.respuestas(verificacionId),
    queryFn: () => repos.respuestas.listarPorVerificacion(verificacionId),
  });
}

/**
 * Respuestas de una entrevista, con las de las preguntas definidas ya creadas (idempotente).
 * El editor se inicializa una sola vez con este resultado, por eso no se refresca solo.
 */
export function useRespuestasEntrevista(entrevistaId: Id) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.respuestasEntrevista(entrevistaId),
    queryFn: () => prepararRespuestasEntrevista(repos, entrevistaId),
    staleTime: 0,
    // Sin caché al desmontar: al volver a la entrevista se leen los datos ya autoguardados.
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useAgregarPreguntaSurgida(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CLAVE_AUTOGUARDADO,
    mutationFn: (p: { entrevistaId: Id; criterioId: Id }) =>
      agregarPreguntaSurgida(repos, { id: p.entrevistaId, verificacionId }, p.criterioId),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.respuestas(verificacionId) }),
  });
}

export function useEvidencias(verificacionId: Id) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.evidencias(verificacionId),
    queryFn: () => repos.evidencias.listarPorVerificacion(verificacionId),
  });
}

export function useAgregarEntrevista(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosNuevaEntrevista) => agregarEntrevista(repos, verificacionId, datos),
    onSuccess: () => invalidarVerificacion(qc, verificacionId),
  });
}

/** Autoguardado y "Guardar avance sin notificar" (comparten la clave para el indicador). */
export function useGuardarBorradorEntrevista(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CLAVE_AUTOGUARDADO,
    mutationFn: (p: { entrevistaId: Id; cambios: CambiosBorradorEntrevista }) =>
      guardarBorradorEntrevista(repos, p.entrevistaId, p.cambios),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: claves.respuestas(verificacionId) });
      invalidarVerificacion(qc, verificacionId);
    },
  });
}

export function useCompletarEntrevista(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entrevistaId: Id) => completarEntrevista(repos, entrevistaId),
    onSuccess: (v) => {
      qc.setQueryData(claves.verificacion(v.id), v);
      invalidarVerificacion(qc, verificacionId);
    },
  });
}

export function useCrearRespuesta(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CLAVE_AUTOGUARDADO,
    mutationFn: (datos: SinId<Respuesta>) => repos.respuestas.crear(datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.respuestas(verificacionId) }),
  });
}

export function useEliminarRespuesta(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CLAVE_AUTOGUARDADO,
    mutationFn: (id: Id) => repos.respuestas.eliminar(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: claves.respuestas(verificacionId) });
      void qc.invalidateQueries({ queryKey: claves.evidencias(verificacionId) });
    },
  });
}

export function useSubirEvidencias(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CLAVE_AUTOGUARDADO,
    mutationFn: async (lista: NuevaEvidencia[]): Promise<Evidencia[]> => {
      const subidas: Evidencia[] = [];
      for (const e of lista) subidas.push(await repos.evidencias.subir(e));
      return subidas;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: claves.evidencias(verificacionId) }),
  });
}

export function useActualizarEvidencia(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CLAVE_AUTOGUARDADO,
    mutationFn: (p: { id: Id; cambios: Pick<Cambios<Evidencia>, 'respuestaId'> }) =>
      repos.evidencias.actualizar(p.id, p.cambios),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.evidencias(verificacionId) }),
  });
}

export function useEliminarEvidencia(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CLAVE_AUTOGUARDADO,
    mutationFn: (id: Id) => repos.evidencias.eliminar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.evidencias(verificacionId) }),
  });
}
