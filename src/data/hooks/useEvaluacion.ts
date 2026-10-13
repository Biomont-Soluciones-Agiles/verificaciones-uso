import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Id, PuntajeCriterio } from '../../domain/tipos';
import { useRepositorios } from '../contexto';
import { guardarEvaluacion, recalcularSugeridos } from '../servicios';
import { claves } from './claves';

/**
 * Puntajes por criterio recalculados al abrir la Evaluación (§3.4). La consulta escribe
 * los sugeridos derivados, por eso no se refresca al volver a la ventana.
 */
export function usePuntajesRecalculados(verificacionId: Id) {
  const repos = useRepositorios();
  return useQuery({
    queryKey: claves.puntajes(verificacionId),
    queryFn: () => recalcularSugeridos(repos, verificacionId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useGuardarEvaluacion(verificacionId: Id) {
  const repos = useRepositorios();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { puntajes: PuntajeCriterio[]; sustentoGlobal: string }) =>
      guardarEvaluacion(repos, verificacionId, p.puntajes, p.sustentoGlobal),
    onSuccess: (v, p) => {
      qc.setQueryData(claves.verificacion(v.id), v);
      qc.setQueryData(claves.puntajes(v.id), p.puntajes);
      void qc.invalidateQueries({ queryKey: claves.verificaciones, exact: true });
    },
  });
}
