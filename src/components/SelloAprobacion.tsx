import { makeStyles, mergeClasses, Text, tokens } from '@fluentui/react-components';
import { CheckmarkStarburst24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { CURVA_SALIDA, fundir, MENOS_MOVIMIENTO } from '../app/movimiento';
import { formatearFecha } from '../domain/fechas';
import type { FechaHoraISO, Id } from '../domain/tipos';

const useStyles = makeStyles({
  // Sello de tinta, como la firma de un registro en el cuaderno de laboratorio: borde doble verde,
  // ligeramente girado. Es un dato (que se aprobó y cuándo), no un adorno.
  sello: {
    alignSelf: 'flex-start',
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    border: `2px solid ${tokens.colorPaletteGreenForeground1}`,
    outline: `1px solid ${tokens.colorPaletteGreenForeground1}`,
    outlineOffset: '2px',
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorPaletteGreenForeground1,
    backgroundColor: tokens.colorPaletteGreenBackground1,
    transform: 'rotate(-2deg)',
  },
  // Se estampa una sola vez: entra grande y girado, presiona y se asienta.
  estampar: {
    animationName: {
      '0%': { opacity: 0, transform: 'scale(1.25) rotate(-7deg)' },
      '60%': { opacity: 1, transform: 'scale(0.97) rotate(-1.5deg)' },
      '100%': { opacity: 1, transform: 'scale(1) rotate(-2deg)' },
    },
    animationDuration: '520ms',
    animationTimingFunction: CURVA_SALIDA,
    [MENOS_MOVIMIENTO]: { animationName: fundir },
  },
  textos: { display: 'flex', flexDirection: 'column' },
  titulo: { color: 'inherit', fontWeight: tokens.fontWeightBold, letterSpacing: '0.02em' },
  detalle: { color: 'inherit', fontVariantNumeric: 'tabular-nums' },
});

const clave = (id: Id) => `vu-sello-visto:${id}`;

/** true la primera vez que se muestra este sello en este navegador (y lo deja anotado). */
function useEsPrimeraVez(id: Id): boolean {
  const [primera] = useState(() => {
    try {
      if (window.localStorage.getItem(clave(id))) return false;
      window.localStorage.setItem(clave(id), '1');
      return true;
    } catch {
      return false;
    }
  });
  return primera;
}

export interface SelloAprobacionProps {
  verificacionId: Id;
  fecha: FechaHoraISO | null;
}

/** Sello de aprobación de una verificación (RN-08: un solo nivel). */
export function SelloAprobacion({ verificacionId, fecha }: SelloAprobacionProps) {
  const styles = useStyles();
  const primera = useEsPrimeraVez(verificacionId);
  const titulo = 'Aprobada';
  const detalle = fecha ? `Resultados aprobados · ${formatearFecha(fecha)}` : 'Resultados aprobados';
  return (
    <div className={mergeClasses(styles.sello, primera && styles.estampar)} role="img" aria-label={`${titulo}. ${detalle}.`}>
      <CheckmarkStarburst24Regular aria-hidden="true" />
      <span className={styles.textos} aria-hidden="true">
        <Text size={400} className={styles.titulo}>
          {titulo}
        </Text>
        <Text size={200} className={styles.detalle}>
          {detalle}
        </Text>
      </span>
    </div>
  );
}
