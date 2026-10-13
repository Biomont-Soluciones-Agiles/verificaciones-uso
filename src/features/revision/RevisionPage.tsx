import { useVerificacionDeRuta } from '../../app/useVerificacionDeRuta';
import { Cargando, ErrorCarga } from '../../components/Estructura';
import { useEntrevistas, useEvidencias } from '../../data/hooks/useEntrevistas';
import { usePuntajesRecalculados } from '../../data/hooks/useEvaluacion';
import { consolidarTextos } from '../../domain/consolidacion';
import { FormularioRevision } from './FormularioRevision';

export function RevisionPage() {
  const verificacion = useVerificacionDeRuta();
  const entrevistas = useEntrevistas(verificacion.id);
  const evidencias = useEvidencias(verificacion.id);
  const puntajes = usePuntajesRecalculados(verificacion.id);

  const error = entrevistas.error ?? evidencias.error ?? puntajes.error;
  if (error) return <ErrorCarga error={error} />;
  if (!entrevistas.data || !evidencias.data || !puntajes.data) return <Cargando />;

  const completas = entrevistas.data.filter((e) => e.estado === 'Completa');
  return (
    <FormularioRevision
      key={verificacion.id}
      verificacion={verificacion}
      entrevistas={entrevistas.data}
      evidencias={evidencias.data}
      puntajes={puntajes.data}
      inicial={{
        // Precargados desde las entrevistas completas si aún no se consolidaron.
        oportunidadesConsolidadas:
          verificacion.oportunidadesConsolidadas || consolidarTextos(completas.map((e) => e.oportunidadesMejora)),
        recomendacionesConsolidadas:
          verificacion.recomendacionesConsolidadas || consolidarTextos(completas.map((e) => e.recomendaciones)),
        aprobadorPiloto: verificacion.aprobadorPiloto,
        aprobadorProductivo: verificacion.aprobadorProductivo,
        notificarAlFinalizar: true,
      }}
    />
  );
}
