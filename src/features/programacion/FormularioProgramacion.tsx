import {
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Select,
  Textarea,
} from '@fluentui/react-components';
import { AlertOn24Regular, Dismiss24Regular, Save24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MENSAJES, useAvisos } from '../../components/avisos';
import { EstadoBadge } from '../../components/EstadoBadge';
import { Acciones, Campos, DosColumnas, Encabezado, ListaMotivos, Pila, Tarjeta } from '../../components/Estructura';
import { PersonaPicker } from '../../components/PersonaPicker';
import { useCancelarVerificacion, useProgramarVerificacion, useVerificaciones } from '../../data/hooks/useVerificaciones';
import { calcularFechaAlerta, compararFechas, esFechaValida, formatearFecha, hoyISO } from '../../domain/fechas';
import { esVerificacionActiva, validarProgramacion } from '../../domain/flujo';
import {
  DIAS_ANTICIPACION,
  MODALIDADES,
  type DiasAnticipacion,
  type Id,
  type Modalidad,
  type Persona,
  type Solucion,
  type Verificacion,
} from '../../domain/tipos';
import { MaterialSolucion } from './MaterialSolucion';

export const OBJETIVO_PREDETERMINADO =
  'Validar frecuencia, cobertura, sustitución del proceso anterior y satisfacción de los usuarios.';

export interface ValoresProgramacion {
  solucionId: Id | null;
  responsable: Persona | null;
  fechaObjetivo: string;
  diasAnticipacion: DiasAnticipacion;
  entrevistasPrevistas: number;
  modalidad: Modalidad;
  objetivo: string;
}

export interface FormularioProgramacionProps {
  /** Ausente al programar una verificación nueva. */
  verificacion?: Verificacion;
  soluciones: Solucion[];
  inicial: ValoresProgramacion;
}

function BannerAlerta({ valores, verificacion }: { valores: ValoresProgramacion; verificacion?: Verificacion }) {
  if (!esFechaValida(valores.fechaObjetivo)) {
    return (
      <MessageBar intent="info" icon={<AlertOn24Regular />}>
        <MessageBarBody>Indica la fecha objetivo para calcular la alerta.</MessageBarBody>
      </MessageBar>
    );
  }
  const alerta = calcularFechaAlerta(valores.fechaObjetivo, valores.diasAnticipacion);
  const pasada = compararFechas(alerta, hoyISO()) < 0;
  const enviada = verificacion?.alertaEnviada && verificacion.fechaAlerta === alerta;
  return (
    <MessageBar intent={pasada && !enviada ? 'warning' : 'info'} icon={<AlertOn24Regular />} layout="multiline">
      <MessageBarBody>
        <MessageBarTitle>
          {enviada ? 'Alerta enviada' : 'Alerta prevista'}: {formatearFecha(alerta)}
        </MessageBarTitle>
        Se avisará a la responsable para que empiece a coordinar las entrevistas. No se notificará a la aprobadora
        todavía.
        {pasada && !enviada && ' La fecha ya pasó: el aviso saldrá en la próxima ejecución diaria del flujo.'}
      </MessageBarBody>
    </MessageBar>
  );
}

export function FormularioProgramacion({ verificacion, soluciones, inicial }: FormularioProgramacionProps) {
  const navigate = useNavigate();
  const avisos = useAvisos();
  const programar = useProgramarVerificacion();
  const cancelar = useCancelarVerificacion();
  const { data: verificaciones = [] } = useVerificaciones();
  const [valores, setValores] = useState<ValoresProgramacion>(inicial);
  const [intentado, setIntentado] = useState(false);

  const estado = verificacion?.estado ?? 'Borrador';
  const editable = estado === 'Borrador' || estado === 'Programada';
  const ocupado = programar.isPending || cancelar.isPending;
  const errores = validarProgramacion(valores);
  const activaPorSolucion = new Map(
    verificaciones
      .filter((v) => esVerificacionActiva(v.estado) && v.id !== verificacion?.id)
      .map((v) => [v.solucionId, v.codigo]),
  );

  const cambiar = <K extends keyof ValoresProgramacion>(campo: K, valor: ValoresProgramacion[K]) =>
    setValores((v) => ({ ...v, [campo]: valor }));

  const guardar = async (activar: boolean) => {
    setIntentado(true);
    if (errores.length > 0 || valores.solucionId === null || valores.responsable === null) return;
    try {
      const v = await programar.mutateAsync({
        datos: { ...valores, solucionId: valores.solucionId, responsable: valores.responsable },
        activar,
        verificacionId: verificacion?.id,
      });
      avisos.exito(
        activar
          ? `Verificación programada. La alerta se activará el ${formatearFecha(v.fechaAlerta)}.`
          : MENSAJES.borradorGuardado,
      );
      if (!verificacion) navigate(`/verificaciones/${v.id}/programacion`, { replace: true });
    } catch (e) {
      avisos.error(e);
    }
  };

  const cancelarVerificacion = async () => {
    if (!verificacion || !window.confirm(`¿Cancelar la verificación ${verificacion.codigo}?`)) return;
    try {
      await cancelar.mutateAsync(verificacion.id);
      avisos.info(`Verificación ${verificacion.codigo} cancelada.`);
    } catch (e) {
      avisos.error(e);
    }
  };

  const solucion = soluciones.find((s) => s.id === valores.solucionId) ?? null;

  return (
    <Pila>
      <Encabezado
        titulo={verificacion ? `Programar verificación · ${verificacion.codigo}` : 'Programar verificación'}
        subtitulo="Define el periodo y recibe un aviso antes de coordinar las sesiones."
        extra={<EstadoBadge estado={estado} />}
      />
      {!editable && (
        <MessageBar intent="info">
          <MessageBarBody>
            La programación ya no se puede modificar porque la verificación está en estado "{estado}".
          </MessageBarBody>
        </MessageBar>
      )}
      <DosColumnas>
        <Tarjeta>
          <Campos>
            <Field label="Solución digital" required>
              <Select
                value={valores.solucionId?.toString() ?? ''}
                disabled={!!verificacion || !editable}
                onChange={(_, d) => cambiar('solucionId', d.value ? Number(d.value) : null)}
              >
                <option value="">Selecciona…</option>
                {soluciones.map((s) => (
                  <option key={s.id} value={s.id} disabled={activaPorSolucion.has(s.id)}>
                    {s.titulo}
                    {activaPorSolucion.has(s.id) ? ` (${activaPorSolucion.get(s.id)} en curso)` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Responsable de la verificación" required>
              <PersonaPicker
                valor={valores.responsable}
                onChange={(p) => cambiar('responsable', p)}
                deshabilitado={!editable}
              />
            </Field>
            <Field label="Fecha objetivo" required>
              <Input
                type="date"
                value={valores.fechaObjetivo}
                disabled={!editable}
                onChange={(_, d) => cambiar('fechaObjetivo', d.value)}
              />
            </Field>
            <Field label="Avisar con anticipación">
              <Select
                value={String(valores.diasAnticipacion)}
                disabled={!editable}
                onChange={(_, d) => cambiar('diasAnticipacion', Number(d.value) as DiasAnticipacion)}
              >
                {DIAS_ANTICIPACION.map((n) => (
                  <option key={n} value={n}>
                    {n} días antes
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Entrevistas previstas" required hint="Entre 1 y 20">
              <Input
                type="number"
                min={1}
                max={20}
                value={String(valores.entrevistasPrevistas)}
                disabled={!editable}
                onChange={(_, d) => cambiar('entrevistasPrevistas', Number(d.value))}
              />
            </Field>
            <Field label="Modalidad preferida">
              <Select
                value={valores.modalidad}
                disabled={!editable}
                onChange={(_, d) => cambiar('modalidad', d.value as Modalidad)}
              >
                {MODALIDADES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
          </Campos>
          <Field label="Objetivo">
            <Textarea
              rows={3}
              resize="vertical"
              value={valores.objetivo}
              disabled={!editable}
              onChange={(_, d) => cambiar('objetivo', d.value)}
            />
          </Field>
          {intentado && <ListaMotivos titulo="Revisa los datos" motivos={errores} intent="error" />}
          {editable && (
            <Acciones>
              {verificacion && (
                <Button appearance="subtle" icon={<Dismiss24Regular />} disabled={ocupado} onClick={cancelarVerificacion}>
                  Cancelar verificación
                </Button>
              )}
              <Button icon={<Save24Regular />} disabled={ocupado} onClick={() => guardar(false)}>
                {estado === 'Programada' ? 'Guardar cambios' : 'Guardar borrador'}
              </Button>
              {estado === 'Borrador' && (
                <Button appearance="primary" icon={<AlertOn24Regular />} disabled={ocupado} onClick={() => guardar(true)}>
                  Programar y activar alerta
                </Button>
              )}
            </Acciones>
          )}
          {!editable && verificacion && (
            <Acciones>
              <Button appearance="primary" onClick={() => navigate(`/verificaciones/${verificacion.id}/entrevistas`)}>
                Ir a entrevistas
              </Button>
            </Acciones>
          )}
        </Tarjeta>
        <Pila>
          <BannerAlerta valores={valores} verificacion={verificacion} />
          <MaterialSolucion solucion={solucion} />
        </Pila>
      </DosColumnas>
    </Pila>
  );
}
