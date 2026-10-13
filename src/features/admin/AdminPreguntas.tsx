import {
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from '@fluentui/react-components';
import { Add24Regular, Delete24Regular, Edit24Regular, Save24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useAvisos } from '../../components/avisos';
import { Acciones, Campos, Cargando, ErrorCarga, Pila, Tarjeta } from '../../components/Estructura';
import { PuntajeInput } from '../../components/PuntajeInput';
import {
  useCriterios,
  useEliminarOpcion,
  useEliminarPregunta,
  useGuardarOpcion,
  useGuardarPregunta,
  useOpciones,
  usePreguntas,
} from '../../data/hooks/useCatalogo';
import { TIPOS_RESPUESTA, type Criterio, type OpcionRespuesta, type Pregunta, type TipoRespuesta } from '../../domain/tipos';

type Seleccion = { modo: 'nueva' } | { modo: 'editar'; pregunta: Pregunta } | null;

export function AdminPreguntas() {
  const avisos = useAvisos();
  const preguntas = usePreguntas();
  const criterios = useCriterios();
  const eliminar = useEliminarPregunta();
  const [seleccion, setSeleccion] = useState<Seleccion>(null);

  const error = preguntas.error ?? criterios.error;
  if (error) return <ErrorCarga error={error} />;
  if (!preguntas.data || !criterios.data) return <Cargando />;
  const listaPreguntas = preguntas.data;
  const listaCriterios = criterios.data;

  const nombreCriterio = (id: number) => listaCriterios.find((c) => c.id === id)?.titulo ?? '—';
  const borrar = async (p: Pregunta) => {
    if (!window.confirm(`¿Eliminar la pregunta "${p.titulo}" y sus opciones?`)) return;
    try {
      await eliminar.mutateAsync(p.id);
      if (seleccion?.modo === 'editar' && seleccion.pregunta.id === p.id) setSeleccion(null);
      avisos.exito('Pregunta eliminada.');
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Pila>
      <Tarjeta>
        <Table aria-label="Preguntas definidas" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Pregunta</TableHeaderCell>
              <TableHeaderCell>Criterio</TableHeaderCell>
              <TableHeaderCell>Tipo</TableHeaderCell>
              <TableHeaderCell>Orden</TableHeaderCell>
              <TableHeaderCell>Activa</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Acciones</span>
              </TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listaPreguntas.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.titulo}</TableCell>
                <TableCell>{nombreCriterio(p.criterioId)}</TableCell>
                <TableCell>{p.tipoRespuesta}</TableCell>
                <TableCell>{p.orden}</TableCell>
                <TableCell>{p.activo ? 'Sí' : 'No'}</TableCell>
                <TableCell>
                  <Button
                    appearance="subtle"
                    icon={<Edit24Regular />}
                    aria-label={`Editar ${p.titulo}`}
                    onClick={() => setSeleccion({ modo: 'editar', pregunta: p })}
                  />
                  <Button appearance="subtle" icon={<Delete24Regular />} aria-label={`Eliminar ${p.titulo}`} onClick={() => borrar(p)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Acciones>
          <Button icon={<Add24Regular />} onClick={() => setSeleccion({ modo: 'nueva' })}>
            Nueva pregunta
          </Button>
        </Acciones>
      </Tarjeta>
      {seleccion && (
        <FormularioPregunta
          key={seleccion.modo === 'editar' ? seleccion.pregunta.id : 'nueva'}
          pregunta={seleccion.modo === 'editar' ? seleccion.pregunta : null}
          criterios={listaCriterios.filter((c) => c.activo)}
          ordenSiguiente={listaPreguntas.reduce((m, p) => Math.max(m, p.orden), 0) + 1}
          onGuardada={(p) => setSeleccion({ modo: 'editar', pregunta: p })}
          onCerrar={() => setSeleccion(null)}
        />
      )}
    </Pila>
  );
}

interface FormularioPreguntaProps {
  pregunta: Pregunta | null;
  criterios: Criterio[];
  ordenSiguiente: number;
  onGuardada: (p: Pregunta) => void;
  onCerrar: () => void;
}

function FormularioPregunta({ pregunta, criterios, ordenSiguiente, onGuardada, onCerrar }: FormularioPreguntaProps) {
  const avisos = useAvisos();
  const guardar = useGuardarPregunta();
  const [datos, setDatos] = useState<Omit<Pregunta, 'id'>>(
    pregunta ?? { titulo: '', criterioId: criterios[0]?.id ?? 0, tipoRespuesta: 'Selección', orden: ordenSiguiente, activo: true },
  );
  const valido = datos.titulo.trim().length > 0 && datos.titulo.length <= 255 && datos.criterioId > 0;

  const enviar = async () => {
    try {
      const p = await guardar.mutateAsync({ id: pregunta?.id, datos: { ...datos, titulo: datos.titulo.trim() } });
      avisos.exito('Pregunta guardada.');
      onGuardada(p);
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Tarjeta titulo={pregunta ? 'Editar pregunta' : 'Nueva pregunta'}>
      <Field label="Texto de la pregunta" required hint="Máximo 255 caracteres.">
        <Input maxLength={255} value={datos.titulo} onChange={(_, d) => setDatos({ ...datos, titulo: d.value })} />
      </Field>
      <Campos>
        <Field label="Criterio">
          <Select value={String(datos.criterioId)} onChange={(_, d) => setDatos({ ...datos, criterioId: Number(d.value) })}>
            {criterios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de respuesta">
          <Select
            value={datos.tipoRespuesta}
            onChange={(_, d) => setDatos({ ...datos, tipoRespuesta: d.value as TipoRespuesta })}
          >
            {TIPOS_RESPUESTA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Orden">
          <Input type="number" value={String(datos.orden)} onChange={(_, d) => setDatos({ ...datos, orden: Number(d.value) })} />
        </Field>
        <Checkbox label="Activa" checked={datos.activo} onChange={(_, d) => setDatos({ ...datos, activo: d.checked === true })} />
      </Campos>
      <Acciones>
        <Button onClick={onCerrar}>Cerrar</Button>
        <Button appearance="primary" icon={<Save24Regular />} disabled={!valido || guardar.isPending} onClick={enviar}>
          Guardar pregunta
        </Button>
      </Acciones>
      {pregunta && datos.tipoRespuesta === 'Selección' && <OpcionesPregunta pregunta={pregunta} />}
    </Tarjeta>
  );
}

function OpcionesPregunta({ pregunta }: { pregunta: Pregunta }) {
  const { data: opciones = [] } = useOpciones();
  const propias = opciones.filter((o) => o.preguntaId === pregunta.id);
  const siguiente = propias.reduce((m, o) => Math.max(m, o.orden), 0) + 1;
  return (
    <Pila>
      <Text weight="semibold">Opciones de respuesta</Text>
      <Text size={200}>Cada opción precarga su puntaje en la entrevista; el entrevistador puede ajustarlo.</Text>
      {propias.map((o) => (
        <FilaOpcion key={o.id} opcion={o} preguntaId={pregunta.id} ordenSiguiente={siguiente} />
      ))}
      <FilaOpcion key={`nueva-${siguiente}`} opcion={null} preguntaId={pregunta.id} ordenSiguiente={siguiente} />
    </Pila>
  );
}

function FilaOpcion({ opcion, preguntaId, ordenSiguiente }: { opcion: OpcionRespuesta | null; preguntaId: number; ordenSiguiente: number }) {
  const avisos = useAvisos();
  const guardar = useGuardarOpcion();
  const eliminar = useEliminarOpcion();
  const [datos, setDatos] = useState<Omit<OpcionRespuesta, 'id'>>(
    opcion ?? { titulo: '', preguntaId, puntajeSugerido: 5, orden: ordenSiguiente },
  );
  const valido = datos.titulo.trim().length > 0;

  const enviar = async () => {
    try {
      await guardar.mutateAsync({ id: opcion?.id, datos: { ...datos, titulo: datos.titulo.trim() } });
      avisos.exito(opcion ? 'Opción actualizada.' : 'Opción agregada.');
    } catch (e) {
      avisos.error(e);
    }
  };

  const borrar = async () => {
    if (!opcion) return;
    try {
      await eliminar.mutateAsync(opcion.id);
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Campos>
      <Field label={opcion ? 'Opción' : 'Nueva opción'}>
        <Input value={datos.titulo} onChange={(_, d) => setDatos({ ...datos, titulo: d.value })} />
      </Field>
      <Field label="Puntaje sugerido / orden">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PuntajeInput valor={datos.puntajeSugerido} onChange={(v) => setDatos({ ...datos, puntajeSugerido: v ?? 1 })} />
          <Input
            aria-label="Orden"
            type="number"
            style={{ width: 80 }}
            value={String(datos.orden)}
            onChange={(_, d) => setDatos({ ...datos, orden: Number(d.value) })}
          />
          <Button
            appearance="subtle"
            icon={opcion ? <Save24Regular /> : <Add24Regular />}
            aria-label={opcion ? `Guardar ${opcion.titulo}` : 'Agregar opción'}
            disabled={!valido || guardar.isPending}
            onClick={enviar}
          />
          {opcion && (
            <Button appearance="subtle" icon={<Delete24Regular />} aria-label={`Eliminar ${opcion.titulo}`} onClick={borrar} />
          )}
        </div>
      </Field>
    </Campos>
  );
}
