import { Badge, Checkbox, Field, Select, Text, Textarea } from '@fluentui/react-components';
import { Campos } from '../../components/Estructura';
import { HistorialRespuesta } from '../../components/HistorialPuntaje';
import { PuntajeInput } from '../../components/PuntajeInput';
import { SustentoPlegable } from '../../components/SustentoPlegable';
import { NO_APLICA } from '../../domain/flujo';
import type { CambioPuntaje, OpcionRespuesta, Pregunta, Respuesta } from '../../domain/tipos';
import { useEstilosRespuesta } from './estilos';

export interface RespuestaDefinidaProps {
  respuesta: Respuesta;
  pregunta: Pregunta | undefined;
  opciones: OpcionRespuesta[];
  criterioNombre: string;
  /** Cambios de su puntaje (historial). */
  cambios: CambioPuntaje[];
  soloLectura: boolean;
  onChange: (cambios: Partial<Respuesta>) => void;
}

/**
 * Pregunta del catálogo: la opción elegida precarga el puntaje (editable). Las no obligatorias
 * se pueden marcar "No aplica": quedan sin puntaje y no cuentan en el promedio del criterio.
 */
export function RespuestaDefinida({
  respuesta,
  pregunta,
  opciones,
  criterioNombre,
  cambios,
  soloLectura,
  onChange,
}: RespuestaDefinidaProps) {
  const styles = useEstilosRespuesta();
  const esSeleccion = pregunta?.tipoRespuesta === 'Selección';
  const opcional = pregunta?.obligatoria === false;
  const noAplica = opcional && respuesta.puntaje === null && respuesta.respuestaTexto === NO_APLICA;
  const faltaPuntaje = !opcional && respuesta.puntaje === null && !soloLectura;

  return (
    <section className={styles.respuesta} aria-label={respuesta.titulo}>
      <div className={styles.insignias}>
        <Badge appearance="tint">Pregunta definida</Badge>
        <Badge appearance="outline">{criterioNombre}</Badge>
        {opcional && (
          <Badge appearance="tint" color="informative">
            Opcional · si corresponde
          </Badge>
        )}
        <span className={styles.espaciador}>
          <HistorialRespuesta cambios={cambios} />
        </span>
      </div>
      <Text weight="semibold">{respuesta.titulo}</Text>
      {opcional && (
        <Checkbox
          label="No aplica a esta solución"
          checked={noAplica}
          disabled={soloLectura}
          onChange={(_, d) =>
            onChange(d.checked ? { puntaje: null, opcionId: null, respuestaTexto: NO_APLICA } : { respuestaTexto: '' })
          }
        />
      )}
      {!noAplica && (
        <Campos>
          {esSeleccion ? (
            <Field label="Respuesta">
              <Select
                value={respuesta.opcionId ?? ''}
                disabled={soloLectura}
                onChange={(_, d) => {
                  const opcion = opciones.find((o) => o.id === d.value);
                  onChange(
                    opcion
                      ? { opcionId: opcion.id, respuestaTexto: opcion.titulo, puntaje: opcion.puntajeSugerido }
                      : { opcionId: null, respuestaTexto: '' },
                  );
                }}
              >
                <option value="">Selecciona…</option>
                {opciones.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.titulo}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Respuesta">
              <Textarea
                rows={2}
                value={respuesta.respuestaTexto}
                disabled={soloLectura}
                onChange={(_, d) => onChange({ respuestaTexto: d.value })}
              />
            </Field>
          )}
          <Field
            label="Puntaje sugerido"
            hint={esSeleccion ? 'Se precarga con la opción elegida; puedes ajustarlo.' : '1 a 10'}
            validationState={faltaPuntaje ? 'warning' : 'none'}
            validationMessage={faltaPuntaje ? 'Obligatorio para completar la entrevista.' : undefined}
          >
            <PuntajeInput valor={respuesta.puntaje} deshabilitado={soloLectura} onChange={(puntaje) => onChange({ puntaje })} />
          </Field>
        </Campos>
      )}
      <SustentoPlegable
        etiqueta="Sustento"
        valor={respuesta.sustento}
        soloLectura={soloLectura}
        onChange={(sustento) => onChange({ sustento })}
      />
    </section>
  );
}
