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
import { EstadoBadge } from '../../components/EstadoBadge';
import { formatearFecha } from '../../domain/fechas';
import type { Id, Solucion } from '../../domain/tipos';

const useStyles = makeStyles({
  contenedor: { overflowX: 'auto', backgroundColor: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusLarge },
  tabla: { minWidth: '820px' },
  acciones: { display: 'flex', gap: tokens.spacingHorizontalXS, justifyContent: 'flex-end' },
  vacio: { padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground3 },
});

export interface TablaSolucionesProps {
  soluciones: Solucion[];
  onVerDetalle: (s: Solucion) => void;
  onAbrirVerificacion: (verificacionId: Id) => void;
}

export function TablaSoluciones({ soluciones, onVerDetalle, onAbrirVerificacion }: TablaSolucionesProps) {
  const styles = useStyles();
  if (soluciones.length === 0) {
    return <Text className={styles.vacio}>No hay soluciones que coincidan con la búsqueda.</Text>;
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
              <TableCell>{s.procesoNombre}</TableCell>
              <TableCell>{s.responsable.nombre}</TableCell>
              <TableCell>{formatearFecha(s.proximaVU)}</TableCell>
              <TableCell>
                <EstadoBadge estado={s.estadoVU} />
              </TableCell>
              <TableCell>
                <div className={styles.acciones}>
                  {s.ultimaVerificacionId && (
                    <Button appearance="subtle" onClick={() => onAbrirVerificacion(s.ultimaVerificacionId!)}>
                      Abrir verificación
                    </Button>
                  )}
                  <Button appearance="subtle" onClick={() => onVerDetalle(s)} aria-label={`Ver detalle de ${s.titulo}`}>
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
