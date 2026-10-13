import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Cargando, ErrorCarga, Pila } from '../components/Estructura';
import { useVerificacion } from '../data/hooks/useVerificaciones';
import { etapasCompletadas } from '../domain/flujo';
import { Stepper } from './Stepper';
import { recordarVerificacion } from './verificacionActiva';

const RUTA_POR_ETAPA = ['programacion', 'entrevistas', 'evaluacion', 'revision', 'revision'] as const;

/** Rutas `/verificaciones/:id/*`: carga la verificación, muestra el stepper y la pasa a la pantalla hija. */
export function VerificacionLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const verificacionId = Number(id);
  const valido = Number.isInteger(verificacionId) && verificacionId > 0;
  const { data: verificacion, isPending, error } = useVerificacion(valido ? verificacionId : null);

  useEffect(() => {
    if (valido) recordarVerificacion(verificacionId);
  }, [valido, verificacionId]);

  if (!valido) return <ErrorCarga error={new Error(`"${id}" no es un identificador de verificación válido.`)} />;
  if (error) return <ErrorCarga error={error} titulo="No se pudo abrir la verificación" />;
  if (isPending || !verificacion) return <Cargando texto="Abriendo la verificación…" />;

  const seccion = pathname.split('/').pop();
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
      <Outlet context={verificacion} />
    </Pila>
  );
}
