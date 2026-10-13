import { useAvisos } from '../../components/avisos';
import { useActualizarEvidencia, useEliminarEvidencia, useSubirEvidencias } from '../../data/hooks/useEntrevistas';
import type { Entrevista, Evidencia, Id, Verificacion } from '../../domain/tipos';

/** Acciones sobre la biblioteca de evidencias de una entrevista (con avisos). */
export function useGestionEvidencias(verificacion: Verificacion, entrevista: Entrevista) {
  const avisos = useAvisos();
  const subirMut = useSubirEvidencias(verificacion.id);
  const actualizar = useActualizarEvidencia(verificacion.id);
  const eliminarMut = useEliminarEvidencia(verificacion.id);

  const subir = async (archivos: FileList | File[] | null, respuestaId: Id | null = null) => {
    const lista = Array.from(archivos ?? []);
    if (lista.length === 0) return;
    try {
      await subirMut.mutateAsync(
        lista.map((archivo) => ({
          verificacionId: verificacion.id,
          verificacionCodigo: verificacion.codigo,
          entrevistaId: entrevista.id,
          entrevistaNumero: entrevista.numero,
          respuestaId,
          tipo: archivo.type.startsWith('image/') ? 'Captura' : 'Documento',
          archivo,
        })),
      );
      avisos.exito(lista.length === 1 ? 'Evidencia guardada sin notificar.' : `${lista.length} evidencias guardadas sin notificar.`);
    } catch (e) {
      avisos.error(e, 'No se pudo subir la evidencia');
    }
  };

  /** Deja vinculada a la respuesta solo la evidencia indicada (o ninguna). */
  const vincular = async (respuestaId: Id, evidenciaId: Id | null, evidencias: Evidencia[]) => {
    try {
      for (const e of evidencias) {
        if (e.respuestaId === respuestaId && e.id !== evidenciaId) {
          await actualizar.mutateAsync({ id: e.id, cambios: { respuestaId: null } });
        }
      }
      if (evidenciaId !== null) await actualizar.mutateAsync({ id: evidenciaId, cambios: { respuestaId } });
    } catch (e) {
      avisos.error(e, 'No se pudo vincular la evidencia');
    }
  };

  const eliminar = async (evidencia: Evidencia) => {
    if (!window.confirm(`¿Quitar la evidencia "${evidencia.nombreArchivo}"?`)) return;
    try {
      await eliminarMut.mutateAsync(evidencia.id);
    } catch (e) {
      avisos.error(e, 'No se pudo quitar la evidencia');
    }
  };

  return { subir, vincular, eliminar, ocupado: subirMut.isPending || actualizar.isPending || eliminarMut.isPending };
}
