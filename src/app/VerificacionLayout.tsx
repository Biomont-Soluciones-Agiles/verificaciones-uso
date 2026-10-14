import { makeStyles } from '@fluentui/react-components';
import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Cargando, ErrorCarga, Pila } from '../components/Estructura';
import { useVerificacion } from '../data/hooks/useVerificaciones';
import { idDeTexto } from '../domain/codigo';
import { etapasCompletadas } from '../domain/flujo';
import { CURVA_SALIDA, DURACION, fundir, MENOS_MOVIMIENTO } from './movimiento';
import { Stepper } from './Stepper';
import { recordarVerificacion } from './verificacionActiva';

const RUTA_POR_ETAPA = ['programacion', 'entrevistas', 'evaluacion', 'revision', 'revision'] as const;

const useStyles = makeStyles({
  // La pantalla nueva entra desde el lado hacia el que se avanza en el proceso (`--desde`, ±12px).
  etapa: {
    animationName: {
      from: { opacity: 0, transform: 'translateX(var(--desde, 0px))' },
      to: { opacity: 1, transform: 'none' },
    },
    animationDuration: DURACION.vista,
    animationTimingFunction: CURVA_SALIDA,
    [MENOS_MOVIMIENTO]: { animationName: fundir, animationDuration: DURACION.inmediata },
  },
});

/** Rutas `/verificaciones/:id/*`: carga la verificación, muestra el stepper y la pasa a la pantalla hija. */
export function VerificacionLayout() {
  const styles = useStyles();
  const anterior = useRef<number | null>(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const verificacionId = idDeTexto(id);
  const valido = verificacionId !== null;
  const { data: verificacion, isPending, error } = useVerificacion(verificacionId);

  useEffect(() => {
    if (verificacionId) recordarVerificacion(verificacionId);
  }, [verificacionId]);

  const seccion = pathname.split('/').pop();
  const indiceSeccion = Math.max(0, RUTA_POR_ETAPA.indexOf(seccion as (typeof RUTA_POR_ETAPA)[number]));
  // Dirección del último cambio de etapa: se calcula al renderizar y se guarda después.
  const desde = anterior.current === null || anterior.current === indiceSeccion ? 0 : indiceSeccion > anterior.current ? 12 : -12;
  useEffect(() => {
    anterior.current = indiceSeccion;
  }, [indiceSeccion]);

  if (!valido) return <ErrorCarga error={new Error(`"${id}" no es un identificador de verificación válido.`)} />;
  if (error) return <ErrorCarga error={error} titulo="No se pudo abrir la verificación" />;
  if (isPending || !verificacion) return <Cargando texto="Abriendo la verificación…" />;

  const enviada = ['En revisión', 'Aprobada piloto', 'Aprobada'].includes(verificacion.estado);
  const actual =
    seccion === 'entrevistas' ? 1 : seccion === 'evaluacion' ? 2 : seccion === 'revision' ? (enviada ? 4 : 3) : 0;

  return (
    <Pila>
      <Stepper
        actual={actual}
        completadas={etapasCompletadas(verificacion)}
        onSeleccionar={(i) => navigate(`/verificaciones/${verificacionId}/${RUTA_POR_ETAPA[i]}`)}
      />
      <div key={seccion} className={styles.etapa} style={{ '--desde': `${desde}px` } as React.CSSProperties}>
        <Outlet context={verificacion} />
      </div>
    </Pila>
  );
}
