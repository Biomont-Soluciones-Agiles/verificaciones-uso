import { makeStyles, mergeClasses, Text, tokens } from '@fluentui/react-components';
import { Checkmark12Filled } from '@fluentui/react-icons';
import { ETAPAS } from '../domain/flujo';

const ESTRECHO = '@media (max-width: 640px)';

const useStyles = makeStyles({
  contenedor: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow2,
    padding: tokens.spacingVerticalXS,
  },
  lista: {
    display: 'grid',
    gridTemplateColumns: `repeat(${ETAPAS.length}, minmax(0, 1fr))`,
    gap: tokens.spacingHorizontalXXS,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  paso: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    border: 'none',
    borderRadius: tokens.borderRadiusMedium,
    borderBottom: `3px solid transparent`,
    background: 'transparent',
    color: tokens.colorNeutralForeground2,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    textAlign: 'left',
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorSubtleBackgroundHover, color: tokens.colorNeutralForeground1 },
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: '-2px' },
    ':disabled': { cursor: 'default', backgroundColor: 'transparent', color: tokens.colorNeutralForeground2 },
    [ESTRECHO]: { flexDirection: 'column', justifyContent: 'flex-start', gap: tokens.spacingVerticalXXS, textAlign: 'center' },
  },
  actual: {
    backgroundColor: tokens.colorBrandBackground2,
    borderBottomColor: tokens.colorBrandStroke1,
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    ':hover': { backgroundColor: tokens.colorBrandBackground2Hover },
    ':disabled': { backgroundColor: tokens.colorBrandBackground2, color: tokens.colorNeutralForeground1 },
  },
  marcador: {
    flexShrink: 0,
    width: '24px',
    height: '24px',
    borderRadius: tokens.borderRadiusCircular,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  marcadorActual: {
    backgroundColor: tokens.colorBrandBackground,
    border: `1px solid ${tokens.colorBrandBackground}`,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  marcadorCompletado: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
    border: `1px solid ${tokens.colorPaletteGreenBackground3}`,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  textos: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  etiqueta: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    // En pantallas estrechas solo se muestra el nombre de la etapa actual; el resto queda para lectores de pantalla.
    [ESTRECHO]: { fontSize: tokens.fontSizeBase200, whiteSpace: 'normal' },
  },
  etiquetaOculta: {
    [ESTRECHO]: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
    },
  },
  estadoPaso: {
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightRegular,
    [ESTRECHO]: { display: 'none' },
  },
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
    <nav aria-label="Etapas de la verificación" className={styles.contenedor}>
      <ol className={styles.lista}>
        {ETAPAS.map((etapa, i) => {
          const esActual = i === actual;
          const hecha = !!completadas[i];
          const estado = hecha ? 'Completada' : esActual ? 'Etapa actual' : 'Pendiente';
          return (
            <li key={etapa}>
              <button
                type="button"
                className={mergeClasses(styles.paso, esActual && styles.actual)}
                aria-current={esActual ? 'step' : undefined}
                aria-label={`Paso ${i + 1} de ${ETAPAS.length}: ${etapa}. ${estado}.`}
                title={etapa}
                disabled={!onSeleccionar}
                onClick={() => onSeleccionar?.(i)}
              >
                <span
                  aria-hidden="true"
                  className={mergeClasses(
                    styles.marcador,
                    hecha && styles.marcadorCompletado,
                    esActual && !hecha && styles.marcadorActual,
                  )}
                >
                  {hecha ? <Checkmark12Filled /> : i + 1}
                </span>
                <span className={styles.textos} aria-hidden="true">
                  <span className={mergeClasses(styles.etiqueta, !esActual && styles.etiquetaOculta)}>{etapa}</span>
                  <Text size={100} className={styles.estadoPaso}>
                    {estado}
                  </Text>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
