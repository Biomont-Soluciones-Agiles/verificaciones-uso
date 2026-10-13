import { Button, Field, Input, makeStyles, Select, tokens } from '@fluentui/react-components';
import { Add24Regular, Search20Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cargando, Encabezado, ErrorCarga, Pila } from '../../components/Estructura';
import { useSoluciones } from '../../data/hooks/useSoluciones';
import { ESTADOS_VU, type EstadoVU, type Solucion } from '../../domain/tipos';
import { DetalleSolucionDialog } from './DetalleSolucionDialog';
import { TablaSoluciones } from './TablaSoluciones';

const useStyles = makeStyles({
  filtros: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    '& > *': { flex: '1 1 260px' },
  },
});

function coincide(s: Solucion, texto: string): boolean {
  const t = texto.trim().toLocaleLowerCase('es');
  if (!t) return true;
  return [s.titulo, s.procesoNombre, s.responsable.nombre].some((v) => v.toLocaleLowerCase('es').includes(t));
}

export function CatalogoPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { data: soluciones, isPending, error } = useSoluciones();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoVU | 'Todos'>('Todos');
  const [detalle, setDetalle] = useState<Solucion | null>(null);

  const filtradas = (soluciones ?? []).filter(
    (s) => coincide(s, busqueda) && (estado === 'Todos' || s.estadoVU === estado),
  );

  return (
    <Pila>
      <Encabezado
        titulo="Catálogo de soluciones digitales"
        subtitulo="Consulta la información del desarrollo y prepara la verificación antes de reunirte con los usuarios."
        extra={
          <Button appearance="primary" icon={<Add24Regular />} onClick={() => navigate('/programar')}>
            Programar verificación
          </Button>
        }
      />
      <div className={styles.filtros}>
        <Field label="Buscar solución">
          <Input
            type="search"
            contentBefore={<Search20Regular />}
            placeholder="Nombre, proceso o responsable"
            value={busqueda}
            onChange={(_, d) => setBusqueda(d.value)}
          />
        </Field>
        <Field label="Estado">
          <Select value={estado} onChange={(_, d) => setEstado(d.value as EstadoVU | 'Todos')}>
            <option value="Todos">Todos</option>
            {ESTADOS_VU.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error ? (
        <ErrorCarga error={error} />
      ) : isPending ? (
        <Cargando />
      ) : (
        <TablaSoluciones
          soluciones={filtradas}
          onVerDetalle={setDetalle}
          onAbrirVerificacion={(id) => navigate(`/verificaciones/${id}/programacion`)}
        />
      )}
      {detalle && <DetalleSolucionDialog solucion={detalle} onCerrar={() => setDetalle(null)} />}
    </Pila>
  );
}
