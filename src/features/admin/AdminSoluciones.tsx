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
  Textarea,
} from '@fluentui/react-components';
import { Add24Regular, Delete24Regular, Edit24Regular, Save24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useAvisos } from '../../components/avisos';
import { DocItem } from '../../components/DocItem';
import { EstadoBadge } from '../../components/EstadoBadge';
import { Acciones, Campos, Cargando, ErrorCarga, Pila, Tarjeta } from '../../components/Estructura';
import { PersonaPicker } from '../../components/PersonaPicker';
import { useAreas } from '../../data/hooks/useCatalogo';
import {
  useDocumentos,
  useEliminarDocumento,
  useEliminarSolucion,
  useGuardarDocumento,
  useGuardarSolucion,
  useSoluciones,
} from '../../data/hooks/useSoluciones';
import {
  TIPOS_DOCUMENTO,
  TIPOS_SOLUCION,
  type Area,
  type Documento,
  type Id,
  type Persona,
  type Solucion,
  type TipoDocumento,
  type TipoSolucion,
} from '../../domain/tipos';

type Seleccion = { modo: 'nueva' } | { modo: 'editar'; solucion: Solucion } | null;

export function AdminSoluciones() {
  const avisos = useAvisos();
  const soluciones = useSoluciones();
  const areas = useAreas();
  const eliminar = useEliminarSolucion();
  const [seleccion, setSeleccion] = useState<Seleccion>(null);

  const error = soluciones.error ?? areas.error;
  if (error) return <ErrorCarga error={error} />;
  if (!soluciones.data || !areas.data) return <Cargando />;
  const listaSoluciones = soluciones.data;
  const listaAreas = areas.data;

  const borrar = async (s: Solucion) => {
    if (!window.confirm(`¿Eliminar la solución "${s.titulo}" y sus documentos?`)) return;
    try {
      await eliminar.mutateAsync(s.id);
      setSeleccion(null);
      avisos.exito('Solución eliminada.');
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Pila>
      <Tarjeta>
        <Table aria-label="Soluciones" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Solución</TableHeaderCell>
              <TableHeaderCell>Proceso</TableHeaderCell>
              <TableHeaderCell>Responsable</TableHeaderCell>
              <TableHeaderCell>Periodicidad</TableHeaderCell>
              <TableHeaderCell>Estado VU</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Acciones</span>
              </TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listaSoluciones.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.titulo}</TableCell>
                <TableCell>{s.procesoNombre}</TableCell>
                <TableCell>{s.responsable.nombre}</TableCell>
                <TableCell>{s.periodicidadMeses} meses</TableCell>
                <TableCell>
                  <EstadoBadge estado={s.estadoVU} />
                </TableCell>
                <TableCell>
                  <Button
                    appearance="subtle"
                    icon={<Edit24Regular />}
                    aria-label={`Editar ${s.titulo}`}
                    onClick={() => setSeleccion({ modo: 'editar', solucion: s })}
                  />
                  <Button appearance="subtle" icon={<Delete24Regular />} aria-label={`Eliminar ${s.titulo}`} onClick={() => borrar(s)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Acciones>
          <Button icon={<Add24Regular />} onClick={() => setSeleccion({ modo: 'nueva' })}>
            Nueva solución
          </Button>
        </Acciones>
      </Tarjeta>
      {seleccion && (
        <FormularioSolucion
          key={seleccion.modo === 'editar' ? seleccion.solucion.id : 'nueva'}
          solucion={seleccion.modo === 'editar' ? seleccion.solucion : null}
          procesos={listaAreas.filter((a) => a.tipo === 'Proceso' && a.activo)}
          onGuardada={(s) => setSeleccion({ modo: 'editar', solucion: s })}
          onCerrar={() => setSeleccion(null)}
        />
      )}
    </Pila>
  );
}

type DatosSolucion = Omit<Solucion, 'id' | 'responsable'> & { responsable: Persona | null };

function FormularioSolucion({
  solucion,
  procesos,
  onGuardada,
  onCerrar,
}: {
  solucion: Solucion | null;
  procesos: Area[];
  onGuardada: (s: Solucion) => void;
  onCerrar: () => void;
}) {
  const avisos = useAvisos();
  const guardar = useGuardarSolucion();
  const [datos, setDatos] = useState<DatosSolucion>(
    solucion ?? {
      titulo: '',
      descripcion: '',
      tipoSolucion: 'Power App',
      procesoId: procesos[0]?.id ?? '',
      procesoNombre: procesos[0]?.titulo ?? '',
      responsable: null,
      usuariosObjetivo: null,
      fechaActualizacion: null,
      periodicidadMeses: 6,
      proximaVU: null,
      estadoVU: 'Pendiente',
      ultimaVerificacionId: null,
    },
  );
  const valido = datos.titulo.trim() !== '' && datos.procesoId !== '' && datos.responsable !== null && datos.periodicidadMeses > 0;

  const enviar = async () => {
    if (!datos.responsable) return;
    try {
      const s = await guardar.mutateAsync({
        id: solucion?.id,
        datos: { ...datos, titulo: datos.titulo.trim(), responsable: datos.responsable },
      });
      avisos.exito('Solución guardada.');
      onGuardada(s);
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Tarjeta titulo={solucion ? `Editar · ${solucion.titulo}` : 'Nueva solución'}>
      <Campos>
        <Field label="Nombre" required>
          <Input maxLength={255} value={datos.titulo} onChange={(_, d) => setDatos({ ...datos, titulo: d.value })} />
        </Field>
        <Field label="Tipo de solución">
          <Select
            value={datos.tipoSolucion ?? ''}
            onChange={(_, d) => setDatos({ ...datos, tipoSolucion: (d.value || null) as TipoSolucion | null })}
          >
            {TIPOS_SOLUCION.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Proceso" required>
          <Select value={String(datos.procesoId)} onChange={(_, d) => setDatos({ ...datos, procesoId: d.value })}>
            {procesos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titulo}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Responsable" required>
          <PersonaPicker valor={datos.responsable} onChange={(p) => setDatos({ ...datos, responsable: p })} />
        </Field>
        <Field label="Usuarios objetivo">
          <Input
            type="number"
            min={0}
            value={datos.usuariosObjetivo?.toString() ?? ''}
            onChange={(_, d) => setDatos({ ...datos, usuariosObjetivo: d.value === '' ? null : Number(d.value) })}
          />
        </Field>
        <Field label="Fecha de actualización">
          <Input
            type="date"
            value={datos.fechaActualizacion ?? ''}
            onChange={(_, d) => setDatos({ ...datos, fechaActualizacion: d.value || null })}
          />
        </Field>
        <Field label="Periodicidad de la VU (meses)" required hint="RN-10: próxima VU = aprobación + periodicidad.">
          <Input
            type="number"
            min={1}
            value={String(datos.periodicidadMeses)}
            onChange={(_, d) => setDatos({ ...datos, periodicidadMeses: Number(d.value) })}
          />
        </Field>
      </Campos>
      <Field label="Descripción">
        <Textarea rows={2} value={datos.descripcion} onChange={(_, d) => setDatos({ ...datos, descripcion: d.value })} />
      </Field>
      <Acciones>
        <Button onClick={onCerrar}>Cerrar</Button>
        <Button appearance="primary" icon={<Save24Regular />} disabled={!valido || guardar.isPending} onClick={enviar}>
          Guardar solución
        </Button>
      </Acciones>
      {solucion && <DocumentosSolucion solucionId={solucion.id} />}
    </Tarjeta>
  );
}

const DOCUMENTO_VACIO = (solucionId: Id): Omit<Documento, 'id'> => ({
  titulo: '',
  solucionId,
  tipo: 'Manual',
  formato: 'PDF',
  enlace: '',
  version: null,
  vigente: true,
});

function DocumentosSolucion({ solucionId }: { solucionId: Id }) {
  const avisos = useAvisos();
  const { data: documentos = [] } = useDocumentos(solucionId);
  const guardar = useGuardarDocumento();
  const eliminar = useEliminarDocumento();
  const [nuevo, setNuevo] = useState(() => DOCUMENTO_VACIO(solucionId));
  const valido = nuevo.titulo.trim() !== '' && /^https?:\/\//.test(nuevo.enlace);

  const agregar = async () => {
    try {
      await guardar.mutateAsync({ datos: { ...nuevo, titulo: nuevo.titulo.trim() } });
      setNuevo(DOCUMENTO_VACIO(solucionId));
      avisos.exito('Documento agregado.');
    } catch (e) {
      avisos.error(e);
    }
  };

  const borrar = async (d: Documento) => {
    if (!window.confirm(`¿Eliminar "${d.titulo}"?`)) return;
    try {
      await eliminar.mutateAsync(d);
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Pila>
      <Text weight="semibold">Documentos (modal "Ver detalle")</Text>
      <div>
        {documentos.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <DocItem documento={d} />
            </div>
            <Button appearance="subtle" icon={<Delete24Regular />} aria-label={`Eliminar ${d.titulo}`} onClick={() => borrar(d)} />
          </div>
        ))}
      </div>
      <Campos>
        <Field label="Título del documento">
          <Input value={nuevo.titulo} onChange={(_, d) => setNuevo({ ...nuevo, titulo: d.value })} />
        </Field>
        <Field label="Tipo">
          <Select value={nuevo.tipo} onChange={(_, d) => setNuevo({ ...nuevo, tipo: d.value as TipoDocumento })}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Formato">
          <Input value={nuevo.formato ?? ''} onChange={(_, d) => setNuevo({ ...nuevo, formato: d.value || null })} />
        </Field>
        <Field label="Versión">
          <Input value={nuevo.version ?? ''} onChange={(_, d) => setNuevo({ ...nuevo, version: d.value || null })} />
        </Field>
        <Field label="Enlace" required hint="PDF, video de Stream/Teams o carpeta de SharePoint.">
          <Input type="url" value={nuevo.enlace} onChange={(_, d) => setNuevo({ ...nuevo, enlace: d.value })} />
        </Field>
        <Checkbox label="Vigente" checked={nuevo.vigente} onChange={(_, d) => setNuevo({ ...nuevo, vigente: d.checked === true })} />
      </Campos>
      <Acciones>
        <Button icon={<Add24Regular />} disabled={!valido || guardar.isPending} onClick={agregar}>
          Agregar documento
        </Button>
      </Acciones>
    </Pila>
  );
}
