import {
  Button,
  makeStyles,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from '@fluentui/react-components';
import { ArrowRight12Regular, History16Regular } from '@fluentui/react-icons';
import { formatearFechaHora } from '../domain/fechas';
import type { CambioPuntaje } from '../domain/tipos';

const useStyles = makeStyles({
  superficie: { maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  lista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  cambio: { display: 'flex', flexDirection: 'column' },
  valores: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: tokens.fontWeightSemibold,
  },
  anterior: { color: tokens.colorNeutralForeground3, textDecorationLine: 'line-through' },
  detalle: { color: tokens.colorNeutralForeground3 },
  pregunta: { minWidth: '200px' },
  numero: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
});

const valor = (p: number | null) => (p === null ? 'sin puntaje' : String(p));
const autor = (c: CambioPuntaje) => c.autor?.nombre || c.autor?.email || 'Usuario desconocido';

/** "6 → 8", con el valor anterior tachado. */
function Valores({ cambio }: { cambio: CambioPuntaje }) {
  const styles = useStyles();
  return (
    <span className={styles.valores} aria-label={`de ${valor(cambio.puntajeAnterior)} a ${valor(cambio.puntajeNuevo)}`}>
      <span className={styles.anterior} aria-hidden="true">
        {valor(cambio.puntajeAnterior)}
      </span>
      <ArrowRight12Regular aria-hidden="true" />
      <span aria-hidden="true">{valor(cambio.puntajeNuevo)}</span>
    </span>
  );
}

/** Botón junto a una respuesta: cuántas veces cambió su puntaje y, al abrirlo, el detalle. */
export function HistorialRespuesta({ cambios }: { cambios: CambioPuntaje[] }) {
  const styles = useStyles();
  if (cambios.length === 0) return null;
  const texto = cambios.length === 1 ? '1 cambio' : `${cambios.length} cambios`;
  return (
    <Popover withArrow positioning="below-end">
      <PopoverTrigger disableButtonEnhancement>
        <Button size="small" appearance="subtle" icon={<History16Regular />} aria-label={`Historial del puntaje: ${texto}`}>
          {texto}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.superficie} aria-label="Historial del puntaje">
        <Text weight="semibold">Historial del puntaje</Text>
        <ul className={styles.lista}>
          {cambios.map((c) => (
            <li key={c.id} className={styles.cambio}>
              <Valores cambio={c} />
              <Text size={200} className={styles.detalle}>
                {autor(c)} · {formatearFechaHora(c.fecha)}
              </Text>
            </li>
          ))}
        </ul>
      </PopoverSurface>
    </Popover>
  );
}

/** Tabla de todos los cambios de puntaje de una verificación (revisión final). */
export function TablaCambiosPuntaje({
  cambios,
  entrevistaDe,
}: {
  cambios: CambioPuntaje[];
  /** Nombre de la entrevista a la que pertenece la respuesta. */
  entrevistaDe: (respuestaId: string) => string;
}) {
  const styles = useStyles();
  if (cambios.length === 0) {
    return (
      <Text size={200} className={styles.detalle}>
        Ningún puntaje se modificó después de registrarse.
      </Text>
    );
  }
  return (
    <Table size="small" aria-label="Cambios de puntaje">
      <TableHeader>
        <TableRow>
          <TableHeaderCell className={styles.pregunta}>Pregunta</TableHeaderCell>
          <TableHeaderCell>Puntaje</TableHeaderCell>
          <TableHeaderCell>Quién y cuándo</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cambios.map((c) => (
          <TableRow key={c.id}>
            <TableCell className={styles.pregunta}>
              <span className={styles.cambio}>
                <Text>{c.titulo}</Text>
                <Text size={200} className={styles.detalle}>
                  {entrevistaDe(c.respuestaId)}
                </Text>
              </span>
            </TableCell>
            <TableCell className={styles.numero}>
              <Valores cambio={c} />
            </TableCell>
            <TableCell>
              <span className={styles.cambio}>
                <Text size={200}>{autor(c)}</Text>
                <Text size={200} className={styles.detalle}>
                  {formatearFechaHora(c.fecha)}
                </Text>
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
