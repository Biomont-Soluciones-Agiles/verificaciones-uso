import { Field, ProgressBar as FluentProgressBar, makeStyles, tokens } from '@fluentui/react-components';
import { CheckmarkCircle16Filled } from '@fluentui/react-icons';
import { aparecer, CURVA_SALIDA, DURACION, fundir, MENOS_MOVIMIENTO } from '../app/movimiento';
import { progreso } from '../domain/flujo';

const useStyles = makeStyles({
  completo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorPaletteGreenForeground1,
    animationName: aparecer,
    animationDuration: DURACION.estado,
    animationTimingFunction: CURVA_SALIDA,
    [MENOS_MOVIMIENTO]: { animationName: fundir },
  },
});

export interface ProgressBarProps {
  completas: number;
  previstas: number;
}

/**
 * Avance del levantamiento (RN-02): "50 % del levantamiento completado". Al completar la última
 * entrevista prevista la etiqueta lo dice en el lenguaje del proceso: ya se puede evaluar.
 */
export function ProgressBar({ completas, previstas }: ProgressBarProps) {
  const styles = useStyles();
  const porcentaje = progreso(completas, previstas);
  const completo = porcentaje === 100;
  return (
    <Field
      validationMessage={`${porcentaje} % del levantamiento completado`}
      validationState="none"
      label={
        completo ? (
          <span className={styles.completo}>
            <CheckmarkCircle16Filled aria-hidden="true" />
            Levantamiento completo: {completas} de {previstas} entrevistas. Ya puedes evaluar.
          </span>
        ) : (
          `${completas} de ${previstas} entrevistas completadas`
        )
      }
    >
      <FluentProgressBar
        value={porcentaje / 100}
        thickness="large"
        color={completo ? 'success' : 'brand'}
        aria-valuetext={`${porcentaje} %`}
      />
    </Field>
  );
}
