import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Link,
  makeStyles,
  Spinner,
  Text,
  tokens,
} from '@fluentui/react-components';
import { useNavigate } from 'react-router-dom';
import { EstadoBadge } from '../../components/EstadoBadge';
import { Tarjeta } from '../../components/Estructura';
import { TablaCambiosPuntaje } from '../../components/HistorialPuntaje';
import { useCriterios } from '../../data/hooks/useCatalogo';
import { useHistorialPuntajes, useRespuestas } from '../../data/hooks/useEntrevistas';
import { formatearFechaHora } from '../../domain/fechas';
import { NO_APLICA } from '../../domain/flujo';
import type { Entrevista, Respuesta, Verificacion } from '../../domain/tipos';

const useStyles = makeStyles({
  cabecera: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacingHorizontalS, minWidth: 0 },
  detalle: { color: tokens.colorNeutralForeground3 },
  panel: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, paddingBottom: tokens.spacingVerticalM },
  respuestas: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  respuesta: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  textos: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS, minWidth: 0 },
  puntaje: { fontVariantNumeric: 'tabular-nums', fontWeight: tokens.fontWeightSemibold, whiteSpace: 'nowrap' },
  sustento: { color: tokens.colorNeutralForeground2, whiteSpace: 'pre-line' },
  subtitulo: { marginTop: tokens.spacingVerticalM },
});

function textoPuntaje(r: Respuesta): string {
  if (r.puntaje !== null) return `${r.puntaje} / 10`;
  return r.respuestaTexto === NO_APLICA ? 'No aplica' : 'Sin puntaje';
}

/**
 * Lo que respalda el consolidado, para que la aprobadora lo revise sin salir de la revisión:
 * cada entrevista con sus respuestas, puntajes y sustentos, y el historial de cambios de puntaje.
 * Solo lectura.
 */
export function InformacionEntrevistas({ verificacion, entrevistas }: { verificacion: Verificacion; entrevistas: Entrevista[] }) {
  const styles = useStyles();
  const navigate = useNavigate();
  const respuestas = useRespuestas(verificacion.id);
  const criterios = useCriterios();
  const historial = useHistorialPuntajes(verificacion.id);

  const criterioDe = (id: string) => criterios.data?.find((c) => c.id === id)?.titulo ?? '';
  const entrevistaDeRespuesta = (respuestaId: string) => {
    const r = respuestas.data?.find((x) => x.id === respuestaId);
    const e = r && entrevistas.find((x) => x.id === r.entrevistaId);
    return e ? `Entrevista ${e.numero} · ${e.entrevistadoNombre}` : '';
  };

  return (
    <Tarjeta titulo="Información de las entrevistas">
      {entrevistas.length === 0 ? (
        <Text className={styles.detalle}>Aún no hay entrevistas registradas.</Text>
      ) : respuestas.isPending ? (
        <Spinner size="small" label="Cargando respuestas…" />
      ) : (
        <Accordion collapsible multiple>
          {entrevistas.map((e) => {
            const propias = (respuestas.data ?? []).filter((r) => r.entrevistaId === e.id);
            return (
              <AccordionItem key={e.id} value={e.id}>
                <AccordionHeader>
                  <span className={styles.cabecera}>
                    <Text weight="semibold">
                      Entrevista {e.numero} · {e.entrevistadoNombre}
                    </Text>
                    <EstadoBadge estado={e.estado} />
                  </span>
                </AccordionHeader>
                <AccordionPanel className={styles.panel}>
                  <Text size={200} className={styles.detalle}>
                    {[e.areaNombre, e.modalidad, e.fechaHora ? formatearFechaHora(e.fechaHora) : 'Sin fecha']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {e.urlGrabacion && (
                    <Link href={e.urlGrabacion} target="_blank" rel="noreferrer">
                      Ver grabación
                    </Link>
                  )}
                  <ul className={styles.respuestas}>
                    {propias.map((r) => (
                      <li key={r.id} className={styles.respuesta}>
                        <span className={styles.textos}>
                          <Text>{r.titulo}</Text>
                          <span className={styles.cabecera}>
                            <Badge appearance="outline" size="small">
                              {criterioDe(r.criterioId)}
                            </Badge>
                            {r.origen === 'Surgida en reunión' && (
                              <Badge appearance="tint" color="important" size="small">
                                Surgida en reunión
                              </Badge>
                            )}
                          </span>
                          {r.respuestaTexto && r.respuestaTexto !== NO_APLICA && (
                            <Text size={200}>{r.respuestaTexto}</Text>
                          )}
                          {r.sustento.trim() && (
                            <Text size={200} className={styles.sustento}>
                              Sustento: {r.sustento.trim()}
                            </Text>
                          )}
                        </span>
                        <Text className={styles.puntaje}>{textoPuntaje(r)}</Text>
                      </li>
                    ))}
                  </ul>
                  {(e.oportunidadesMejora.trim() || e.recomendaciones.trim()) && (
                    <Text size={200} className={styles.sustento}>
                      {e.oportunidadesMejora.trim() && `Oportunidades: ${e.oportunidadesMejora.trim()}\n`}
                      {e.recomendaciones.trim() && `Recomendaciones: ${e.recomendaciones.trim()}`}
                    </Text>
                  )}
                  <Link
                    as="button"
                    onClick={() => navigate(`/verificaciones/${verificacion.id}/entrevistas?entrevista=${e.id}`)}
                  >
                    Abrir la entrevista completa
                  </Link>
                </AccordionPanel>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
      <Text as="h4" weight="semibold" className={styles.subtitulo}>
        Cambios de puntaje
      </Text>
      {historial.isPending ? (
        <Spinner size="small" label="Cargando historial…" />
      ) : (
        <TablaCambiosPuntaje cambios={historial.data ?? []} entrevistaDe={entrevistaDeRespuesta} />
      )}
    </Tarjeta>
  );
}
