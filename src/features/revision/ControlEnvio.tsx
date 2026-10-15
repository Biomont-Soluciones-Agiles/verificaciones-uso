import {
  Button,
  Field,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Switch,
  Text,
  tokens,
} from '@fluentui/react-components';
import { CheckmarkCircle24Regular, Clock24Regular, Save24Regular, Send24Regular } from '@fluentui/react-icons';
import { MENSAJES, useAvisos } from '../../components/avisos';
import { useConfirmar } from '../../components/Confirmacion';
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaMotivos, Tarjeta } from '../../components/Estructura';
import { iconoOcupado } from '../../components/iconoOcupado';
import { PersonaPicker } from '../../components/PersonaPicker';
import { useFuenteDatos } from '../../data/contexto';
import {
  useAprobaciones,
  useFinalizarYEnviar,
  useGuardarConsolidado,
  useSimularLevantamiento,
} from '../../data/hooks/useVerificaciones';
import type { DatosConsolidado } from '../../data/servicios';
import { formatearFechaHora } from '../../domain/fechas';
import { esEditableDesdeApp, puedeFinalizar, validarEnvio } from '../../domain/flujo';
import type { PuntajeCriterio, Verificacion } from '../../domain/tipos';

const useStyles = makeStyles({
  botones: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  boton: { width: '100%' },
  aprobacion: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    paddingBlock: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  aprobacionTextos: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  nota: { color: tokens.colorNeutralForeground3 },
  persona: { display: 'flex', flexDirection: 'column', minWidth: 0 },
});

export interface ControlEnvioProps {
  verificacion: Verificacion;
  completas: number;
  puntajes: PuntajeCriterio[];
  datos: DatosConsolidado;
  onCambiar: <K extends keyof DatosConsolidado>(campo: K, valor: DatosConsolidado[K]) => void;
}

function Aprobaciones({ verificacion }: { verificacion: Verificacion }) {
  const styles = useStyles();
  const { data: aprobaciones = [] } = useAprobaciones(verificacion.id);
  if (aprobaciones.length === 0) {
    return (
      <Text size={200} className={styles.nota}>
        El flujo de aprobación registrará aquí la decisión de la aprobadora.
      </Text>
    );
  }
  return (
    <>
      {aprobaciones.map((a) => (
        <div key={a.id} className={styles.aprobacion}>
          <span className={styles.aprobacionTextos}>
            <Text weight="semibold">{a.aprobador.nombre}</Text>
            <Text size={200} className={styles.nota}>
              Solicitada {formatearFechaHora(a.fechaSolicitud)}
              {a.fechaDecision ? ` · decidida ${formatearFechaHora(a.fechaDecision)}` : ''}
            </Text>
            {a.comentario.trim() && <Text size={200}>“{a.comentario.trim()}”</Text>}
          </span>
          <EstadoBadge estado={a.decision} />
        </div>
      ))}
    </>
  );
}

/** "Control del envío": RN-06/RN-07, aprobadora de la verificación (RN-08) y finalización. */
export function ControlEnvio({ verificacion, completas, puntajes, datos, onCambiar }: ControlEnvioProps) {
  const styles = useStyles();
  const avisos = useAvisos();
  const confirmar = useConfirmar();
  const fuente = useFuenteDatos();
  const guardar = useGuardarConsolidado(verificacion.id);
  const finalizar = useFinalizarYEnviar(verificacion.id);
  const simular = useSimularLevantamiento(verificacion.id);

  const editable = esEditableDesdeApp(verificacion.estado);
  const completo = puedeFinalizar({ entrevistasCompletas: completas, entrevistasPrevistas: verificacion.entrevistasPrevistas });
  const motivos = validarEnvio(
    { ...verificacion, entrevistasCompletas: completas, aprobadorPiloto: datos.aprobadorPiloto },
    puntajes,
  );
  // El aviso de levantamiento incompleto ya se muestra arriba; aquí solo los demás motivos.
  const otrosMotivos = completo ? motivos : [];
  const ocupado = guardar.isPending || finalizar.isPending || simular.isPending;

  const guardarBorrador = async () => {
    try {
      await guardar.mutateAsync(datos);
      avisos.exito(MENSAJES.borradorGuardado);
    } catch (e) {
      avisos.error(e);
    }
  };

  const enviar = async () => {
    const aprobadora = datos.aprobadorPiloto?.nombre ?? 'la aprobadora';
    const ok = await confirmar({
      titulo: '¿Enviar a revisión?',
      mensaje: `Se enviará el consolidado y se notificará por primera vez a ${aprobadora}. Después ya no podrás editarlo desde la app.`,
      confirmar: 'Enviar a revisión',
    });
    if (!ok) return;
    try {
      await finalizar.mutateAsync(datos);
      avisos.exito('Consolidado enviado a la aprobadora de la verificación.');
    } catch (e) {
      avisos.error(e, 'No se pudo enviar a revisión');
    }
  };

  const simularCompletas = async () => {
    try {
      await simular.mutateAsync();
      avisos.info(`Simulación: las ${verificacion.entrevistasPrevistas} entrevistas están completas.`);
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Tarjeta titulo="Control del envío">
      {!editable ? (
        <MessageBar intent="success" icon={<Send24Regular />} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Enviado a revisión</MessageBarTitle>
            {verificacion.fechaEnvio ? `Enviado el ${formatearFechaHora(verificacion.fechaEnvio)}. ` : ''}
            Estado actual: {verificacion.estado}.
          </MessageBarBody>
        </MessageBar>
      ) : completo ? (
        <MessageBar intent="success" icon={<CheckmarkCircle24Regular />} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>Levantamiento completo</MessageBarTitle>
            Ya puedes enviar el consolidado. Esta será la primera notificación a la aprobadora.
          </MessageBarBody>
        </MessageBar>
      ) : (
        <MessageBar intent="warning" icon={<Clock24Regular />} layout="multiline">
          <MessageBarBody>
            <MessageBarTitle>El levantamiento aún está incompleto</MessageBarTitle>
            Completa las entrevistas pendientes ({completas} de {verificacion.entrevistasPrevistas}). Hasta entonces, todo
            se guarda sin avisar a la aprobadora.
          </MessageBarBody>
        </MessageBar>
      )}

      <Field label="Responsable de la verificación">
        {verificacion.responsable ? (
          <span className={styles.persona}>
            <Text>{verificacion.responsable.nombre}</Text>
            <Text size={200} className={styles.nota}>
              {verificacion.responsable.email}
            </Text>
          </span>
        ) : (
          <Text className={styles.nota}>Sin responsable</Text>
        )}
      </Field>
      <Field label="Aprobadora de la verificación" required hint="Recibe el consolidado y decide: aprobar u observar.">
        <PersonaPicker
          valor={datos.aprobadorPiloto}
          deshabilitado={!editable}
          onChange={(p) => onCambiar('aprobadorPiloto', p)}
        />
      </Field>
      <Switch
        label="Notificar al finalizar"
        checked={completo && datos.notificarAlFinalizar}
        disabled={!editable || !completo}
        onChange={(_, d) => onCambiar('notificarAlFinalizar', d.checked)}
      />

      {editable && <ListaMotivos titulo="Antes de enviar" motivos={otrosMotivos} />}

      {editable && (
        <div className={styles.botones}>
          <Button
            className={styles.boton}
            appearance="primary"
            icon={iconoOcupado(finalizar.isPending, <Send24Regular />)}
            disabled={ocupado || motivos.length > 0}
            onClick={enviar}
          >
            {finalizar.isPending ? 'Enviando…' : 'Finalizar y enviar a revisión'}
          </Button>
          <Button
            className={styles.boton}
            icon={iconoOcupado(guardar.isPending, <Save24Regular />)}
            disabled={ocupado}
            onClick={guardarBorrador}
          >
            {guardar.isPending ? 'Guardando…' : 'Guardar borrador sin notificar'}
          </Button>
          {fuente === 'mock' && !completo && (
            <Button className={styles.boton} appearance="subtle" disabled={ocupado} onClick={simularCompletas}>
              Simular todas las entrevistas completas (demo)
            </Button>
          )}
        </div>
      )}

      {!editable && <Aprobaciones verificacion={verificacion} />}
    </Tarjeta>
  );
}
