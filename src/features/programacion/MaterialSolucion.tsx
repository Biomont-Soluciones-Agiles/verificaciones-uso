import { Badge, Button, makeStyles, Text, tokens } from '@fluentui/react-components';
import { useNavigate } from 'react-router-dom';
import { useAvisos } from '../../components/avisos';
import { DocItem } from '../../components/DocItem';
import { Tarjeta } from '../../components/Estructura';
import { useFuenteDatos } from '../../data/contexto';
import { useDocumentos } from '../../data/hooks/useSoluciones';
import type { Solucion } from '../../domain/tipos';

const useStyles = makeStyles({
  insignias: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS },
  nota: { color: tokens.colorNeutralForeground3 },
});

/** "Material para prepararte": documentos vinculados desde el catálogo. */
export function MaterialSolucion({ solucion }: { solucion: Solucion | null }) {
  const styles = useStyles();
  const navigate = useNavigate();
  const avisos = useAvisos();
  const fuente = useFuenteDatos();
  const { data: documentos = [] } = useDocumentos(solucion?.id ?? null);
  const vigentes = documentos.filter((d) => d.vigente);
  const videos = vigentes.filter((d) => d.tipo === 'Video').length;
  const carpetas = vigentes.filter((d) => d.tipo === 'Carpeta').length;

  return (
    <Tarjeta titulo="Material para prepararte">
      <Text size={200} className={styles.nota}>
        {solucion ? 'Documentos vinculados desde el catálogo de la solución.' : 'Selecciona una solución.'}
      </Text>
      {solucion && (
        <>
          <div className={styles.insignias}>
            <Badge appearance="tint">{vigentes.length} documentos</Badge>
            {videos > 0 && <Badge appearance="tint">{videos === 1 ? '1 video' : `${videos} videos`}</Badge>}
            {carpetas > 0 && <Badge appearance="tint">Carpeta de evidencias</Badge>}
          </div>
          <div>
            {vigentes.map((d) => (
              <DocItem
                key={d.id}
                documento={d}
                onAbrir={
                  fuente === 'mock'
                    ? (doc) => avisos.info(`${doc.titulo}: vista previa disponible desde el catálogo.`)
                    : undefined
                }
              />
            ))}
          </div>
        </>
      )}
      <Button onClick={() => navigate('/catalogo')}>Volver al catálogo</Button>
    </Tarjeta>
  );
}
