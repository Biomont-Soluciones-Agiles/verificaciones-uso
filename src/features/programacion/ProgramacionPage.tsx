import { useSearchParams } from 'react-router-dom';
import { Stepper } from '../../app/Stepper';
import { useVerificacionDeRuta } from '../../app/useVerificacionDeRuta';
import { Cargando, ErrorCarga, Pila } from '../../components/Estructura';
import { useUsuarioActual } from '../../data/hooks/useCatalogo';
import { useSoluciones } from '../../data/hooks/useSoluciones';
import { useVerificaciones } from '../../data/hooks/useVerificaciones';
import { idDeTexto } from '../../domain/codigo';
import { sumarDias, hoyISO } from '../../domain/fechas';
import { esVerificacionActiva } from '../../domain/flujo';
import type { DiasAnticipacion, Id, Modalidad, Solucion } from '../../domain/tipos';
import { FormularioProgramacion, OBJETIVO_PREDETERMINADO, type ValoresProgramacion } from './FormularioProgramacion';

const DIAS_ANTICIPACION_PREDETERMINADOS: DiasAnticipacion = 15;
const MODALIDAD_PREDETERMINADA: Modalidad = 'Teams';

/** `/verificaciones/:id/programacion`: programación de una verificación existente. */
export function ProgramacionPage() {
  const verificacion = useVerificacionDeRuta();
  const { data: soluciones, isPending, error } = useSoluciones();
  if (error) return <ErrorCarga error={error} />;
  if (isPending) return <Cargando />;
  return (
    <FormularioProgramacion
      key={verificacion.id}
      verificacion={verificacion}
      soluciones={soluciones}
      inicial={{
        solucionId: verificacion.solucionId,
        responsable: verificacion.responsable,
        // Las verificaciones históricas llegan sin estos datos: fecha vacía y valores por defecto.
        fechaObjetivo: verificacion.fechaObjetivo ?? '',
        diasAnticipacion: verificacion.diasAnticipacion ?? DIAS_ANTICIPACION_PREDETERMINADOS,
        entrevistasPrevistas: verificacion.entrevistasPrevistas,
        modalidad: verificacion.modalidad ?? MODALIDAD_PREDETERMINADA,
        objetivo: verificacion.objetivo,
      }}
    />
  );
}

function valoresIniciales(
  soluciones: Solucion[],
  solucionId: Id | null,
  responsable: ValoresProgramacion['responsable'],
): ValoresProgramacion {
  const solucion = soluciones.find((s) => s.id === solucionId) ?? null;
  const hoy = hoyISO();
  const propuesta = solucion?.proximaVU && solucion.proximaVU > hoy ? solucion.proximaVU : sumarDias(hoy, 45);
  return {
    solucionId: solucion?.id ?? null,
    responsable,
    fechaObjetivo: propuesta,
    diasAnticipacion: DIAS_ANTICIPACION_PREDETERMINADOS,
    entrevistasPrevistas: 4,
    modalidad: MODALIDAD_PREDETERMINADA,
    objetivo: OBJETIVO_PREDETERMINADO,
  };
}

/** `/programar?solucion=ID`: nueva verificación (todavía sin ID). */
export function NuevaProgramacionPage() {
  const [params] = useSearchParams();
  const soluciones = useSoluciones();
  const verificaciones = useVerificaciones();
  const usuario = useUsuarioActual();

  const error = soluciones.error ?? verificaciones.error;
  if (error) return <ErrorCarga error={error} />;
  if (!soluciones.data || !verificaciones.data || usuario.isPending) return <Cargando />;
  const listaSoluciones = soluciones.data;

  const solicitada = idDeTexto(params.get('solucion'));
  const conActiva = new Set(verificaciones.data.filter((v) => esVerificacionActiva(v.estado)).map((v) => v.solucionId));
  const solucionId =
    solicitada && !conActiva.has(solicitada)
      ? solicitada
      : (listaSoluciones.find((s) => !conActiva.has(s.id))?.id ?? null);

  return (
    <Pila>
      <Stepper actual={0} />
      <FormularioProgramacion
        key={solucionId ?? 'nueva'}
        soluciones={listaSoluciones}
        inicial={valoresIniciales(listaSoluciones, solucionId, usuario.data ?? null)}
      />
    </Pila>
  );
}
