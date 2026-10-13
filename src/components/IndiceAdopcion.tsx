import { makeStyles, mergeClasses, Text, tokens } from '@fluentui/react-components';
import { CheckmarkCircle16Filled, ErrorCircle16Filled, Warning16Filled } from '@fluentui/react-icons';
import type { ReactElement } from 'react';
import { formatearIndice, resultado } from '../domain/evaluacion';

const useStyles = makeStyles({
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    minWidth: '180px',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  etiqueta: { color: tokens.colorNeutralForeground2 },
  valor: { fontSize: tokens.fontSizeHero800, lineHeight: tokens.lineHeightHero800, fontWeight: tokens.fontWeightSemibold },
  resultado: { display: 'inline-flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, color: tokens.colorNeutralForeground1 },
  plena: { '& svg': { color: tokens.colorPaletteGreenForeground1 } },
  parcial: { '& svg': { color: tokens.colorPaletteMarigoldForeground1 } },
  baja: { '& svg': { color: tokens.colorPaletteRedForeground1 } },
});

export interface IndiceAdopcionProps {
  indice: number;
  etiqueta?: string;
}

/**
 * Indicador del puntaje de usabilidad (0–40): el número es lo principal; el resultado lleva icono y texto
 * (el color nunca es la única señal) y el texto conserva el color de texto, no el de estado.
 */
export function IndiceAdopcion({ indice, etiqueta = 'Puntaje de usabilidad' }: IndiceAdopcionProps) {
  const styles = useStyles();
  const texto = resultado(indice);
  const [icono, clase]: [ReactElement, string] =
    texto === 'Usabilidad confirmada'
      ? [<CheckmarkCircle16Filled key="i" />, styles.plena]
      : texto === 'Usabilidad parcial'
        ? [<Warning16Filled key="i" />, styles.parcial]
        : [<ErrorCircle16Filled key="i" />, styles.baja];
  return (
    <div className={styles.tile} role="status" aria-live="polite" aria-atomic="true">
      <Text size={200} className={styles.etiqueta}>
        {etiqueta}
      </Text>
      <span className={styles.valor}>{formatearIndice(indice)}</span>
      <Text size={200} weight="semibold" className={mergeClasses(styles.resultado, clase)}>
        {icono}
        {texto}
      </Text>
    </div>
  );
}
