import { Badge, Button, makeStyles, Text, tokens, Tooltip } from '@fluentui/react-components';
import {
  CalendarClock24Regular,
  ChatMultiple24Regular,
  ClipboardTaskListLtr24Regular,
  Gauge24Regular,
  Grid24Regular,
  Settings24Regular,
} from '@fluentui/react-icons';
import { useEffect, type ReactElement } from 'react';
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useFuenteDatos } from '../data/contexto';
import { useVerificacion, useVerificaciones } from '../data/hooks/useVerificaciones';
import { compararCodigoDesc, idDeTexto } from '../domain/codigo';
import { esVerificacionActiva, estaSinNotificar } from '../domain/flujo';
import type { Verificacion } from '../domain/tipos';
import { useVerificacionRecordada } from './verificacionActiva';

const useStyles = makeStyles({
  raiz: { minHeight: '100vh', backgroundColor: tokens.colorNeutralBackground2 },
  saltar: {
    position: 'absolute',
    left: tokens.spacingHorizontalM,
    top: '-100px',
    zIndex: 2,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorBrandForegroundLink,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow8,
    ':focus': { top: tokens.spacingVerticalS },
  },
  // Como en biomont.com.pe: franja superior roja con texto blanco y, debajo, la barra
  // de navegación blanca con sombra suave.
  cabecera: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    '@media (max-width: 640px)': { position: 'static' },
  },
  filaMarca: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalXL,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    '@media (max-width: 640px)': { paddingInline: tokens.spacingHorizontalL },
  },
  marca: { display: 'flex', alignItems: 'baseline', gap: tokens.spacingHorizontalS, flexWrap: 'wrap', minWidth: 0 },
  titulo: { color: tokens.colorNeutralForegroundOnBrand, fontWeight: tokens.fontWeightBold },
  subtitulo: { color: tokens.colorNeutralForegroundOnBrand },
  barra: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    // En pantallas estrechas la barra se desplaza en horizontal en vez de ocupar varias filas.
    overflowX: 'auto',
    scrollbarWidth: 'thin',
    paddingInline: `calc(${tokens.spacingHorizontalXL} - ${tokens.spacingHorizontalXS})`,
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    '@media (max-width: 640px)': {
      paddingInline: `calc(${tokens.spacingHorizontalL} - ${tokens.spacingHorizontalXS})`,
    },
  },
  item: { flexShrink: 0, whiteSpace: 'nowrap' },
  contenido: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalXL}`,
    ':focus': { outline: 'none' },
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

  const idRuta = idDeTexto(match?.params.id);
  const predeterminada =
    verificaciones
      ?.filter((v) => esVerificacionActiva(v.estado))
      .sort(compararCodigoDesc)[0]?.id ?? null;
  const idActiva = idRuta ?? recordada ?? predeterminada;
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

  // El HashRouter no restaura el scroll: al cambiar de pantalla se vuelve arriba.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className={styles.raiz}>
      <a href="#contenido" className={styles.saltar} onClick={(e) => {
        e.preventDefault();
        document.getElementById('contenido')?.focus();
      }}>
        Saltar al contenido
      </a>
      <header className={styles.cabecera}>
        <div className={styles.filaMarca}>
          <div className={styles.marca}>
            <Text as="h1" size={500} className={styles.titulo}>
              Verificación de uso
            </Text>
            <Text className={styles.subtitulo}>Soluciones digitales</Text>
            {fuente === 'mock' && (
              <Badge appearance="tint" color="informative">
                Datos de ejemplo
              </Badge>
            )}
          </div>
          {verificacion && (
            <Badge
              appearance="tint"
              color={estaSinNotificar(verificacion.estado) ? 'informative' : 'brand'}
              size="large"
              aria-label={`Verificación activa: ${textoEstado(verificacion)}`}
            >
              {textoEstado(verificacion)}
            </Badge>
          )}
        </div>
        <nav className={styles.barra} aria-label="Pantallas">
          {items.map((item) => {
            const activo = item.seccion === seccionActual;
            const boton = (
              <Button
                key={item.seccion}
                className={styles.item}
                appearance={activo ? 'primary' : 'subtle'}
                shape="circular"
                icon={item.icono}
                aria-current={activo ? 'page' : undefined}
                disabledFocusable={!item.ruta}
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
        </nav>
      </header>
      <main id="contenido" tabIndex={-1} className={styles.contenido}>
        <Outlet />
      </main>
    </div>
  );
}
