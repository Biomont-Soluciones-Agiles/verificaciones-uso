import { Badge, makeStyles, MessageBar, MessageBarBody, Text, tokens } from '@fluentui/react-components';
import { useSearchParams } from 'react-router-dom';
import { useVerificacionDeRuta } from '../../app/useVerificacionDeRuta';
import { Cargando, Encabezado, ErrorCarga, Pila, Tarjeta } from '../../components/Estructura';
import { useCriterios, useOpciones, usePreguntas } from '../../data/hooks/useCatalogo';
import { useEntrevistas, useEvidencias } from '../../data/hooks/useEntrevistas';
import { admiteEntrevistas, contarCompletas } from '../../domain/flujo';
import type { Entrevista } from '../../domain/tipos';
import { EditorEntrevista } from './EditorEntrevista';
import { ListaEntrevistas } from './ListaEntrevistas';

const useStyles = makeStyles({
  rejilla: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
    '@media (max-width: 860px)': { gridTemplateColumns: '1fr' },
  },
  nota: { color: tokens.colorNeutralForeground3 },
});

function predeterminada(entrevistas: Entrevista[]): Entrevista | undefined {
  return (
    entrevistas.find((e) => e.estado === 'En curso') ??
    entrevistas.find((e) => e.estado === 'Pendiente') ??
    entrevistas[0]
  );
}

export function EntrevistasPage() {
  const styles = useStyles();
  const verificacion = useVerificacionDeRuta();
  const [params, setParams] = useSearchParams();
  const entrevistas = useEntrevistas(verificacion.id);
  const evidencias = useEvidencias(verificacion.id);
  const preguntas = usePreguntas();
  const opciones = useOpciones();
  const criterios = useCriterios();

  const error = entrevistas.error ?? evidencias.error ?? preguntas.error ?? opciones.error ?? criterios.error;
  if (error) return <ErrorCarga error={error} />;
  if (!entrevistas.data || !evidencias.data || !preguntas.data || !opciones.data || !criterios.data) {
    return <Cargando />;
  }

  const lista = entrevistas.data;
  const listaEvidencias = evidencias.data;
  const idSolicitado = Number(params.get('entrevista'));
  const seleccionada = lista.find((e) => e.id === idSolicitado) ?? predeterminada(lista);
  const completas = contarCompletas(lista);
  const editable = admiteEntrevistas(verificacion.estado);
  const seleccionar = (id: number) => setParams({ entrevista: String(id) }, { replace: true });

  return (
    <Pila>
      <Encabezado
        titulo={`Entrevistas · ${verificacion.solucionNombre}`}
        subtitulo="Registra varias respuestas por usuario y guarda cada avance sin notificar."
        extra={
          <Badge appearance="tint" size="large">
            {completas} de {verificacion.entrevistasPrevistas} completadas
          </Badge>
        }
      />
      {!editable && (
        <MessageBar intent="info">
          <MessageBarBody>
            {verificacion.estado === 'Borrador'
              ? 'Programa la verificación para empezar a registrar entrevistas.'
              : `La verificación está en estado "${verificacion.estado}": las entrevistas son de solo lectura.`}
          </MessageBarBody>
        </MessageBar>
      )}
      <div className={styles.rejilla}>
        <ListaEntrevistas
          verificacion={verificacion}
          entrevistas={lista}
          seleccionadaId={seleccionada?.id ?? null}
          onSeleccionar={seleccionar}
          editable={editable}
        />
        {seleccionada ? (
          <EditorEntrevista
            key={seleccionada.id}
            verificacion={verificacion}
            entrevista={seleccionada}
            evidencias={listaEvidencias.filter((e) => e.entrevistaId === seleccionada.id)}
            preguntas={preguntas.data.filter((p) => p.activo)}
            opciones={opciones.data}
            criterios={criterios.data}
            soloLectura={!editable}
          />
        ) : (
          <Tarjeta>
            <Text className={styles.nota}>
              Aún no hay entrevistas registradas. Usa "Agregar entrevista" para empezar el levantamiento.
            </Text>
          </Tarjeta>
        )}
      </div>
    </Pila>
  );
}
