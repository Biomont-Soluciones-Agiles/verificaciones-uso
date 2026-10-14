import { makeStyles, mergeClasses, Text, tokens } from '@fluentui/react-components';
import { Checkmark12Filled } from '@fluentui/react-icons';
import { ETAPAS } from '../domain/flujo';
import { CURVA_SALIDA, DURACION, MENOS_MOVIMIENTO } from './movimiento';

const ESTRECHO = '@media (max-width: 640px)';

const useStyles = makeStyles({
  contenedor: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow2,
    padding: tokens.spacingVerticalXS,
  },
  lista: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: `repeat(${ETAPAS.length}, minmax(0, 1fr))`,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // Una sola pieza marca la etapa actual y se desliza a la nueva: el cambio de etapa se lee como
  // un avance (o un retroceso) en el proceso, no como un salto.
  indicador: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: `calc(100% / ${ETAPAS.length})`,
    boxSizing: 'border-box',
    borderRadius: tokens.borderRadiusMedium,
    borderBottom: `3px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
    pointerEvents: 'none',
    transitionProperty: 'transform',
    transitionDuration: DURACION.vista,
    transitionTimingFunction: CURVA_SALIDA,
    [MENOS_MOVIMIENTO]: { transitionDuration: '1ms' },
  },
  elemento: { position: 'relative' },
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
  // El fondo y el borde de la etapa actual los pinta `indicador`, por debajo del botón.
  actual: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
    ':hover': { backgroundColor: 'transparent', color: tokens.colorNeutralForeground1 },
    ':disabled': { color: tokens.colorNeutralForeground1 },
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
        {actual >= 0 && actual < ETAPAS.length && (
          <li aria-hidden="true" className={styles.indicador} style={{ transform: `translateX(${actual * 100}%)` }} />
        )}
        {ETAPAS.map((etapa, i) => {
          const esActual = i === actual;
          const hecha = !!completadas[i];
          const estado = hecha ? 'Completada' : esActual ? 'Etapa actual' : 'Pendiente';
          return (
            <li key={etapa} className={styles.elemento}>
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
