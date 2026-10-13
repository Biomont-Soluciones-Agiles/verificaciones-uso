import {
  Badge,
  Button,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Text,
  Textarea,
  tokens,
} from '@fluentui/react-components';
import { Checkmark24Regular, CommentAdd24Regular, ErrorCircle20Regular, Save24Regular } from '@fluentui/react-icons';
import { useIsMutating } from '@tanstack/react-query';
import { useState } from 'react';
import { MENSAJES, useAvisos } from '../../components/avisos';
import { useConfirmar } from '../../components/Confirmacion';
import { EstadoBadge } from '../../components/EstadoBadge';
import { iconoOcupado } from '../../components/iconoOcupado';
import { Acciones, Campos, Cargando, ErrorCarga, ListaMotivos, Tarjeta } from '../../components/Estructura';
import { CLAVE_AUTOGUARDADO } from '../../data/hooks/claves';
import {
  useAgregarPreguntaSurgida,
  useCompletarEntrevista,
  useEliminarRespuesta,
  useGuardarBorradorEntrevista,
  useRespuestasEntrevista,
} from '../../data/hooks/useEntrevistas';
import { formatearFechaHora } from '../../domain/fechas';
import { puedeFinalizar, validarRespuestasDefinidas } from '../../domain/flujo';
import type {
  Criterio,
  Entrevista,
  Evidencia,
  Id,
  OpcionRespuesta,
  Pregunta,
  Respuesta,
  Verificacion,
} from '../../domain/tipos';
import { borradorDesde, calcularCambios, hayCambios, type BorradorEntrevista } from './borrador';
import { EvidenciasEntrevista } from './EvidenciasEntrevista';
import { PreguntaSurgida } from './PreguntaSurgida';
import { RespuestaDefinida } from './RespuestaDefinida';
import { useAutoguardado, type EstadoAutoguardado } from './useAutoguardado';
import { useGestionEvidencias } from './useGestionEvidencias';

const useStyles = makeStyles({
  cabecera: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: tokens.spacingHorizontalM },
  titulos: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  detalle: { color: tokens.colorNeutralForeground2 },
  estado: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS, alignItems: 'flex-start' },
  seccion: {
    margin: 0,
    paddingTop: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
});

export interface EditorEntrevistaProps {
  verificacion: Verificacion;
  entrevista: Entrevista;
  evidencias: Evidencia[];
  /** Preguntas definidas activas. */
  preguntas: Pregunta[];
  opciones: OpcionRespuesta[];
  criterios: Criterio[];
  soloLectura: boolean;
}

/** Carga (y prepara) las respuestas de la entrevista antes de montar el formulario. */
export function EditorEntrevista(props: EditorEntrevistaProps) {
  const respuestas = useRespuestasEntrevista(props.entrevista.id);
  if (respuestas.error) return <ErrorCarga error={respuestas.error} />;
  if (respuestas.isPending) {
    return (
      <Tarjeta>
        <Cargando texto="Abriendo la entrevista…" />
      </Tarjeta>
    );
  }
  return <FormularioEntrevista {...props} respuestasIniciales={respuestas.data} />;
}

const TEXTO_INDICADOR: Record<EstadoAutoguardado, string> = {
  guardado: 'Guardado automático',
  pendiente: 'Cambios por guardar…',
  guardando: 'Guardando…',
  error: 'Error al guardar',
};

function IndicadorGuardado({ estado, mutando, error }: { estado: EstadoAutoguardado; mutando: boolean; error: string | null }) {
  const efectivo: EstadoAutoguardado = estado === 'guardado' && mutando ? 'guardando' : estado;
  return (
    <span role="status" aria-live="polite" title={error ?? undefined}>
      <Badge
        appearance="tint"
        color={efectivo === 'error' ? 'danger' : efectivo === 'guardado' ? 'success' : 'informative'}
        icon={
          efectivo === 'guardado' ? (
            <Checkmark24Regular />
          ) : efectivo === 'guardando' ? (
            <Spinner size="extra-tiny" />
          ) : efectivo === 'error' ? (
            <ErrorCircle20Regular />
          ) : undefined
        }
      >
        {TEXTO_INDICADOR[efectivo]}
      </Badge>
    </span>
  );
}

function FormularioEntrevista({
  verificacion,
  entrevista,
  evidencias,
  preguntas,
  opciones,
  criterios,
  soloLectura,
  respuestasIniciales,
}: EditorEntrevistaProps & { respuestasIniciales: Respuesta[] }) {
  const styles = useStyles();
  const avisos = useAvisos();
  const confirmar = useConfirmar();
  const [borrador, setBorrador] = useState<BorradorEntrevista>(() => borradorDesde(entrevista, respuestasIniciales));
  const [nuevaId, setNuevaId] = useState<Id | null>(null);
  const [intentoCompletar, setIntentoCompletar] = useState(false);

  const guardarBorrador = useGuardarBorradorEntrevista(verificacion.id);
  const completar = useCompletarEntrevista(verificacion.id);
  const agregarSurgida = useAgregarPreguntaSurgida(verificacion.id);
  const eliminarRespuesta = useEliminarRespuesta(verificacion.id);
  const evidenciasAcciones = useGestionEvidencias(verificacion, entrevista);
  const mutando = useIsMutating({ mutationKey: CLAVE_AUTOGUARDADO }) > 0;

  const autoguardado = useAutoguardado(
    borrador,
    async (nuevo, anterior) => {
      const cambios = calcularCambios(nuevo, anterior);
      if (hayCambios(cambios)) await guardarBorrador.mutateAsync({ entrevistaId: entrevista.id, cambios });
    },
    { retrasoMs: 800, activo: !soloLectura },
  );

  const criteriosActivos = criterios.filter((c) => c.activo);
  const definidas = borrador.respuestas.filter((r) => r.origen === 'Definida');
  const surgidas = borrador.respuestas.filter((r) => r.origen === 'Surgida en reunión');
  const motivos = validarRespuestasDefinidas(preguntas, borrador.respuestas);
  const ocupado = completar.isPending || guardarBorrador.isPending;

  const cambiarCampo = (campo: 'urlGrabacion' | 'oportunidadesMejora' | 'recomendaciones', valor: string) =>
    setBorrador((b) => ({ ...b, [campo]: valor }));

  const cambiarRespuesta = (id: Id, cambios: Partial<Respuesta>) =>
    setBorrador((b) => ({ ...b, respuestas: b.respuestas.map((r) => (r.id === id ? { ...r, ...cambios } : r)) }));

  const nuevaPregunta = async () => {
    const criterio = criteriosActivos[0];
    if (!criterio) return avisos.error(new Error('No hay criterios activos.'));
    try {
      const r = await agregarSurgida.mutateAsync({ entrevistaId: entrevista.id, criterioId: criterio.id });
      setBorrador((b) => ({ ...b, respuestas: [...b.respuestas, { ...r, titulo: '' }] }));
      setNuevaId(r.id);
      avisos.info('Pregunta adicional agregada a esta entrevista.');
    } catch (e) {
      avisos.error(e);
    }
  };

  const quitarPregunta = async (r: Respuesta) => {
    const ok = await confirmar({
      titulo: '¿Quitar la pregunta?',
      mensaje: 'Se quitará esta pregunta surgida en la reunión y su respuesta.',
      confirmar: 'Quitar pregunta',
      peligrosa: true,
    });
    if (!ok) return;
    try {
      await eliminarRespuesta.mutateAsync(r.id);
      setBorrador((b) => ({ ...b, respuestas: b.respuestas.filter((x) => x.id !== r.id) }));
    } catch (e) {
      avisos.error(e);
    }
  };

  const guardarAvance = async () => {
    try {
      await autoguardado.guardarAhora();
      if (entrevista.estado === 'Pendiente') {
        await guardarBorrador.mutateAsync({ entrevistaId: entrevista.id, cambios: { entrevista: {}, respuestas: [] } });
      }
      avisos.exito(MENSAJES.borradorGuardado);
    } catch (e) {
      avisos.error(e);
    }
  };

  const completarEntrevista = async () => {
    setIntentoCompletar(true);
    if (motivos.length > 0) return;
    try {
      await autoguardado.guardarAhora();
      const v = await completar.mutateAsync(entrevista.id);
      avisos.exito('Entrevista completada. El avance quedó guardado sin notificar.');
      if (puedeFinalizar(v)) avisos.info('Levantamiento completo: ya puedes revisar la evaluación y el consolidado.');
    } catch (e) {
      avisos.error(e, 'No se puede completar la entrevista');
    }
  };

  const detalle = [
    entrevista.modalidad,
    entrevista.areaNombre,
    entrevista.fechaHora ? formatearFechaHora(entrevista.fechaHora) : 'Fecha por definir',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tarjeta>
      <div className={styles.cabecera}>
        <div className={styles.titulos}>
          <Text as="h3" size={500} weight="semibold">
            Entrevista {entrevista.numero} · {entrevista.entrevistadoNombre}
          </Text>
          <Text size={200} className={styles.detalle}>
            {detalle}
          </Text>
        </div>
        <div className={styles.estado}>
          {!soloLectura && (
            <IndicadorGuardado estado={autoguardado.estado} mutando={mutando} error={autoguardado.error} />
          )}
          <EstadoBadge estado={entrevista.estado} />
        </div>
      </div>

      {!soloLectura && autoguardado.error && (
        <MessageBar intent="error" layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>No se guardaron los últimos cambios</MessageBarTitle>
            {autoguardado.error}
          </MessageBarBody>
          <MessageBarActions>
            <Button size="small" disabled={ocupado} onClick={() => void guardarAvance()}>
              Reintentar
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}

      <Campos>
        <Field label="Grabación de la entrevista" hint="Enlace a la grabación de Teams en SharePoint/OneDrive.">
          <Input
            type="url"
            value={borrador.urlGrabacion}
            placeholder="https://"
            disabled={soloLectura}
            onChange={(_, d) => cambiarCampo('urlGrabacion', d.value)}
          />
        </Field>
        <EvidenciasEntrevista
          evidencias={evidencias}
          soloLectura={soloLectura}
          ocupado={evidenciasAcciones.ocupado}
          onSubir={(archivos) => void evidenciasAcciones.subir(archivos)}
          onEliminar={(e) => void evidenciasAcciones.eliminar(e)}
        />
      </Campos>

      {definidas.length > 0 && (
        <Text as="h4" className={styles.seccion}>
          Preguntas definidas ({definidas.length})
        </Text>
      )}
      {definidas.map((r) => (
        <RespuestaDefinida
          key={r.id}
          respuesta={r}
          pregunta={preguntas.find((p) => p.id === r.preguntaId)}
          opciones={opciones.filter((o) => o.preguntaId === r.preguntaId)}
          criterioNombre={criterios.find((c) => c.id === r.criterioId)?.titulo ?? ''}
          soloLectura={soloLectura}
          onChange={(c) => cambiarRespuesta(r.id, c)}
        />
      ))}

      {surgidas.length > 0 && (
        <Text as="h4" className={styles.seccion}>
          Preguntas surgidas en la reunión ({surgidas.length})
        </Text>
      )}
      {surgidas.map((r) => (
        <PreguntaSurgida
          key={r.id}
          respuesta={r}
          criterios={criteriosActivos}
          evidencias={evidencias}
          soloLectura={soloLectura}
          enfocar={r.id === nuevaId}
          onChange={(c) => cambiarRespuesta(r.id, c)}
          onEliminar={() => void quitarPregunta(r)}
          onVincular={(evidenciaId) => void evidenciasAcciones.vincular(r.id, evidenciaId, evidencias)}
          onSubirVinculada={(archivos) => void evidenciasAcciones.subir(archivos, r.id)}
        />
      ))}

      {!soloLectura && (
        <div>
          <Button
            icon={iconoOcupado(agregarSurgida.isPending, <CommentAdd24Regular />)}
            disabled={agregarSurgida.isPending}
            onClick={nuevaPregunta}
          >
            Agregar pregunta surgida en la reunión
          </Button>
        </div>
      )}

      <Text as="h4" className={styles.seccion}>
        Conclusiones de la entrevista
      </Text>
      <Campos>
        <Field label="Oportunidades de mejora" hint="Una por línea.">
          <Textarea
            rows={3}
            resize="vertical"
            value={borrador.oportunidadesMejora}
            disabled={soloLectura}
            onChange={(_, d) => cambiarCampo('oportunidadesMejora', d.value)}
          />
        </Field>
        <Field label="Recomendaciones de la entrevista" hint="Una por línea.">
          <Textarea
            rows={3}
            resize="vertical"
            value={borrador.recomendaciones}
            disabled={soloLectura}
            onChange={(_, d) => cambiarCampo('recomendaciones', d.value)}
          />
        </Field>
      </Campos>

      {intentoCompletar && entrevista.estado !== 'Completa' && (
        <ListaMotivos titulo="Antes de completar la entrevista" motivos={motivos} />
      )}

      {!soloLectura && (
        <Acciones>
          <Button
            icon={iconoOcupado(guardarBorrador.isPending && !completar.isPending, <Save24Regular />)}
            disabled={ocupado}
            onClick={guardarAvance}
          >
            Guardar avance sin notificar
          </Button>
          {entrevista.estado !== 'Completa' && (
            <Button
              appearance="primary"
              icon={iconoOcupado(completar.isPending, <Checkmark24Regular />)}
              disabled={ocupado}
              onClick={completarEntrevista}
            >
              {completar.isPending ? 'Completando…' : 'Completar entrevista'}
            </Button>
          )}
        </Acciones>
      )}
    </Tarjeta>
  );
}
