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
import { EstadoBadge } from '../../components/EstadoBadge';
import { ListaMotivos, Tarjeta } from '../../components/Estructura';
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
  boton: { width: '100%' },
  aprobacion: { display: 'flex', justifyContent: 'space-between', gap: tokens.spacingHorizontalS, alignItems: 'center' },
  nota: { color: tokens.colorNeutralForeground3 },
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
        El flujo de aprobación registrará aquí las decisiones de cada nivel.
      </Text>
    );
  }
  return (
    <>
      {aprobaciones.map((a) => (
        <div key={a.id} className={styles.aprobacion}>
          <span>
            <Text weight="semibold">Nivel {a.nivel}</Text>
            <br />
            <Text size={200} className={styles.nota}>
              {a.aprobador.nombre} · solicitada {formatearFechaHora(a.fechaSolicitud)}
            </Text>
          </span>
          <EstadoBadge estado={a.decision} />
        </div>
      ))}
    </>
  );
}

/** "Control del envío": RN-06/RN-07, aprobadoras (RN-08) y finalización. */
export function ControlEnvio({ verificacion, completas, puntajes, datos, onCambiar }: ControlEnvioProps) {
  const styles = useStyles();
  const avisos = useAvisos();
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
    if (!window.confirm(`Se enviará el consolidado a revisión y se notificará por primera vez a ${aprobadora}. ¿Continuar?`)) {
      return;
    }
    try {
      await finalizar.mutateAsync(datos);
      avisos.exito('Consolidado enviado a la aprobadora del piloto.');
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

      <Field label="Aprobadora del piloto" required>
        <PersonaPicker
          valor={datos.aprobadorPiloto}
          deshabilitado={!editable}
          onChange={(p) => onCambiar('aprobadorPiloto', p)}
        />
      </Field>
      <Field label="Aprobadora productiva posterior">
        <PersonaPicker
          valor={datos.aprobadorProductivo}
          deshabilitado={!editable}
          onChange={(p) => onCambiar('aprobadorProductivo', p)}
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
        <>
          <Button icon={<Save24Regular />} disabled={ocupado} onClick={guardarBorrador}>
            Guardar borrador sin notificar
          </Button>
          <Button
            className={styles.boton}
            appearance="primary"
            icon={<Send24Regular />}
            disabled={ocupado || motivos.length > 0}
            onClick={enviar}
          >
            Finalizar y enviar a revisión
          </Button>
          {fuente === 'mock' && !completo && (
            <Button appearance="subtle" disabled={ocupado} onClick={simularCompletas}>
              Simular todas las entrevistas completas (demo)
            </Button>
          )}
        </>
      )}

      {!editable && <Aprobaciones verificacion={verificacion} />}
    </Tarjeta>
  );
}
