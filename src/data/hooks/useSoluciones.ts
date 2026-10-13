import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Documento, Id, Solucion } from '../../domain/tipos';
import { useRepositorios } from '../contexto';
import type { SinId } from '../repositorios';
import { claves } from './claves';

export function useSoluciones() {
  const repos = useRepositorios();
  return useQuery({ queryKey: claves.soluciones, queryFn: () => repos.soluciones.listar() });
}

export function useDocumentos(solucionId: Id | null) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.documentos(solucionId ?? ''),
    queryFn: () => repos.soluciones.listarDocumentos(solucionId ?? ''),
    enabled: solucionId !== null,
  });
}

export function useGuardarSolucion() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: { id?: Id; datos: SinId<Solucion> }) =>
      s.id === undefined ? repos.soluciones.crear(s.datos) : repos.soluciones.actualizar(s.id, s.datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.soluciones }),
  });
}

export function useEliminarSolucion() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => repos.soluciones.eliminar(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: claves.soluciones });
      void qc.invalidateQueries({ queryKey: claves.todosLosDocumentos });
    },
  });
}

export function useGuardarDocumento() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { id?: Id; datos: SinId<Documento> }) =>
      d.id === undefined ? repos.soluciones.crearDocumento(d.datos) : repos.soluciones.actualizarDocumento(d.id, d.datos),
    onSuccess: (doc) => qc.invalidateQueries({ queryKey: claves.documentos(doc.solucionId) }),
  });
}

export function useEliminarDocumento() {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: Pick<Documento, 'id' | 'solucionId'>) => repos.soluciones.eliminarDocumento(d.id),
    onSuccess: (_, d) => qc.invalidateQueries({ queryKey: claves.documentos(d.solucionId) }),
  });
}
