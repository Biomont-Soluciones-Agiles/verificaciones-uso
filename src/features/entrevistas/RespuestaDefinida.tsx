import { Badge, Field, Select, Text, Textarea } from '@fluentui/react-components';
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

/** Pregunta del catálogo: la opción elegida precarga el puntaje (editable). */
export function RespuestaDefinida({ respuesta, pregunta, opciones, criterioNombre, soloLectura, onChange }: RespuestaDefinidaProps) {
  const styles = useEstilosRespuesta();
  const esSeleccion = pregunta?.tipoRespuesta === 'Selección';

  return (
    <section className={styles.respuesta} aria-label={respuesta.titulo}>
      <div className={styles.insignias}>
        <Badge appearance="tint">Pregunta definida</Badge>
        <Badge appearance="outline">{criterioNombre}</Badge>
      </div>
      <Text weight="semibold">{respuesta.titulo}</Text>
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
          validationState={respuesta.puntaje === null && !soloLectura ? 'warning' : 'none'}
          validationMessage={respuesta.puntaje === null && !soloLectura ? 'Obligatorio para completar la entrevista.' : undefined}
        >
          <PuntajeInput valor={respuesta.puntaje} deshabilitado={soloLectura} onChange={(puntaje) => onChange({ puntaje })} />
        </Field>
      </Campos>
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
