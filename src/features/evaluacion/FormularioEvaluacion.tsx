import {
  Badge,
  Button,
  Field,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Textarea,
} from '@fluentui/react-components';
import { Save24Regular, Sparkle24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MENSAJES, useAvisos } from '../../components/avisos';
import { Acciones, Encabezado, Pila, Tarjeta } from '../../components/Estructura';
import { useGuardarEvaluacion } from '../../data/hooks/useEvaluacion';
import { faltaSustento, formatearIndice, formatearPuntaje, indiceAdopcion, resultado } from '../../domain/evaluacion';
import { esEditableDesdeApp } from '../../domain/flujo';
import type { PuntajeCriterio, Verificacion } from '../../domain/tipos';
import { CriterioEvaluacion } from './CriterioEvaluacion';

export interface FormularioEvaluacionProps {
  verificacion: Verificacion;
  puntajesIniciales: PuntajeCriterio[];
  entrevistasCompletas: number;
}

function textoSugerencia(puntajes: PuntajeCriterio[], completas: number): string {
  const conSugerencia = puntajes.filter((p) => p.puntajeSugerido !== null);
  if (completas === 0 || conSugerencia.length === 0) {
    return 'Aún no hay entrevistas completas con puntaje: los criterios no tienen sugerencia. Ajusta los puntajes dejando sustento.';
  }
  const menor = conSugerencia.reduce((a, b) => ((b.puntajeSugerido ?? 0) < (a.puntajeSugerido ?? 0) ? b : a));
  return (
    `Calculada con ${completas} ${completas === 1 ? 'entrevista completa' : 'entrevistas completas'} ` +
    `(preguntas definidas y surgidas). ${menor.titulo} es el criterio con menor puntaje sugerido ` +
    `(${formatearPuntaje(menor.puntajeSugerido)}). Puedes ajustar el puntaje dejando sustento.`
  );
}

export function FormularioEvaluacion({ verificacion, puntajesIniciales, entrevistasCompletas }: FormularioEvaluacionProps) {
  const navigate = useNavigate();
  const avisos = useAvisos();
  const guardar = useGuardarEvaluacion(verificacion.id);
  const [puntajes, setPuntajes] = useState(puntajesIniciales);
  const [sustentoGlobal, setSustentoGlobal] = useState(verificacion.sustentoGlobal);
  const [intentado, setIntentado] = useState(false);

  const soloLectura = !esEditableDesdeApp(verificacion.estado);
  const indice = indiceAdopcion(puntajes);
  const pendientes = puntajes.filter(faltaSustento).length;

  const cambiar = (id: number, cambios: Partial<PuntajeCriterio>) =>
    setPuntajes((lista) => lista.map((p) => (p.id === id ? { ...p, ...cambios } : p)));

  const guardarBorrador = async (irAlConsolidado: boolean) => {
    setIntentado(true);
    if (soloLectura) {
      if (irAlConsolidado) navigate(`/verificaciones/${verificacion.id}/revision`);
      return;
    }
    try {
      await guardar.mutateAsync({ puntajes, sustentoGlobal });
      avisos.exito(MENSAJES.borradorGuardado);
      if (irAlConsolidado) navigate(`/verificaciones/${verificacion.id}/revision`);
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Pila>
      <Encabezado
        titulo="Evaluación sugerida"
        subtitulo="Los puntajes consideran preguntas definidas y preguntas surgidas en todas las entrevistas completas."
        extra={
          <span aria-live="polite">
            <Badge appearance="tint" size="large" color="brand">
              Índice preliminar: {formatearIndice(indice)} · {resultado(indice)}
            </Badge>
          </span>
        }
      />
      <Tarjeta>
        {puntajes.map((p) => (
          <CriterioEvaluacion
            key={p.id}
            puntaje={p}
            soloLectura={soloLectura}
            mostrarErrores={intentado}
            onChange={(c) => cambiar(p.id, c)}
          />
        ))}
        <MessageBar intent="info" icon={<Sparkle24Regular />} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Sugerencia calculada</MessageBarTitle>
            {textoSugerencia(puntajes, entrevistasCompletas)}
          </MessageBarBody>
        </MessageBar>
        {pendientes > 0 && (
          <MessageBar intent="warning">
            <MessageBarBody>
              {pendientes === 1
                ? 'Un criterio ajustado no tiene sustento.'
                : `${pendientes} criterios ajustados no tienen sustento.`}{' '}
              Puedes guardar el borrador, pero no se podrá enviar a revisión (RN-05).
            </MessageBarBody>
          </MessageBar>
        )}
        <Field label="Sustento global">
          <Textarea
            rows={4}
            resize="vertical"
            value={sustentoGlobal}
            disabled={soloLectura}
            onChange={(_, d) => setSustentoGlobal(d.value)}
          />
        </Field>
        <Acciones>
          {!soloLectura && (
            <Button icon={<Save24Regular />} disabled={guardar.isPending} onClick={() => guardarBorrador(false)}>
              Guardar evaluación en borrador
            </Button>
          )}
          <Button appearance="primary" disabled={guardar.isPending} onClick={() => guardarBorrador(true)}>
            Ver consolidado
          </Button>
        </Acciones>
      </Tarjeta>
    </Pila>
  );
}
