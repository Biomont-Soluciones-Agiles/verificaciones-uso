import { Badge, Button, Field, Textarea } from '@fluentui/react-components';
import { ArrowSync24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useConfirmar } from '../../components/Confirmacion';
import { DosColumnas, Encabezado, LineaResumen, ListaResumen, Pila, Tarjeta } from '../../components/Estructura';
import { IndiceAdopcion } from '../../components/IndiceAdopcion';
import { SelloAprobacion } from '../../components/SelloAprobacion';
import type { DatosConsolidado } from '../../data/servicios';
import { consolidarTextos, resumirEvidencias, textoEvidencias } from '../../domain/consolidacion';
import { indiceAdopcion } from '../../domain/evaluacion';
import { contarCompletas, esEditableDesdeApp, puedeFinalizar } from '../../domain/flujo';
import type { Entrevista, Evidencia, PuntajeCriterio, Verificacion } from '../../domain/tipos';
import { ControlEnvio } from './ControlEnvio';

export interface FormularioRevisionProps {
  verificacion: Verificacion;
  entrevistas: Entrevista[];
  evidencias: Evidencia[];
  puntajes: PuntajeCriterio[];
  inicial: DatosConsolidado;
}

function textoEstado(v: Verificacion, completas: number): string {
  if (!esEditableDesdeApp(v.estado)) return v.estado;
  return puedeFinalizar({ entrevistasCompletas: completas, entrevistasPrevistas: v.entrevistasPrevistas })
    ? 'Listo para revisión'
    : `Pendiente · ${completas} de ${v.entrevistasPrevistas}`;
}

export function FormularioRevision({ verificacion, entrevistas, evidencias, puntajes, inicial }: FormularioRevisionProps) {
  const confirmar = useConfirmar();
  const [datos, setDatos] = useState<DatosConsolidado>(inicial);
  const editable = esEditableDesdeApp(verificacion.estado);
  const completas = contarCompletas(entrevistas);
  const indice = editable || verificacion.indiceAdopcion === null ? indiceAdopcion(puntajes) : verificacion.indiceAdopcion;
  const resumen = resumirEvidencias(entrevistas, evidencias);

  const cambiar = <K extends keyof DatosConsolidado>(campo: K, valor: DatosConsolidado[K]) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  const recargar = async () => {
    const hayTexto = datos.oportunidadesConsolidadas.trim() !== '' || datos.recomendacionesConsolidadas.trim() !== '';
    if (
      hayTexto &&
      !(await confirmar({
        titulo: '¿Recargar desde las entrevistas?',
        mensaje: 'Se reemplazará el texto actual de oportunidades y recomendaciones por el de las entrevistas completas.',
        confirmar: 'Reemplazar texto',
        peligrosa: true,
      }))
    ) {
      return;
    }
    const fuente = entrevistas.filter((e) => e.estado === 'Completa');
    setDatos((d) => ({
      ...d,
      oportunidadesConsolidadas: consolidarTextos(fuente.map((e) => e.oportunidadesMejora)),
      recomendacionesConsolidadas: consolidarTextos(fuente.map((e) => e.recomendaciones)),
    }));
  };

  return (
    <Pila>
      <Encabezado
        titulo="Revisión final"
        subtitulo="Consolida resultados y envía una sola notificación cuando termine el levantamiento."
        extra={
          <Badge appearance="tint" size="large" color={editable ? 'informative' : 'brand'}>
            {textoEstado(verificacion, completas)}
          </Badge>
        }
      />
      <DosColumnas>
        <Pila>
          <Tarjeta titulo="Resumen de resultados">
            {(verificacion.estado === 'Aprobada' || verificacion.estado === 'Aprobada piloto') && (
              <SelloAprobacion
                verificacionId={verificacion.id}
                nivel={verificacion.estado === 'Aprobada' ? 'Productiva' : 'Piloto'}
                fecha={verificacion.fechaAprobacion}
              />
            )}
            <IndiceAdopcion
              indice={indice}
              etiqueta={editable ? 'Índice preliminar' : 'Índice de adopción'}
              variante="plano"
            />
            <ListaResumen>
              <LineaResumen etiqueta="Solución" valor={verificacion.solucionNombre} />
              <LineaResumen etiqueta="Verificación" valor={verificacion.codigo} />
              <LineaResumen
                etiqueta="Entrevistas completadas"
                valor={`${completas} de ${verificacion.entrevistasPrevistas}`}
              />
              <LineaResumen etiqueta="Evidencias" valor={textoEvidencias(resumen)} />
            </ListaResumen>
          </Tarjeta>
          <Tarjeta titulo="Oportunidades de mejora y recomendaciones">
            <Field label="Oportunidades de mejora consolidadas" hint="Una por línea. Precargadas desde las entrevistas completas.">
              <Textarea
                rows={5}
                resize="vertical"
                value={datos.oportunidadesConsolidadas}
                disabled={!editable}
                onChange={(_, d) => cambiar('oportunidadesConsolidadas', d.value)}
              />
            </Field>
            <Field label="Recomendaciones" hint="Una por línea.">
              <Textarea
                rows={4}
                resize="vertical"
                value={datos.recomendacionesConsolidadas}
                disabled={!editable}
                onChange={(_, d) => cambiar('recomendacionesConsolidadas', d.value)}
              />
            </Field>
            {editable && (
              <div>
                <Button appearance="subtle" icon={<ArrowSync24Regular />} onClick={() => void recargar()}>
                  Recargar desde las entrevistas
                </Button>
              </div>
            )}
          </Tarjeta>
        </Pila>
        <ControlEnvio
          verificacion={verificacion}
          completas={completas}
          puntajes={puntajes}
          datos={datos}
          onCambiar={cambiar}
        />
      </DosColumnas>
    </Pila>
  );
}
