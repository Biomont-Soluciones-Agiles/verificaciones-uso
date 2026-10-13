import { Field, ProgressBar as FluentProgressBar } from '@fluentui/react-components';
import { progreso } from '../domain/flujo';

export interface ProgressBarProps {
  completas: number;
  previstas: number;
}

/** Avance del levantamiento (RN-02): "50 % del levantamiento completado". */
export function ProgressBar({ completas, previstas }: ProgressBarProps) {
  const porcentaje = progreso(completas, previstas);
  return (
    <Field
      validationMessage={`${porcentaje} % del levantamiento completado`}
      validationState="none"
      label={`${completas} de ${previstas} entrevistas completadas`}
    >
      <FluentProgressBar
        value={porcentaje / 100}
        thickness="large"
        color={porcentaje === 100 ? 'success' : 'brand'}
        aria-valuetext={`${porcentaje} %`}
      />
    </Field>
  );
}
