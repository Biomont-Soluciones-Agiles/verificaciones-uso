import { makeStyles, mergeClasses, Text, tokens } from '@fluentui/react-components';
import { CheckmarkCircle16Filled, ErrorCircle16Filled, Warning16Filled } from '@fluentui/react-icons';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { CURVA_SALIDA, DURACION, fundir, MENOS_MOVIMIENTO, prefiereMenosMovimiento } from '../app/movimiento';
import { formatearIndice, resultado, UMBRAL_ADOPCION_PARCIAL, UMBRAL_ADOPCION_PLENA } from '../domain/evaluacion';

const DURACION_LECTURA_MS = 520;

const useStyles = makeStyles({
  tile: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    minWidth: '240px',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  // Dentro de otra tarjeta: sin fondo, sombra ni relleno propios (nunca tarjetas anidadas).
  plano: { padding: 0, backgroundColor: 'transparent', boxShadow: 'none', borderRadius: 0, minWidth: 0 },
  etiqueta: { color: tokens.colorNeutralForeground2 },
  valor: {
    fontSize: tokens.fontSizeHero800,
    lineHeight: tokens.lineHeightHero800,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: 'tabular-nums',
  },
  // Regla de 0 a 100 % con las tres zonas del resultado (RN-09) y la aguja que marca la lectura.
  // `clip` (no `hidden`): recorta en horizontal la caja del carril desplazado sin cortar la aguja en
  // vertical; el margen de recorte deja la aguja entera en 0 y en 100.
  regla: {
    position: 'relative',
    height: '8px',
    marginTop: tokens.spacingVerticalXXS,
    overflowX: 'clip',
    overflowClipMargin: '4px',
  },
  zonas: {
    display: 'grid',
    gridTemplateColumns: `${UMBRAL_ADOPCION_PARCIAL}fr ${UMBRAL_ADOPCION_PLENA - UMBRAL_ADOPCION_PARCIAL}fr ${100 - UMBRAL_ADOPCION_PLENA}fr`,
    gap: '2px',
    height: '100%',
    borderRadius: tokens.borderRadiusCircular,
    overflow: 'hidden',
  },
  zonaBaja: { backgroundColor: tokens.colorPaletteRedBackground2 },
  zonaParcial: { backgroundColor: tokens.colorPaletteMarigoldBackground2 },
  zonaPlena: { backgroundColor: tokens.colorPaletteGreenBackground2 },
  // La aguja vive en un carril del ancho de la regla: se mueve con transform (no con `left`).
  carril: {
    position: 'absolute',
    inset: '-4px 0',
    transitionProperty: 'transform',
    transitionDuration: DURACION.lectura,
    transitionTimingFunction: CURVA_SALIDA,
    [MENOS_MOVIMIENTO]: { transitionDuration: '1ms' },
  },
  aguja: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '-2px',
    width: '4px',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralForeground1,
    boxShadow: `0 0 0 2px ${tokens.colorNeutralBackground1}`,
  },
  marcas: { position: 'relative', height: '16px', color: tokens.colorNeutralForeground3 },
  marca: { position: 'absolute', top: 0, transform: 'translateX(-50%)', fontVariantNumeric: 'tabular-nums' },
  resultado: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground1,
    animationName: fundir,
    animationDuration: DURACION.estado,
    animationTimingFunction: CURVA_SALIDA,
  },
  plena: { '& svg': { color: tokens.colorPaletteGreenForeground1 } },
  parcial: { '& svg': { color: tokens.colorPaletteMarigoldForeground1 } },
  baja: { '& svg': { color: tokens.colorPaletteRedForeground1 } },
});

/** Cifra que avanza hasta el valor nuevo (interrumpible); con menos movimiento salta directamente. */
function useLectura(objetivo: number): number {
  const [mostrado, setMostrado] = useState(objetivo);
  const actual = useRef(objetivo);

  useEffect(() => {
    const desde = actual.current;
    if (desde === objetivo) return;
    // Con menos movimiento la lectura llega en un solo fotograma.
    const duracion = prefiereMenosMovimiento() ? 0 : DURACION_LECTURA_MS;
    let cuadro = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = duracion === 0 ? 1 : Math.min(1, (ahora - inicio) / duracion);
      const avance = 1 - Math.pow(1 - t, 4); // desaceleración exponencial, como CURVA_SALIDA
      actual.current = desde + (objetivo - desde) * avance;
      setMostrado(actual.current);
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [objetivo]);

  return mostrado;
}

/** Valor que solo se actualiza cuando deja de cambiar (para no saturar a los lectores de pantalla). */
function useAsentado<T>(valor: T, esperaMs = 700): T {
  const [asentado, setAsentado] = useState(valor);
  useEffect(() => {
    const t = window.setTimeout(() => setAsentado(valor), esperaMs);
    return () => window.clearTimeout(t);
  }, [valor, esperaMs]);
  return asentado;
}

export interface IndiceAdopcionProps {
  indice: number;
  etiqueta?: string;
  /** `plano` cuando va dentro de una tarjeta; por defecto es una tarjeta propia. */
  variante?: 'tarjeta' | 'plano';
}

/**
 * Lectura del índice de adopción como un instrumento: la cifra, una regla de 0 a 100 % con las
 * zonas del resultado (< 50 baja, 50–74 parcial, ≥ 75 plena) y la aguja que se desplaza hasta la
 * lectura. El resultado lleva icono y texto (el color nunca es la única señal) y se anuncia una
 * sola vez por cambio a los lectores de pantalla.
 */
export function IndiceAdopcion({ indice, etiqueta = 'Índice de adopción', variante = 'tarjeta' }: IndiceAdopcionProps) {
  const styles = useStyles();
  const mostrado = useLectura(indice);
  const texto = resultado(indice);
  const [icono, clase]: [ReactElement, string] =
    texto === 'Adopción plena'
      ? [<CheckmarkCircle16Filled key="i" />, styles.plena]
      : texto === 'Adopción parcial'
        ? [<Warning16Filled key="i" />, styles.parcial]
        : [<ErrorCircle16Filled key="i" />, styles.baja];
  const posicion = Math.max(0, Math.min(100, indice));
  const indiceAnunciado = useAsentado(indice);

  return (
    <div className={mergeClasses(styles.tile, variante === 'plano' && styles.plano)}>
      <Text size={200} className={styles.etiqueta}>
        {etiqueta}
      </Text>
      <span className={styles.valor} aria-hidden="true">
        {formatearIndice(Math.round(mostrado))}
      </span>
      <div className={styles.regla} aria-hidden="true">
        <div className={styles.zonas}>
          <span className={styles.zonaBaja} />
          <span className={styles.zonaParcial} />
          <span className={styles.zonaPlena} />
        </div>
        <div className={styles.carril} style={{ transform: `translateX(${posicion}%)` }}>
          <span className={styles.aguja} />
        </div>
      </div>
      <div className={styles.marcas} aria-hidden="true">
        <Text size={100} className={styles.marca} style={{ left: `${UMBRAL_ADOPCION_PARCIAL}%` }}>
          {UMBRAL_ADOPCION_PARCIAL}
        </Text>
        <Text size={100} className={styles.marca} style={{ left: `${UMBRAL_ADOPCION_PLENA}%` }}>
          {UMBRAL_ADOPCION_PLENA}
        </Text>
      </div>
      {/* `key`: al cruzar un umbral el resultado nuevo entra con un fundido. */}
      <Text key={texto} size={200} weight="semibold" className={mergeClasses(styles.resultado, clase)}>
        {icono}
        {texto}
      </Text>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {`${etiqueta}: ${formatearIndice(indiceAnunciado)}, ${resultado(indiceAnunciado)}.`}
      </span>
    </div>
  );
}
