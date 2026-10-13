import {
  Card,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Text,
  tokens,
} from '@fluentui/react-components';
import type { ReactNode } from 'react';
import { mensajeDeError } from '../data/errores';

const useStyles = makeStyles({
  encabezado: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  textos: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS },
  subtitulo: { color: tokens.colorNeutralForeground3 },
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
    gap: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  centro: { padding: tokens.spacingVerticalXXL, display: 'flex', justifyContent: 'center' },
});

export function Encabezado({ titulo, subtitulo, extra }: { titulo: string; subtitulo?: string; extra?: ReactNode }) {
  const styles = useStyles();
  return (
    <div className={styles.encabezado}>
      <div className={styles.textos}>
        <Text as="h2" size={600} weight="semibold">
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

export function LineaResumen({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div className={useStyles().lineaResumen}>
      <Text>{etiqueta}</Text>
      <Text weight="semibold">{valor}</Text>
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

export function ErrorCarga({ error, titulo = 'No se pudieron cargar los datos' }: { error: unknown; titulo?: string }) {
  return (
    <MessageBar intent="error">
      <MessageBarBody>
        <MessageBarTitle>{titulo}</MessageBarTitle>
        {mensajeDeError(error)}
      </MessageBarBody>
    </MessageBar>
  );
}

/** Lista de motivos (errores de validación) en un MessageBar. */
export function ListaMotivos({ titulo, motivos, intent = 'warning' }: { titulo: string; motivos: string[]; intent?: 'warning' | 'error' }) {
  if (motivos.length === 0) return null;
  return (
    <MessageBar intent={intent} layout="multiline">
      <MessageBarBody>
        <MessageBarTitle>{titulo}</MessageBarTitle>
        <ul style={{ margin: 0, paddingInlineStart: '1.2em' }}>
          {motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </MessageBarBody>
    </MessageBar>
  );
}
