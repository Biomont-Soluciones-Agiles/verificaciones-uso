import {
  Button,
  Card,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Text,
  tokens,
} from '@fluentui/react-components';
import { ArrowClockwise20Regular } from '@fluentui/react-icons';
import type { ReactElement, ReactNode } from 'react';
import { mensajeDeError } from '../data/errores';

const useStyles = makeStyles({
  encabezado: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  textos: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS, minWidth: 0, maxWidth: '72ch' },
  titulo: { textWrap: 'balance' },
  subtitulo: { color: tokens.colorNeutralForeground2 },
  pila: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  tarjeta: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, padding: tokens.spacingHorizontalL },
  dosColumnas: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(260px, 0.85fr)',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
    '@media (max-width: 760px)': { gridTemplateColumns: '1fr' },
  },
  campos: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalM,
    '@media (max-width: 640px)': { gridTemplateColumns: '1fr' },
  },
  acciones: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
  lineaResumen: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    margin: 0,
  },
  listaResumen: { margin: 0 },
  etiquetaResumen: { color: tokens.colorNeutralForeground2, flexShrink: 0 },
  valorResumen: {
    margin: 0,
    textAlign: 'right',
    minWidth: 0,
    overflowWrap: 'anywhere',
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: 'tabular-nums',
  },
  centro: { padding: tokens.spacingVerticalXXL, display: 'flex', justifyContent: 'center' },
  vacio: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: tokens.spacingVerticalS,
    paddingBlock: tokens.spacingVerticalXXL,
    paddingInline: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
  },
  vacioIcono: { color: tokens.colorNeutralForeground3, fontSize: '32px', display: 'flex' },
  vacioTexto: { color: tokens.colorNeutralForeground2, maxWidth: '52ch' },
  motivos: { margin: 0, paddingInlineStart: '1.2em' },
  errorAcciones: { marginTop: tokens.spacingVerticalXS },
});

export function Encabezado({ titulo, subtitulo, extra }: { titulo: string; subtitulo?: string; extra?: ReactNode }) {
  const styles = useStyles();
  return (
    <div className={styles.encabezado}>
      <div className={styles.textos}>
        <Text as="h2" size={600} weight="semibold" className={styles.titulo}>
          {titulo}
        </Text>
        {subtitulo && <Text className={styles.subtitulo}>{subtitulo}</Text>}
      </div>
      {extra}
    </div>
  );
}

export function Pila({ children }: { children: ReactNode }) {
  return <div className={useStyles().pila}>{children}</div>;
}

export function Tarjeta({ children, titulo }: { children: ReactNode; titulo?: string }) {
  const styles = useStyles();
  return (
    <Card className={styles.tarjeta}>
      {titulo && (
        <Text as="h3" size={400} weight="semibold">
          {titulo}
        </Text>
      )}
      {children}
    </Card>
  );
}

export function DosColumnas({ children }: { children: ReactNode }) {
  return <div className={useStyles().dosColumnas}>{children}</div>;
}

export function Campos({ children }: { children: ReactNode }) {
  return <div className={useStyles().campos}>{children}</div>;
}

export function Acciones({ children }: { children: ReactNode }) {
  return <div className={useStyles().acciones}>{children}</div>;
}

/** Contenedor semántico (`<dl>`) para varias `LineaResumen`. */
export function ListaResumen({ children }: { children: ReactNode }) {
  return <dl className={useStyles().listaResumen}>{children}</dl>;
}

/** Par etiqueta/valor. Usar dentro de `ListaResumen` para que lectores de pantalla lo anuncien como tal. */
export function LineaResumen({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  const styles = useStyles();
  return (
    <div className={styles.lineaResumen}>
      <dt className={styles.etiquetaResumen}>{etiqueta}</dt>
      <dd className={styles.valorResumen}>{valor}</dd>
    </div>
  );
}

/** Estado vacío: dice qué falta y, si aplica, ofrece la acción para resolverlo. */
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono?: ReactElement;
  titulo: string;
  descripcion?: ReactNode;
  accion?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <div className={styles.vacio} role="status">
      {icono && (
        <span className={styles.vacioIcono} aria-hidden="true">
          {icono}
        </span>
      )}
      <Text as="h3" size={400} weight="semibold">
        {titulo}
      </Text>
      {descripcion && <Text className={styles.vacioTexto}>{descripcion}</Text>}
      {accion}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className={useStyles().centro}>
      <Spinner label={texto} />
    </div>
  );
}

export function ErrorCarga({
  error,
  titulo = 'No se pudieron cargar los datos',
  onReintentar,
}: {
  error: unknown;
  titulo?: string;
  /** Si se indica, muestra "Reintentar" para volver a pedir los datos. */
  onReintentar?: () => void;
}) {
  const styles = useStyles();
  return (
    <MessageBar intent="error" layout="multiline" role="alert">
      <MessageBarBody>
        <MessageBarTitle>{titulo}</MessageBarTitle>
        {mensajeDeError(error)}
        {onReintentar && (
          <div className={styles.errorAcciones}>
            <Button size="small" icon={<ArrowClockwise20Regular />} onClick={onReintentar}>
              Reintentar
            </Button>
          </div>
        )}
      </MessageBarBody>
    </MessageBar>
  );
}

/** Lista de motivos (errores de validación) en un MessageBar. */
export function ListaMotivos({ titulo, motivos, intent = 'warning' }: { titulo: string; motivos: string[]; intent?: 'warning' | 'error' }) {
  const styles = useStyles();
  if (motivos.length === 0) return null;
  return (
    <MessageBar intent={intent} layout="multiline" role={intent === 'error' ? 'alert' : undefined}>
      <MessageBarBody>
        <MessageBarTitle>{titulo}</MessageBarTitle>
        <ul className={styles.motivos}>
          {motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </MessageBarBody>
    </MessageBar>
  );
}
