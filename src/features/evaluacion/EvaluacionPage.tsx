import { useVerificacionDeRuta } from '../../app/useVerificacionDeRuta';
import { Cargando, ErrorCarga } from '../../components/Estructura';
import { useEntrevistas } from '../../data/hooks/useEntrevistas';
import { usePuntajesRecalculados } from '../../data/hooks/useEvaluacion';
import { contarCompletas } from '../../domain/flujo';
import { FormularioEvaluacion } from './FormularioEvaluacion';

/** Al abrir la Evaluación se recalculan los puntajes sugeridos (RN-04, §3.4). */
export function EvaluacionPage() {
  const verificacion = useVerificacionDeRuta();
  const puntajes = usePuntajesRecalculados(verificacion.id);
  const entrevistas = useEntrevistas(verificacion.id);

  const error = puntajes.error ?? entrevistas.error;
  if (error) return <ErrorCarga error={error} />;
  if (!puntajes.data || !entrevistas.data) return <Cargando texto="Calculando puntajes sugeridos…" />;

  return (
    <FormularioEvaluacion
      key={verificacion.id}
      verificacion={verificacion}
      puntajesIniciales={puntajes.data}
      entrevistasCompletas={contarCompletas(entrevistas.data)}
    />
  );
}
