import { makeStyles, Spinner, Text, tokens } from '@fluentui/react-components';
import { ChevronRight16Regular } from '@fluentui/react-icons';
import { EstadoBadge } from '../../components/EstadoBadge';
import { useVerificacionesDeSolucion } from '../../data/hooks/useVerificaciones';
import { formatearIndice } from '../../domain/evaluacion';
import { formatearFecha } from '../../domain/fechas';
import { estaEnviada } from '../../domain/flujo';
import type { Id, Verificacion } from '../../domain/tipos';

const useStyles = makeStyles({
  seccion: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  lista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  fila: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    border: 'none',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    background: 'transparent',
    color: tokens.colorNeutralForeground1,
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorSubtleBackgroundHover },
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: '-2px' },
  },
  textos: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  detalle: { color: tokens.colorNeutralForeground3, fontVariantNumeric: 'tabular-nums' },
  indice: { fontVariantNumeric: 'tabular-nums', textAlign: 'right' },
  nota: { color: tokens.colorNeutralForeground2 },
  cola: { display: 'inline-flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, color: tokens.colorNeutralForeground3 },
});

/** Fecha que mejor ubica a la verificación en el tiempo: aprobación, envío u objetivo. */
function fechaReferencia(v: Verificacion): string {
  if (v.fechaAprobacion) return `Aprobada el ${formatearFecha(v.fechaAprobacion)}`;
  if (v.fechaEnvio) return `Enviada el ${formatearFecha(v.fechaEnvio)}`;
  if (v.fechaObjetivo) return `Objetivo ${formatearFecha(v.fechaObjetivo)}`;
  return 'Sin fecha';
}

export interface HistorialVerificacionesProps {
  solucionId: Id;
  onAbrir: (v: Verificacion) => void;
}

/** Historial de verificaciones de una solución, de la más reciente a la más antigua. */
export function HistorialVerificaciones({ solucionId, onAbrir }: HistorialVerificacionesProps) {
  const styles = useStyles();
  const { data: verificaciones, isPending } = useVerificacionesDeSolucion(solucionId);

  return (
    <section aria-labelledby="historial-verificaciones" className={styles.seccion}>
      <Text as="h3" id="historial-verificaciones" weight="semibold">
        Historial de verificaciones
      </Text>
      {isPending ? (
        <Spinner size="small" label="Cargando verificaciones…" />
      ) : !verificaciones || verificaciones.length === 0 ? (
        <Text className={styles.nota}>Esta solución aún no tiene verificaciones de uso.</Text>
      ) : (
        <ul className={styles.lista}>
          {verificaciones.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                className={styles.fila}
                onClick={() => onAbrir(v)}
                aria-label={`Abrir ${v.codigo || `#${v.id}`}: ${v.estado}, ${fechaReferencia(v)}${
                  v.indiceAdopcion !== null && estaEnviada(v.estado) ? `, índice ${formatearIndice(v.indiceAdopcion)}` : ''
                }`}
              >
                <span className={styles.textos}>
                  <Text weight="semibold">{v.codigo || `#${v.id}`}</Text>
                  <Text size={200} className={styles.detalle}>
                    {fechaReferencia(v)}
                    {v.resultado && estaEnviada(v.estado) ? ` · ${v.resultado}` : ''}
                  </Text>
                </span>
                <span className={styles.indice}>
                  {/* El índice solo es definitivo una vez enviada a revisión. */}
                  <Text weight="semibold">{estaEnviada(v.estado) ? formatearIndice(v.indiceAdopcion) : '—'}</Text>
                </span>
                <span className={styles.cola}>
                  <EstadoBadge estado={v.estado} />
                  <ChevronRight16Regular aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
