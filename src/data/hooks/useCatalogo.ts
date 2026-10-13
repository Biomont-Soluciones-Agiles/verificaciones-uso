import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Criterio, Id, OpcionRespuesta, Pregunta } from '../../domain/tipos';
import { useRepositorios } from '../contexto';
import type { Cambios, SinId } from '../repositorios';
import { claves } from './claves';

const CATALOGO_STALE = 5 * 60_000;

export function useAreas() {
  const repos = useRepositorios();
  return useQuery({ queryKey: claves.areas, queryFn: () => repos.catalogo.listarAreas(), staleTime: CATALOGO_STALE });
}

export function useCriterios() {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.criterios,
    queryFn: () => repos.catalogo.listarCriterios(),
    staleTime: CATALOGO_STALE,
  });
}

export function usePreguntas() {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.preguntas,
    queryFn: () => repos.catalogo.listarPreguntas(),
    staleTime: CATALOGO_STALE,
  });
}

export function useOpciones() {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.opciones,
    queryFn: () => repos.catalogo.listarOpciones(),
    staleTime: CATALOGO_STALE,
  });
}

/** `directorio`: todos los usuarios habilitados; `responsables`: solo los del rol "VU Responsable". */
export type OrigenPersonas = 'directorio' | 'responsables';

export function usePersonas(origen: OrigenPersonas = 'directorio') {
  const repos = useRepositorios();
  return useQuery({
    queryKey: origen === 'responsables' ? claves.responsables : claves.personas,
    queryFn: () =>
      origen === 'responsables' ? repos.directorio.listarResponsables() : repos.directorio.buscarPersonas(''),
    staleTime: CATALOGO_STALE,
    retry: false,
  });
}

export function useUsuarioActual() {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.usuarioActual,
    queryFn: () => repos.directorio.usuarioActual(),
    staleTime: Infinity,
  });
}

// --- Administración --------------------------------------------------------

export interface CambiosCriterios {
  crear: SinId<Criterio>[];
  actualizar: { id: Id; cambios: Cambios<Criterio> }[];
  eliminar: Id[];
}

/** Guarda los criterios en bloque (la suma de pesos se valida antes en la pantalla). */
export function useGuardarCriterios() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: CambiosCriterios) => {
      for (const id of c.eliminar) await repos.catalogo.eliminarCriterio(id);
      for (const a of c.actualizar) await repos.catalogo.actualizarCriterio(a.id, a.cambios);
      for (const n of c.crear) await repos.catalogo.crearCriterio(n);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: claves.criterios }),
  });
}

export function useGuardarPregunta() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id?: Id; datos: SinId<Pregunta> }) =>
      p.id === undefined ? repos.catalogo.crearPregunta(p.datos) : repos.catalogo.actualizarPregunta(p.id, p.datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.preguntas }),
  });
}

export function useEliminarPregunta() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => repos.catalogo.eliminarPregunta(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: claves.preguntas });
      void qc.invalidateQueries({ queryKey: claves.opciones });
    },
  });
}

export function useGuardarOpcion() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (o: { id?: Id; datos: SinId<OpcionRespuesta> }) =>
      o.id === undefined ? repos.catalogo.crearOpcion(o.datos) : repos.catalogo.actualizarOpcion(o.id, o.datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.opciones }),
  });
}

export function useEliminarOpcion() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => repos.catalogo.eliminarOpcion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.opciones }),
  });
}
