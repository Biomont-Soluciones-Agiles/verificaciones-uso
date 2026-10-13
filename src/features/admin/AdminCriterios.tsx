import {
  Button,
  Checkbox,
  Input,
  MessageBar,
  MessageBarBody,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
} from '@fluentui/react-components';
import { Add24Regular, Delete24Regular, Save24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useAvisos } from '../../components/avisos';
import { Acciones, Cargando, ErrorCarga, Tarjeta } from '../../components/Estructura';
import { useCriterios, useGuardarCriterios, type CambiosCriterios } from '../../data/hooks/useCatalogo';
import { pesosValidos, sumaPesos, SUMA_PESOS_REQUERIDA } from '../../domain/evaluacion';
import type { Criterio, Id } from '../../domain/tipos';

export function AdminCriterios() {
  const { data, error, isPending, dataUpdatedAt } = useCriterios();
  if (error) return <ErrorCarga error={error} />;
  if (isPending) return <Cargando />;
  return <EditorCriterios key={dataUpdatedAt} originales={data} />;
}

function calcularCambios(originales: Criterio[], filas: Criterio[]): CambiosCriterios {
  const cambios: CambiosCriterios = { crear: [], actualizar: [], eliminar: [] };
  for (const o of originales) if (!filas.some((f) => f.id === o.id)) cambios.eliminar.push(o.id);
  for (const f of filas) {
    const { id, ...datos } = f;
    const o = originales.find((x) => x.id === id);
    if (!o) cambios.crear.push(datos);
    else if (o.titulo !== f.titulo || o.peso !== f.peso || o.orden !== f.orden || o.activo !== f.activo) {
      cambios.actualizar.push({ id, cambios: datos });
    }
  }
  return cambios;
}

function EditorCriterios({ originales }: { originales: Criterio[] }) {
  const avisos = useAvisos();
  const guardar = useGuardarCriterios();
  const [filas, setFilas] = useState<Criterio[]>(originales);
  const [siguienteTemporal, setSiguienteTemporal] = useState(1);

  const suma = sumaPesos(filas);
  const validos = pesosValidos(filas) && filas.every((f) => f.titulo.trim() && f.peso >= 0 && f.peso <= 100);

  const cambiar = (id: Id, cambios: Partial<Criterio>) =>
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...cambios } : f)));

  const agregar = () => {
    setFilas((fs) => [
      ...fs,
      { id: `nuevo-${siguienteTemporal}`, titulo: '', peso: 0, orden: fs.reduce((m, f) => Math.max(m, f.orden), 0) + 1, activo: true },
    ]);
    setSiguienteTemporal((n) => n + 1);
  };

  const guardarCambios = async () => {
    try {
      await guardar.mutateAsync(calcularCambios(originales, filas));
      avisos.exito('Criterios guardados. Las verificaciones existentes conservan sus pesos copiados.');
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <Tarjeta>
      <Table aria-label="Criterios de evaluación" size="small">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Criterio</TableHeaderCell>
            <TableHeaderCell>Peso (%)</TableHeaderCell>
            <TableHeaderCell>Orden</TableHeaderCell>
            <TableHeaderCell>Activo</TableHeaderCell>
            <TableHeaderCell>
              <span className="sr-only">Acciones</span>
            </TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <Input aria-label="Nombre del criterio" value={f.titulo} onChange={(_, d) => cambiar(f.id, { titulo: d.value })} />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Peso de ${f.titulo}`}
                  type="number"
                  min={0}
                  max={100}
                  value={String(f.peso)}
                  onChange={(_, d) => cambiar(f.id, { peso: Number(d.value) })}
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Orden de ${f.titulo}`}
                  type="number"
                  value={String(f.orden)}
                  onChange={(_, d) => cambiar(f.id, { orden: Number(d.value) })}
                />
              </TableCell>
              <TableCell>
                <Checkbox
                  aria-label={`${f.titulo} activo`}
                  checked={f.activo}
                  onChange={(_, d) => cambiar(f.id, { activo: d.checked === true })}
                />
              </TableCell>
              <TableCell>
                <Button
                  appearance="subtle"
                  icon={<Delete24Regular />}
                  aria-label={`Eliminar ${f.titulo}`}
                  onClick={() => setFilas((fs) => fs.filter((x) => x.id !== f.id))}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Text>
        Suma de pesos activos: <strong>{suma} %</strong>
      </Text>
      {!pesosValidos(filas) && (
        <MessageBar intent="error">
          <MessageBarBody>
            Los pesos de los criterios activos deben sumar {SUMA_PESOS_REQUERIDA} % (ahora suman {suma} %).
          </MessageBarBody>
        </MessageBar>
      )}
      <Acciones>
        <Button icon={<Add24Regular />} onClick={agregar}>
          Agregar criterio
        </Button>
        <Button appearance="primary" icon={<Save24Regular />} disabled={!validos || guardar.isPending} onClick={guardarCambios}>
          Guardar criterios
        </Button>
      </Acciones>
    </Tarjeta>
  );
}
