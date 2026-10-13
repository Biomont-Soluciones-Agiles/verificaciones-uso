import { Badge, Button, Field, Link, makeStyles, Text, tokens } from '@fluentui/react-components';
import { Attach24Regular, Delete24Regular } from '@fluentui/react-icons';
import type { Evidencia } from '../../domain/tipos';

const useStyles = makeStyles({
  archivo: { font: 'inherit', maxWidth: '100%' },
  lista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXXS },
  item: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, minWidth: 0 },
  nombre: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  nota: { color: tokens.colorNeutralForeground3 },
});

export interface EvidenciasEntrevistaProps {
  evidencias: Evidencia[];
  soloLectura: boolean;
  ocupado: boolean;
  onSubir: (archivos: FileList | null) => void;
  onEliminar: (evidencia: Evidencia) => void;
}

/** "Evidencias generales": capturas y documentos de la entrevista (biblioteca VU_Evidencias). */
export function EvidenciasEntrevista({ evidencias, soloLectura, ocupado, onSubir, onEliminar }: EvidenciasEntrevistaProps) {
  const styles = useStyles();
  return (
    <Field label="Evidencias generales" hint="Capturas o documentos; la grabación se enlaza aparte.">
      {(props) => (
        <div>
          {!soloLectura && (
            <input
              {...props}
              className={styles.archivo}
              type="file"
              multiple
              disabled={ocupado}
              onChange={(e) => {
                onSubir(e.target.files);
                e.target.value = '';
              }}
            />
          )}
          {evidencias.length === 0 ? (
            <Text size={200} className={styles.nota}>
              Sin evidencias.
            </Text>
          ) : (
            <ul className={styles.lista} aria-label="Evidencias de la entrevista">
              {evidencias.map((e) => (
                <li key={e.id} className={styles.item}>
                  <Attach24Regular aria-hidden="true" />
                  {e.url ? (
                    <Link className={styles.nombre} href={e.url} target="_blank" rel="noopener noreferrer">
                      {e.nombreArchivo}
                    </Link>
                  ) : (
                    <Text className={styles.nombre}>{e.nombreArchivo}</Text>
                  )}
                  <Badge appearance="tint" size="small">
                    {e.tipo}
                  </Badge>
                  {e.respuestaId !== null && (
                    <Badge appearance="outline" size="small">
                      vinculada
                    </Badge>
                  )}
                  {!soloLectura && (
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Delete24Regular />}
                      aria-label={`Quitar ${e.nombreArchivo}`}
                      disabled={ocupado}
                      onClick={() => onEliminar(e)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}
