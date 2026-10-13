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
import { EstadoBadge } from '../../components/EstadoBadge';
import { EstadoVacio } from '../../components/Estructura';
import { formatearFecha } from '../../domain/fechas';
import type { Id, Solucion } from '../../domain/tipos';

const useStyles = makeStyles({
  contenedor: {
    overflowX: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  tabla: { minWidth: '820px' },
  acciones: { display: 'flex', gap: tokens.spacingHorizontalXS, justifyContent: 'flex-end', flexWrap: 'wrap' },
  secundario: { color: tokens.colorNeutralForeground2 },
  fecha: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
});

export interface TablaSolucionesProps {
  soluciones: Solucion[];
  onVerDetalle: (s: Solucion) => void;
  onAbrirVerificacion: (verificacionId: Id) => void;
  /** Si hay filtros aplicados, permite quitarlos desde el estado vacío. */
  onLimpiarFiltros?: () => void;
}

export function TablaSoluciones({ soluciones, onVerDetalle, onAbrirVerificacion, onLimpiarFiltros }: TablaSolucionesProps) {
  const styles = useStyles();
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
      <Table className={styles.tabla} aria-label="Soluciones digitales">
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Solución</TableHeaderCell>
            <TableHeaderCell>Proceso</TableHeaderCell>
            <TableHeaderCell>Responsable</TableHeaderCell>
            <TableHeaderCell>Próxima VU</TableHeaderCell>
            <TableHeaderCell>Estado</TableHeaderCell>
            <TableHeaderCell>
              <span className="sr-only">Acciones</span>
            </TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {soluciones.map((s) => (
            <TableRow key={s.id}>
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
                      onClick={() => onAbrirVerificacion(s.ultimaVerificacionId!)}
                      aria-label={`Abrir la verificación de ${s.titulo}`}
                    >
                      Abrir verificación
                    </Button>
                  )}
                  <Button
                    appearance="subtle"
                    icon={<TextBulletListSquare20Regular />}
                    onClick={() => onVerDetalle(s)}
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
