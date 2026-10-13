import { Badge, Button, makeStyles, Text, tokens, Tooltip } from '@fluentui/react-components';
import {
  CalendarClock24Regular,
  ChatMultiple24Regular,
  ClipboardTaskListLtr24Regular,
  Gauge24Regular,
  Grid24Regular,
  Settings24Regular,
} from '@fluentui/react-icons';
import type { ReactElement } from 'react';
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useFuenteDatos } from '../data/contexto';
import { useVerificacion, useVerificaciones } from '../data/hooks/useVerificaciones';
import { esVerificacionActiva, estaSinNotificar } from '../domain/flujo';
import type { Verificacion } from '../domain/tipos';
import { useVerificacionRecordada } from './verificacionActiva';

const useStyles = makeStyles({
  raiz: { minHeight: '100vh', backgroundColor: tokens.colorNeutralBackground2 },
  cabecera: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    '@media (max-width: 640px)': { paddingInline: tokens.spacingHorizontalL },
  },
  marca: { display: 'flex', alignItems: 'baseline', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
  subtitulo: { color: tokens.colorNeutralForeground3 },
  barra: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacingHorizontalS },
  espaciador: { marginLeft: 'auto', '@media (max-width: 640px)': { marginLeft: 0 } },
  contenido: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalXL}`,
    '@media (max-width: 640px)': { padding: tokens.spacingHorizontalL },
  },
});

type Seccion = 'catalogo' | 'programacion' | 'entrevistas' | 'evaluacion' | 'revision' | 'admin';

interface ItemNavegacion {
  seccion: Seccion;
  texto: string;
  icono: ReactElement;
  ruta: string | null;
}

function seccionDeRuta(pathname: string): Seccion | null {
  if (pathname.startsWith('/catalogo')) return 'catalogo';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/programar')) return 'programacion';
  const m = /^\/verificaciones\/\d+\/(programacion|entrevistas|evaluacion|revision)/.exec(pathname);
  return m ? (m[1] as Seccion) : null;
}

function textoEstado(v: Verificacion): string {
  const codigo = v.codigo || `#${v.id}`;
  if (v.estado === 'En revisión') return `${codigo} · Enviado a revisión`;
  return `${codigo} · ${v.estado}${estaSinNotificar(v.estado) ? ' · sin notificaciones' : ''}`;
}

/** Cabecera con la barra de pantallas (como el prototipo) y el contenido de la ruta. */
export function Layout() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const fuente = useFuenteDatos();
  const match = useMatch('/verificaciones/:id/*');
  const recordada = useVerificacionRecordada();
  const { data: verificaciones } = useVerificaciones();

  const idRuta = match ? Number(match.params.id) : NaN;
  const predeterminada =
    verificaciones
      ?.filter((v) => esVerificacionActiva(v.estado))
      .sort((a, b) => b.id - a.id)[0]?.id ?? null;
  const idActiva = Number.isInteger(idRuta) && idRuta > 0 ? idRuta : (recordada ?? predeterminada);
  const { data: verificacion } = useVerificacion(idActiva);

  const rutaVerificacion = (s: string) => (idActiva ? `/verificaciones/${idActiva}/${s}` : null);
  const items: ItemNavegacion[] = [
    { seccion: 'catalogo', texto: 'Catálogo', icono: <Grid24Regular />, ruta: '/catalogo' },
    {
      seccion: 'programacion',
      texto: 'Programación',
      icono: <CalendarClock24Regular />,
      ruta: rutaVerificacion('programacion') ?? '/programar',
    },
    { seccion: 'entrevistas', texto: 'Entrevistas', icono: <ChatMultiple24Regular />, ruta: rutaVerificacion('entrevistas') },
    { seccion: 'evaluacion', texto: 'Evaluación', icono: <Gauge24Regular />, ruta: rutaVerificacion('evaluacion') },
    {
      seccion: 'revision',
      texto: 'Revisión final',
      icono: <ClipboardTaskListLtr24Regular />,
      ruta: rutaVerificacion('revision'),
    },
    { seccion: 'admin', texto: 'Administración', icono: <Settings24Regular />, ruta: '/admin' },
  ];
  const seccionActual = seccionDeRuta(pathname);

  return (
    <div className={styles.raiz}>
      <header className={styles.cabecera}>
        <div className={styles.marca}>
          <Text as="h1" size={500} weight="semibold">
            Verificación de uso
          </Text>
          <Text className={styles.subtitulo}>Soluciones digitales</Text>
          {fuente === 'mock' && (
            <Badge appearance="outline" color="informative">
              Datos de ejemplo
            </Badge>
          )}
        </div>
        <nav className={styles.barra} aria-label="Pantallas">
          {items.map((item) => {
            const activo = item.seccion === seccionActual;
            const boton = (
              <Button
                key={item.seccion}
                appearance={activo ? 'primary' : 'secondary'}
                icon={item.icono}
                aria-current={activo ? 'page' : undefined}
                disabled={!item.ruta}
                onClick={() => item.ruta && navigate(item.ruta)}
              >
                {item.texto}
              </Button>
            );
            return item.ruta ? (
              boton
            ) : (
              <Tooltip key={item.seccion} content="Programa o abre una verificación primero" relationship="description">
                {boton}
              </Tooltip>
            );
          })}
          {verificacion && (
            <Badge
              className={styles.espaciador}
              appearance="tint"
              color={estaSinNotificar(verificacion.estado) ? 'informative' : 'brand'}
              size="large"
            >
              {textoEstado(verificacion)}
            </Badge>
          )}
        </nav>
      </header>
      <main className={styles.contenido}>
        <Outlet />
      </main>
    </div>
  );
}
