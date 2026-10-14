import { Button, Field, Input, makeStyles, mergeClasses, Text, ToggleButton, tokens } from '@fluentui/react-components';
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
    alignItems: 'flex-end',
    '& > *': { flex: '1 1 260px' },
  },
  conteo: { color: tokens.colorNeutralForeground2, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' },
  // Filtro por estado como fichas con su recuento: se ve de un vistazo cuántas soluciones hay en
  // cada estado (según la búsqueda) y se cambia con un toque. En móvil se desplaza en horizontal.
  fichas: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    overflowX: 'auto',
    paddingBlock: tokens.spacingVerticalXXS,
    '@media (min-width: 641px)': { flexWrap: 'wrap', overflowX: 'visible' },
  },
  ficha: { flexShrink: 0 },
  fichaActiva: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    border: `1px solid ${tokens.colorBrandStroke2}`,
    ':hover': { backgroundColor: tokens.colorBrandBackground2Hover, color: tokens.colorBrandForeground2 },
    ':hover:active': { backgroundColor: tokens.colorBrandBackground2Pressed, color: tokens.colorBrandForeground2 },
  },
  recuento: { marginInlineStart: tokens.spacingHorizontalXS, fontVariantNumeric: 'tabular-nums', opacity: 0.8 },
});

function coincide(s: Solucion, texto: string): boolean {
  const t = texto.trim().toLocaleLowerCase('es');
  if (!t) return true;
  return [s.titulo, s.tipoProceso ?? '', s.procesoNombre, s.responsable?.nombre ?? ''].some((v) =>
    v.toLocaleLowerCase('es').includes(t),
  );
}

export function CatalogoPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { data: soluciones, isPending, error, refetch } = useSoluciones();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoVU | 'Todos'>('Todos');
  const [detalle, setDetalle] = useState<Solucion | null>(null);

  const porBusqueda = (soluciones ?? []).filter((s) => coincide(s, busqueda));
  const filtradas = porBusqueda.filter((s) => estado === 'Todos' || s.estadoVU === estado);
  const recuento = (e: EstadoVU | 'Todos') =>
    e === 'Todos' ? porBusqueda.length : porBusqueda.filter((s) => s.estadoVU === e).length;
  const hayFiltros = busqueda.trim() !== '' || estado !== 'Todos';
  const limpiarFiltros = () => {
    setBusqueda('');
    setEstado('Todos');
  };

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
            placeholder="Nombre, proceso, área o responsable"
            value={busqueda}
            onChange={(_, d) => setBusqueda(d.value)}
          />
        </Field>
        {soluciones && (
          <Text className={styles.conteo} role="status" aria-live="polite">
            {filtradas.length === soluciones.length
              ? `${soluciones.length} ${soluciones.length === 1 ? 'solución' : 'soluciones'}`
              : `${filtradas.length} de ${soluciones.length} soluciones`}
          </Text>
        )}
      </div>
      <div className={styles.fichas} role="group" aria-label="Filtrar por estado">
        {(['Todos', ...ESTADOS_VU] as const).map((e) => (
          <ToggleButton
            key={e}
            size="small"
            shape="circular"
            checked={estado === e}
            className={mergeClasses(styles.ficha, estado === e && styles.fichaActiva)}
            onClick={() => setEstado(e)}
          >
            {e}
            <span className={styles.recuento}>{recuento(e)}</span>
          </ToggleButton>
        ))}
      </div>
      {error ? (
        <ErrorCarga error={error} onReintentar={() => void refetch()} />
      ) : isPending ? (
        <Cargando texto="Cargando el catálogo…" />
      ) : (
        <TablaSoluciones
          soluciones={filtradas}
          onLimpiarFiltros={hayFiltros ? limpiarFiltros : undefined}
          onVerDetalle={setDetalle}
          onAbrirVerificacion={(id) => navigate(`/verificaciones/${id}/programacion`)}
        />
      )}
      {detalle && <DetalleSolucionDialog solucion={detalle} onCerrar={() => setDetalle(null)} />}
    </Pila>
  );
}
