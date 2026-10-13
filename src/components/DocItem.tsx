import { Button, makeStyles, Text, tokens } from '@fluentui/react-components';
import {
  BookOpen24Regular,
  Document24Regular,
  FolderOpen24Regular,
  Open24Regular,
  PlayCircle24Regular,
  TaskListLtr24Regular,
} from '@fluentui/react-icons';
import type { Documento, TipoDocumento } from '../domain/tipos';

const useStyles = makeStyles({
  fila: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    ':last-child': { borderBottom: 'none' },
  },
  icono: {
    display: 'grid',
    placeItems: 'center',
    width: '36px',
    height: '36px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorBrandForeground1,
  },
  texto: { display: 'flex', flexDirection: 'column', minWidth: 0 },
});

const ICONOS: Record<TipoDocumento, typeof Document24Regular> = {
  Manual: BookOpen24Regular,
  Instructivo: TaskListLtr24Regular,
  Video: PlayCircle24Regular,
  Carpeta: FolderOpen24Regular,
  Otro: Document24Regular,
};

export interface DocItemProps {
  documento: Documento;
  /** Si se indica, "Abrir" ejecuta esta acción en lugar de abrir el enlace. */
  onAbrir?: (documento: Documento) => void;
}

export function DocItem({ documento, onAbrir }: DocItemProps) {
  const styles = useStyles();
  const Icono = ICONOS[documento.tipo];
  const detalle = [documento.formato, documento.version].filter(Boolean).join(' · ');
  return (
    <div className={styles.fila}>
      <span className={styles.icono} aria-hidden="true">
        <Icono />
      </span>
      <span className={styles.texto}>
        <Text weight="semibold">{documento.titulo}</Text>
        {detalle && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {detalle}
          </Text>
        )}
      </span>
      {onAbrir ? (
        <Button appearance="subtle" icon={<Open24Regular />} onClick={() => onAbrir(documento)}>
          Abrir
        </Button>
      ) : (
        <Button
          appearance="subtle"
          icon={<Open24Regular />}
          as="a"
          href={documento.enlace}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${documento.titulo}`}
        >
          Abrir
        </Button>
      )}
    </div>
  );
}
