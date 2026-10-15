import { Badge, Button, Checkbox, Field, Input, Select, Textarea } from '@fluentui/react-components';
import { Delete24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { Campos } from '../../components/Estructura';
import { HistorialRespuesta } from '../../components/HistorialPuntaje';
import { PuntajeInput } from '../../components/PuntajeInput';
import { SustentoPlegable } from '../../components/SustentoPlegable';
import type { CambioPuntaje, Criterio, Evidencia, Id, Respuesta } from '../../domain/tipos';
import { useEstilosRespuesta } from './estilos';

export interface PreguntaSurgidaProps {
  respuesta: Respuesta;
  criterios: Criterio[];
  /** Evidencias de la entrevista (para vincular una a esta respuesta). */
  evidencias: Evidencia[];
  /** Cambios de su puntaje (historial). */
  cambios: CambioPuntaje[];
  soloLectura: boolean;
  enfocar: boolean;
  onChange: (cambios: Partial<Respuesta>) => void;
  onEliminar: () => void;
  onVincular: (evidenciaId: Id | null) => void;
  onSubirVinculada: (archivos: FileList | null) => void;
}

/** Pregunta surgida en la reunión: texto libre, criterio impactado, puntaje opcional y evidencia vinculada. */
export function PreguntaSurgida({
  respuesta,
  criterios,
  evidencias,
  cambios,
  soloLectura,
  enfocar,
  onChange,
  onEliminar,
  onVincular,
  onSubirVinculada,
}: PreguntaSurgidaProps) {
  const styles = useEstilosRespuesta();
  const vinculada = evidencias.find((e) => e.respuestaId === respuesta.id) ?? null;
  const [vincular, setVincular] = useState(vinculada !== null);
  const criterio = criterios.find((c) => c.id === respuesta.criterioId);

  return (
    <section className={styles.respuesta} aria-label="Pregunta surgida en la reunión">
      <div className={styles.insignias}>
        <Badge appearance="tint" color="important">
          Pregunta surgida en reunión
        </Badge>
        {criterio && <Badge appearance="outline">Impacta: {criterio.titulo}</Badge>}
        <span className={styles.espaciador}>
          <HistorialRespuesta cambios={cambios} />
        </span>
        {!soloLectura && (
          <Button
            appearance="subtle"
            size="small"
            icon={<Delete24Regular />}
            onClick={onEliminar}
          >
            Quitar
          </Button>
        )}
      </div>
      <Field label="Pregunta">
        <Input
          value={respuesta.titulo}
          placeholder="Escribe la pregunta que surgió en la reunión"
          disabled={soloLectura}
          autoFocus={enfocar}
          maxLength={255}
          onChange={(_, d) => onChange({ titulo: d.value })}
        />
      </Field>
      <Field label="Respuesta">
        <Textarea
          rows={2}
          resize="vertical"
          placeholder="Registra la respuesta del entrevistado"
          value={respuesta.respuestaTexto}
          disabled={soloLectura}
          onChange={(_, d) => onChange({ respuestaTexto: d.value })}
        />
      </Field>
      <Campos>
        <Field label="Criterio impactado">
          <Select
            value={String(respuesta.criterioId)}
            disabled={soloLectura}
            onChange={(_, d) => onChange({ criterioId: d.value })}
          >
            {criterios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Puntaje aportado (opcional)">
          <PuntajeInput valor={respuesta.puntaje} deshabilitado={soloLectura} onChange={(puntaje) => onChange({ puntaje })} />
        </Field>
      </Campos>
      <SustentoPlegable
        etiqueta="Sustento del puntaje"
        valor={respuesta.sustento}
        soloLectura={soloLectura}
        onChange={(sustento) => onChange({ sustento })}
      />
      <Checkbox
        label="Vincular una evidencia específica a esta respuesta"
        checked={vincular}
        disabled={soloLectura}
        onChange={(_, d) => {
          const marcado = d.checked === true;
          setVincular(marcado);
          if (!marcado && vinculada) onVincular(null);
        }}
      />
      {vincular && (
        <Campos>
          <Field label="Evidencia vinculada">
            <Select
              value={vinculada?.id ?? ''}
              disabled={soloLectura}
              onChange={(_, d) => onVincular(d.value || null)}
            >
              <option value="">Ninguna</option>
              {evidencias.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombreArchivo}
                </option>
              ))}
            </Select>
          </Field>
          {!soloLectura && (
            <Field label="O sube una nueva">
              {(props) => (
                <input
                  {...props}
                  type="file"
                  onChange={(e) => {
                    onSubirVinculada(e.target.files);
                    e.target.value = '';
                  }}
                />
              )}
            </Field>
          )}
        </Campos>
      )}
    </section>
  );
}
