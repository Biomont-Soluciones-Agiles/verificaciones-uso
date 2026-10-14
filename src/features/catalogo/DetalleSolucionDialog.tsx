import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  Spinner,
  Text,
  tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';
import { useAvisos } from '../../components/avisos';
import { DocItem } from '../../components/DocItem';
import { LineaResumen, ListaResumen } from '../../components/Estructura';
import { useFuenteDatos } from '../../data/contexto';
import { useDocumentos } from '../../data/hooks/useSoluciones';
import { useVerificaciones } from '../../data/hooks/useVerificaciones';
import { formatearFecha } from '../../domain/fechas';
import { esVerificacionActiva } from '../../domain/flujo';
import type { Solucion } from '../../domain/tipos';

const useStyles = makeStyles({
  contenido: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  descripcion: { color: tokens.colorNeutralForeground2 },
  documentos: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
});

export interface DetalleSolucionDialogProps {
  solucion: Solucion;
  onCerrar: () => void;
}

/** Modal "Ver detalle": ficha de la solución y su material (manual, instructivo, video, carpeta). */
export function DetalleSolucionDialog({ solucion, onCerrar }: DetalleSolucionDialogProps) {
  const styles = useStyles();
  const navigate = useNavigate();
  const avisos = useAvisos();
  const fuente = useFuenteDatos();
  const { data: documentos, isPending } = useDocumentos(solucion.id);
  const { data: verificaciones } = useVerificaciones();
  const activa = verificaciones?.find((v) => v.solucionId === solucion.id && esVerificacionActiva(v.estado));
  const vigentes = (documentos ?? []).filter((d) => d.vigente);

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onCerrar()}>
      <DialogSurface aria-describedby="detalle-solucion-descripcion">
        <DialogBody>
          <DialogTitle
            action={<Button appearance="subtle" aria-label="Cerrar" icon={<Dismiss24Regular />} onClick={onCerrar} />}
          >
            {solucion.titulo}
          </DialogTitle>
          <DialogContent className={styles.contenido}>
            <Text id="detalle-solucion-descripcion" className={styles.descripcion}>
              {solucion.descripcion}
            </Text>
            <ListaResumen>
              <LineaResumen etiqueta="Proceso" valor={solucion.tipoProceso ?? 'Sin definir'} />
              <LineaResumen etiqueta="Área responsable" valor={solucion.procesoNombre} />
              <LineaResumen etiqueta="Responsable" valor={solucion.responsable?.nombre ?? 'Sin responsable'} />
              <LineaResumen
                etiqueta="Usuarios objetivo"
                valor={solucion.usuariosObjetivo !== null ? `${solucion.usuariosObjetivo} usuarios` : '—'}
              />
              <LineaResumen etiqueta="Actualización" valor={formatearFecha(solucion.fechaActualizacion)} />
              <LineaResumen etiqueta="Próxima VU" valor={formatearFecha(solucion.proximaVU)} />
            </ListaResumen>
            <section aria-labelledby="detalle-solucion-documentos" className={styles.documentos}>
              <Text as="h3" id="detalle-solucion-documentos" weight="semibold">
                Material de la solución
              </Text>
              {isPending ? (
                <Spinner size="small" label="Cargando documentos…" />
              ) : vigentes.length === 0 ? (
                <Text className={styles.descripcion}>Esta solución aún no tiene manual, instructivo ni video vigentes.</Text>
              ) : (
                vigentes.map((d) => (
                  <DocItem
                    key={d.id}
                    documento={d}
                    onAbrir={
                      fuente === 'mock'
                        ? (doc) => avisos.info(`${doc.titulo}: vista previa disponible desde el catálogo.`)
                        : undefined
                    }
                  />
                ))
              )}
            </section>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCerrar}>Volver al catálogo</Button>
            {activa ? (
              <Button appearance="primary" onClick={() => navigate(`/verificaciones/${activa.id}/programacion`)}>
                Abrir {activa.codigo}
              </Button>
            ) : (
              <Button appearance="primary" onClick={() => navigate(`/programar?solucion=${solucion.id}`)}>
                Programar esta solución
              </Button>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
