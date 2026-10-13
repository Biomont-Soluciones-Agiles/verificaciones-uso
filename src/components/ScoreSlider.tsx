import { Label, makeStyles, Slider, Text, tokens, useId } from '@fluentui/react-components';
import { formatearPuntaje, PUNTAJE_MAXIMO, PUNTAJE_MINIMO } from '../domain/evaluacion';

const useStyles = makeStyles({
  fila: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 200px) 1fr 80px',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    '@media (max-width: 640px)': { gridTemplateColumns: '1fr' },
  },
  valor: { textAlign: 'right', fontWeight: tokens.fontWeightSemibold },
});

export interface ScoreSliderProps {
  etiqueta: string;
  valor: number;
  onChange: (valor: number) => void;
  /** Paso del deslizador; 0.1 permite igualar sugeridos con 1 decimal. */
  paso?: number;
  deshabilitado?: boolean;
}

/** Deslizador de puntaje 1–10 con su valor "x / 10". */
export function ScoreSlider({ etiqueta, valor, onChange, paso = 0.1, deshabilitado }: ScoreSliderProps) {
  const styles = useStyles();
  const id = useId('puntaje');
  return (
    <div className={styles.fila}>
      <Label htmlFor={id}>{etiqueta}</Label>
      <Slider
        id={id}
        min={PUNTAJE_MINIMO}
        max={PUNTAJE_MAXIMO}
        step={paso}
        value={valor}
        disabled={deshabilitado}
        onChange={(_, d) => onChange(Math.round(d.value * 10) / 10)}
        aria-valuetext={`${formatearPuntaje(valor)} de 10`}
      />
      <Text className={styles.valor} aria-hidden="true">
        {formatearPuntaje(valor)} / 10
      </Text>
    </div>
  );
}
