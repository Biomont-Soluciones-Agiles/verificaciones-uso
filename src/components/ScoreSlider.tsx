import { Label, makeStyles, Slider, Text, tokens, useId } from '@fluentui/react-components';
import { formatearPuntaje, PUNTAJE_MAXIMO, PUNTAJE_MINIMO } from '../domain/evaluacion';

const useStyles = makeStyles({
  fila: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 220px) minmax(0, 1fr) 80px',
    gridTemplateAreas: '"etiqueta deslizador valor"',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXXS,
    alignItems: 'center',
    // En pantallas estrechas: etiqueta y valor en una fila, el deslizador a todo el ancho debajo.
    '@media (max-width: 640px)': {
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gridTemplateAreas: '"etiqueta valor" "deslizador deslizador"',
    },
  },
  etiqueta: { gridArea: 'etiqueta', fontWeight: tokens.fontWeightSemibold },
  deslizador: { gridArea: 'deslizador', width: '100%' },
  valor: {
    gridArea: 'valor',
    textAlign: 'right',
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: 'tabular-nums',
  },
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
      <Label htmlFor={id} className={styles.etiqueta}>
        {etiqueta}
      </Label>
      <Slider
        id={id}
        className={styles.deslizador}
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
