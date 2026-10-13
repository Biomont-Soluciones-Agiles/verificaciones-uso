import { Badge, Checkbox, Field, Select, Text, Textarea } from '@fluentui/react-components';
import { Campos } from '../../components/Estructura';
import { PuntajeInput } from '../../components/PuntajeInput';
import type { OpcionRespuesta, Pregunta, Respuesta } from '../../domain/tipos';
import { useEstilosRespuesta } from './estilos';

export interface RespuestaDefinidaProps {
  respuesta: Respuesta;
  pregunta: Pregunta | undefined;
  opciones: OpcionRespuesta[];
  criterioNombre: string;
  soloLectura: boolean;
  onChange: (cambios: Partial<Respuesta>) => void;
}

/** Texto con el que se guarda una pregunta no obligatoria marcada como "No aplica" (sin puntaje). */
const NO_APLICA = 'No aplica';

/**
 * Pregunta del catálogo: la opción elegida precarga el puntaje (editable). Las no obligatorias
 * se pueden marcar "No aplica": quedan sin puntaje y no cuentan en el promedio del criterio.
 */
export function RespuestaDefinida({ respuesta, pregunta, opciones, criterioNombre, soloLectura, onChange }: RespuestaDefinidaProps) {
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
      <Field label="Sustento">
        <Textarea
          rows={2}
          resize="vertical"
          value={respuesta.sustento}
          disabled={soloLectura}
          onChange={(_, d) => onChange({ sustento: d.value })}
        />
      </Field>
    </section>
  );
}
