import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { CheckmarkCircle16Filled } from '@fluentui/react-icons';
import { ETAPAS } from '../domain/flujo';

const useStyles = makeStyles({
  lista: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: tokens.spacingHorizontalXS,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    '@media (max-width: 640px)': { gridTemplateColumns: '1fr' },
  },
  paso: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: tokens.spacingVerticalS,
    border: 'none',
    borderBottom: `3px solid ${tokens.colorNeutralStroke2}`,
    background: 'transparent',
    color: tokens.colorNeutralForeground3,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase300,
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorSubtleBackgroundHover },
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: '2px' },
    ':disabled': { cursor: 'default', backgroundColor: 'transparent' },
  },
  completado: { borderBottomColor: tokens.colorPaletteGreenBorderActive, color: tokens.colorNeutralForeground2 },
  actual: {
    borderBottomColor: tokens.colorBrandStroke1,
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  check: { color: tokens.colorPaletteGreenForeground1 },
});

export interface StepperProps {
  /** Índice de la etapa visible (0–4). */
  actual: number;
  completadas?: readonly boolean[];
  onSeleccionar?: (indice: number) => void;
}

/** Programación → Entrevistas → Evaluación → Consolidación → Aprobación. */
export function Stepper({ actual, completadas = [], onSeleccionar }: StepperProps) {
  const styles = useStyles();
  return (
    <nav aria-label="Etapas de la verificación">
      <ol className={styles.lista}>
        {ETAPAS.map((etapa, i) => (
          <li key={etapa}>
            <button
              type="button"
              className={mergeClasses(styles.paso, completadas[i] && styles.completado, i === actual && styles.actual)}
              aria-current={i === actual ? 'step' : undefined}
              disabled={!onSeleccionar}
              onClick={() => onSeleccionar?.(i)}
            >
              {completadas[i] && <CheckmarkCircle16Filled className={styles.check} aria-label="completada" />}
              {i + 1}. {etapa}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
