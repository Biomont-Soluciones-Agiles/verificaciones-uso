import {
  Button,
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from '@fluentui/react-components';
import { Open20Regular, Search24Regular, TextBulletListSquare20Regular } from '@fluentui/react-icons';
import { useState, type MouseEvent } from 'react';
import { CURVA_SALIDA, DURACION, fundir, MENOS_MOVIMIENTO } from '../../app/movimiento';
import { EstadoBadge } from '../../components/EstadoBadge';
import { EstadoVacio } from '../../components/Estructura';
import { formatearFecha } from '../../domain/fechas';
import { ESTADOS_VU, type Id, type Solucion } from '../../domain/tipos';

const useStyles = makeStyles({
  contenedor: {
    overflowX: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  tabla: { minWidth: '820px' },
  acciones: { display: 'flex', gap: tokens.spacingHorizontalXS, justifyContent: 'flex-end', whiteSpace: 'nowrap' },
  // La tabla reparte el ancho en columnas iguales: la de acciones necesita el suyo para no partir los botones.
  columnaAcciones: { width: '330px' },
  secundario: { color: tokens.colorNeutralForeground2 },
  fecha: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  // Toda la fila abre el detalle; las acciones de la derecha siguen siendo botones propios.
  fila: {
    cursor: 'pointer',
    animationName: fundir,
    animationDuration: DURACION.estado,
    animationTimingFunction: CURVA_SALIDA,
    animationFillMode: 'both',
    [MENOS_MOVIMIENTO]: { animationDelay: '0ms' },
  },
});

type Columna = 'titulo' | 'proceso' | 'responsable' | 'proximaVU' | 'estado';
type Direccion = 'ascending' | 'descending';

const COLUMNAS: { id: Columna; titulo: string }[] = [
  { id: 'titulo', titulo: 'Solución' },
  { id: 'proceso', titulo: 'Proceso' },
  { id: 'responsable', titulo: 'Responsable' },
  { id: 'proximaVU', titulo: 'Próxima VU' },
  { id: 'estado', titulo: 'Estado' },
];

const texto = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

/** Orden por columna; los valores vacíos (sin responsable, sin próxima VU) van siempre al final. */
function comparar(a: Solucion, b: Solucion, columna: Columna): number {
  switch (columna) {
    case 'titulo':
      return texto(a.titulo, b.titulo);
    case 'proceso':
      return texto(a.procesoNombre, b.procesoNombre);
    case 'responsable':
      return texto(a.responsable?.nombre ?? '', b.responsable?.nombre ?? '');
    case 'proximaVU':
      return (a.proximaVU ?? '').localeCompare(b.proximaVU ?? '');
    case 'estado':
      return ESTADOS_VU.indexOf(a.estadoVU) - ESTADOS_VU.indexOf(b.estadoVU);
  }
}

function vacio(s: Solucion, columna: Columna): boolean {
  return (columna === 'responsable' && !s.responsable) || (columna === 'proximaVU' && !s.proximaVU);
}

/** Retraso escalonado de la entrada de filas, con tope para que la tabla no "se haga esperar". */
const retraso = (i: number) => `${Math.min(i, 8) * 24}ms`;

const sinPropagar = (accion: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  accion();
};

export interface TablaSolucionesProps {
  soluciones: Solucion[];
  onVerDetalle: (s: Solucion) => void;
  onAbrirVerificacion: (verificacionId: Id) => void;
  /** Si hay filtros aplicados, permite quitarlos desde el estado vacío. */
  onLimpiarFiltros?: () => void;
}

export function TablaSoluciones({ soluciones, onVerDetalle, onAbrirVerificacion, onLimpiarFiltros }: TablaSolucionesProps) {
  const styles = useStyles();
  const [orden, setOrden] = useState<{ columna: Columna; direccion: Direccion }>({ columna: 'titulo', direccion: 'ascending' });
  const ordenar = (columna: Columna) =>
    setOrden((o) => ({
      columna,
      direccion: o.columna === columna && o.direccion === 'ascending' ? 'descending' : 'ascending',
    }));

  if (soluciones.length === 0) {
    return onLimpiarFiltros ? (
      <EstadoVacio
        icono={<Search24Regular />}
        titulo="Ninguna solución coincide con la búsqueda"
        descripcion="Prueba con otro nombre, proceso o responsable, o muestra todos los estados."
        accion={<Button onClick={onLimpiarFiltros}>Quitar filtros</Button>}
      />
    ) : (
      <EstadoVacio
        titulo="Aún no hay soluciones en el catálogo"
        descripcion="Registra las soluciones digitales desde Administración › Soluciones y documentos."
      />
    );
  }
  return (
    <div className={styles.contenedor}>
      <Table sortable className={styles.tabla} aria-label="Soluciones digitales">
        <TableHeader>
          <TableRow>
            {COLUMNAS.map((c) => (
              <TableHeaderCell
                key={c.id}
                sortDirection={orden.columna === c.id ? orden.direccion : undefined}
                onClick={() => ordenar(c.id)}
              >
                {c.titulo}
              </TableHeaderCell>
            ))}
            <TableHeaderCell sortable={false} className={styles.columnaAcciones}>
              <span className="sr-only">Acciones</span>
            </TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenadas(soluciones, orden.columna, orden.direccion).map((s, i) => (
            <TableRow
              key={s.id}
              className={styles.fila}
              style={{ animationDelay: retraso(i) }}
              onClick={() => onVerDetalle(s)}
            >
              <TableCell>
                <Text weight="semibold">{s.titulo}</Text>
              </TableCell>
              <TableCell className={styles.secundario}>{s.procesoNombre}</TableCell>
              <TableCell className={styles.secundario}>{s.responsable?.nombre ?? 'Sin responsable'}</TableCell>
              <TableCell className={styles.fecha}>{formatearFecha(s.proximaVU)}</TableCell>
              <TableCell>
                <EstadoBadge estado={s.estadoVU} />
              </TableCell>
              <TableCell>
                <div className={styles.acciones}>
                  {s.ultimaVerificacionId && (
                    <Button
                      appearance="subtle"
                      icon={<Open20Regular />}
                      onClick={sinPropagar(() => onAbrirVerificacion(s.ultimaVerificacionId!))}
                      aria-label={`Abrir la verificación de ${s.titulo}`}
                    >
                      Abrir verificación
                    </Button>
                  )}
                  <Button
                    appearance="subtle"
                    icon={<TextBulletListSquare20Regular />}
                    onClick={sinPropagar(() => onVerDetalle(s))}
                    aria-label={`Ver detalle de ${s.titulo}`}
                  >
                    Ver detalle
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ordenadas(lista: Solucion[], columna: Columna, direccion: Direccion): Solucion[] {
  const signo = direccion === 'ascending' ? 1 : -1;
  return [...lista].sort((a, b) => {
    const va = vacio(a, columna);
    const vb = vacio(b, columna);
    if (va !== vb) return va ? 1 : -1;
    return signo * comparar(a, b, columna) || texto(a.titulo, b.titulo);
  });
}
