import { useSearchParams } from 'react-router-dom';
import { Stepper } from '../../app/Stepper';
import { useVerificacionDeRuta } from '../../app/useVerificacionDeRuta';
import { Cargando, ErrorCarga, Pila } from '../../components/Estructura';
import { useUsuarioActual } from '../../data/hooks/useCatalogo';
import { useSoluciones } from '../../data/hooks/useSoluciones';
import { useVerificaciones } from '../../data/hooks/useVerificaciones';
import { sumarDias, hoyISO } from '../../domain/fechas';
import { esVerificacionActiva } from '../../domain/flujo';
import type { Solucion } from '../../domain/tipos';
import { FormularioProgramacion, OBJETIVO_PREDETERMINADO, type ValoresProgramacion } from './FormularioProgramacion';

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
        fechaObjetivo: verificacion.fechaObjetivo,
        diasAnticipacion: verificacion.diasAnticipacion,
        entrevistasPrevistas: verificacion.entrevistasPrevistas,
        modalidad: verificacion.modalidad,
        objetivo: verificacion.objetivo,
      }}
    />
  );
}

function valoresIniciales(
  soluciones: Solucion[],
  solucionId: number | null,
  responsable: ValoresProgramacion['responsable'],
): ValoresProgramacion {
  const solucion = soluciones.find((s) => s.id === solucionId) ?? null;
  const hoy = hoyISO();
  const propuesta = solucion?.proximaVU && solucion.proximaVU > hoy ? solucion.proximaVU : sumarDias(hoy, 45);
  return {
    solucionId: solucion?.id ?? null,
    responsable,
    fechaObjetivo: propuesta,
    diasAnticipacion: 15,
    entrevistasPrevistas: 4,
    modalidad: 'Teams',
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

  const solicitada = Number(params.get('solucion')) || null;
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
