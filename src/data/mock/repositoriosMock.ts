import { compararCodigoDesc, formatearCodigoVU, tituloAprobacion } from '../../domain/codigo';
import { ahoraISO, hoyISO } from '../../domain/fechas';
import { estadoSolucion } from '../../domain/flujo';
import type { Aprobacion, Id, Verificacion } from '../../domain/tipos';
import { ErrorValidacion } from '../errores';
import type { Repositorios } from '../repositorios';
import { crearSemilla, type Semilla } from './semilla';
import { crearTabla } from './tabla';

export interface OpcionesMock {
  /** Latencia simulada por operación (ms). 0 en pruebas. */
  latenciaMs?: number;
  semilla?: Semilla;
}

/**
 * Repositorios en memoria sembrados con los datos del prototipo.
 *
 * Además de imitar Dataverse (relaciones con cascada / restringir eliminación y la
 * autonumeración `VU-{SEQNUM:5}` del código de la verificación),
 * simula de forma mínima los flujos de Power Automate para que la demo sea coherente:
 * - F3: recalcula `EstadoVU` y `UltimaVerificacionId` de la solución al cambiar una verificación.
 * - F2: al pasar a "En revisión" crea la aprobación de nivel Piloto en estado Pendiente.
 * En producción esto lo hacen los flujos; la app nunca escribe esos campos.
 */
export function crearRepositoriosMock(opciones: OpcionesMock = {}): Repositorios {
  const latencia = opciones.latenciaMs ?? 120;
  const s = opciones.semilla ?? crearSemilla();

  const areas = crearTabla('el área', s.areas);
  const soluciones = crearTabla('la solución', s.soluciones);
  const documentos = crearTabla('el documento', s.documentos);
  const criterios = crearTabla('el criterio', s.criterios);
  const preguntas = crearTabla('la pregunta', s.preguntas);
  const opcionesRespuesta = crearTabla('la opción', s.opciones);
  const verificaciones = crearTabla('la verificación', s.verificaciones);
  const entrevistas = crearTabla('la entrevista', s.entrevistas);
  const respuestas = crearTabla('la respuesta', s.respuestas);
  const puntajes = crearTabla('el puntaje', s.puntajes);
  const evidencias = crearTabla('la evidencia', s.evidencias);
  const aprobaciones = crearTabla('la aprobación', s.aprobaciones);
  const historialPuntajes = crearTabla('el cambio de puntaje', s.historialPuntajes);
  const personas = s.personas.map((p) => ({ ...p }));

  const esperar = () => (latencia > 0 ? new Promise<void>((r) => setTimeout(r, latencia)) : Promise.resolve());

  /** Envuelve una operación síncrona con la latencia simulada. */
  const op =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    async (...args: A): Promise<R> => {
      await esperar();
      return fn(...args);
    };

  const restringir = (condicion: boolean, mensaje: string) => {
    if (condicion) throw new ErrorValidacion([mensaje]);
  };

  // --- Simulación de flujos -------------------------------------------------

  const simularF3 = (solucionId: Id) => {
    const solucion = soluciones.buscar(solucionId);
    if (!solucion) return;
    const relevantes = verificaciones
      .donde((v) => v.solucionId === solucionId && v.estado !== 'Borrador' && v.estado !== 'Cancelada')
      .sort(compararCodigoDesc);
    const ultima = relevantes[0];
    if (!ultima) return; // sin verificaciones relevantes se conserva el valor histórico
    soluciones.actualizar(solucionId, {
      estadoVU: estadoSolucion(ultima, solucion.proximaVU, hoyISO()),
      ultimaVerificacionId: ultima.id,
    });
  };

  const simularF2 = (v: Verificacion) => {
    if (v.estado !== 'En revisión' || !v.aprobadorPiloto) return;
    const existe = aprobaciones.donde(
      (a) => a.verificacionId === v.id && a.nivel === 'Piloto' && a.decision === 'Pendiente',
    );
    if (existe.length > 0) return;
    const nueva: Omit<Aprobacion, 'id'> = {
      titulo: tituloAprobacion(v.codigo, 'Piloto'),
      verificacionId: v.id,
      nivel: 'Piloto',
      aprobador: v.aprobadorPiloto,
      decision: 'Pendiente',
      comentario: '',
      fechaSolicitud: ahoraISO(),
      fechaDecision: null,
      approvalId: null,
    };
    aprobaciones.insertar(nueva);
  };

  const trasCambioVerificacion = (v: Verificacion) => {
    simularF2(v);
    simularF3(v.solucionId);
    return verificaciones.obtener(v.id);
  };

  const nombreArea = (id: Id) => areas.buscar(id)?.titulo ?? '';
  const nombreSolucion = (id: Id) => soluciones.buscar(id)?.titulo ?? '';

  return {
    soluciones: {
      listar: op(() => soluciones.todos()),
      obtener: op((id: Id) => soluciones.buscar(id)),
      crear: op((datos) => soluciones.insertar({ ...datos, procesoNombre: nombreArea(datos.procesoId) })),
      actualizar: op((id, cambios) => {
        const extra = cambios.procesoId !== undefined ? { procesoNombre: nombreArea(cambios.procesoId) } : {};
        return soluciones.actualizar(id, { ...cambios, ...extra });
      }),
      eliminar: op((id: Id) => {
        restringir(
          verificaciones.donde((v) => v.solucionId === id).length > 0,
          'No se puede eliminar la solución: tiene verificaciones registradas.',
        );
        documentos.eliminarDonde((d) => d.solucionId === id);
        soluciones.eliminar(id);
      }),
      listarDocumentos: op((solucionId: Id) => documentos.donde((d) => d.solucionId === solucionId)),
      crearDocumento: op((datos) => documentos.insertar(datos)),
      actualizarDocumento: op((id, cambios) => documentos.actualizar(id, cambios)),
      eliminarDocumento: op((id: Id) => documentos.eliminar(id)),
    },

    verificaciones: {
      listar: op((filtro) =>
        verificaciones.donde((v) => filtro?.solucionId === undefined || v.solucionId === filtro.solucionId),
      ),
      obtener: op((id: Id) => verificaciones.buscar(id)),
      crear: op((datos) => {
        const nueva = verificaciones.insertar({ ...datos, solucionNombre: nombreSolucion(datos.solucionId) });
        // Autonumeración: el código lo pone el "servidor", no la app.
        return trasCambioVerificacion(
          verificaciones.actualizar(nueva.id, { codigo: formatearCodigoVU(Number(nueva.id)) }),
        );
      }),
      actualizar: op((id, cambios) => {
        const extra =
          cambios.solucionId !== undefined ? { solucionNombre: nombreSolucion(cambios.solucionId) } : {};
        return trasCambioVerificacion(verificaciones.actualizar(id, { ...cambios, ...extra }));
      }),
    },

    entrevistas: {
      listarPorVerificacion: op((verificacionId: Id) =>
        entrevistas.donde((e) => e.verificacionId === verificacionId).sort((a, b) => a.numero - b.numero),
      ),
      obtener: op((id: Id) => entrevistas.buscar(id)),
      crear: op((datos) =>
        entrevistas.insertar({ ...datos, areaNombre: datos.areaId ? nombreArea(datos.areaId) : null }),
      ),
      actualizar: op((id, cambios) => {
        const extra =
          cambios.areaId !== undefined ? { areaNombre: cambios.areaId ? nombreArea(cambios.areaId) : null } : {};
        return entrevistas.actualizar(id, { ...cambios, ...extra });
      }),
      eliminar: op((id: Id) => {
        const ids = new Set(respuestas.donde((r) => r.entrevistaId === id).map((r) => r.id));
        respuestas.eliminarDonde((r) => r.entrevistaId === id);
        // Parental: las evidencias de la entrevista se borran; RemoveLink: se desvinculan de sus respuestas.
        evidencias.eliminarDonde((x) => x.entrevistaId === id);
        for (const e of evidencias.donde((x) => x.respuestaId !== null && ids.has(x.respuestaId))) {
          evidencias.actualizar(e.id, { respuestaId: null });
        }
        entrevistas.eliminar(id);
      }),
    },

    respuestas: {
      listarPorVerificacion: op((verificacionId: Id) =>
        respuestas.donde((r) => r.verificacionId === verificacionId).sort((a, b) => a.orden - b.orden),
      ),
      listarPorEntrevista: op((entrevistaId: Id) =>
        respuestas.donde((r) => r.entrevistaId === entrevistaId).sort((a, b) => a.orden - b.orden),
      ),
      crear: op((datos) => respuestas.insertar(datos)),
      actualizar: op((id, cambios) => respuestas.actualizar(id, cambios)),
      eliminar: op((id: Id) => {
        for (const e of evidencias.donde((x) => x.respuestaId === id)) {
          evidencias.actualizar(e.id, { respuestaId: null });
        }
        respuestas.eliminar(id);
      }),
    },

    puntajes: {
      listarPorVerificacion: op((verificacionId: Id) => puntajes.donde((p) => p.verificacionId === verificacionId)),
      crear: op((datos) => {
        restringir(
          puntajes.donde((p) => p.verificacionId === datos.verificacionId && p.criterioId === datos.criterioId)
            .length > 0,
          `Ya existe el puntaje de ${datos.titulo} para esta verificación.`,
        );
        return puntajes.insertar(datos);
      }),
      actualizar: op((id, cambios) => puntajes.actualizar(id, cambios)),
    },

    evidencias: {
      listarPorVerificacion: op((verificacionId: Id) =>
        evidencias.donde((e) => e.verificacionId === verificacionId),
      ),
      // En modo mock solo se guarda el nombre del archivo.
      subir: op((datos) =>
        evidencias.insertar({
          nombreArchivo: datos.archivo.name,
          url: null,
          verificacionId: datos.verificacionId,
          entrevistaId: datos.entrevistaId,
          respuestaId: datos.respuestaId,
          tipo: datos.tipo,
        }),
      ),
      descargar: op((): Blob | null => null),
      actualizar: op((id, cambios) => evidencias.actualizar(id, cambios)),
      eliminar: op((id: Id) => evidencias.eliminar(id)),
    },

    catalogo: {
      listarAreas: op(() => areas.todos()),
      listarCriterios: op(() => criterios.todos().sort((a, b) => a.orden - b.orden)),
      crearCriterio: op((datos) => criterios.insertar(datos)),
      actualizarCriterio: op((id, cambios) => criterios.actualizar(id, cambios)),
      eliminarCriterio: op((id: Id) => {
        restringir(
          preguntas.donde((p) => p.criterioId === id).length > 0 ||
            respuestas.donde((r) => r.criterioId === id).length > 0 ||
            puntajes.donde((p) => p.criterioId === id).length > 0,
          'No se puede eliminar el criterio: está en uso. Desactívalo en su lugar.',
        );
        criterios.eliminar(id);
      }),
      listarPreguntas: op(() => preguntas.todos().sort((a, b) => a.orden - b.orden)),
      crearPregunta: op((datos) => preguntas.insertar(datos)),
      actualizarPregunta: op((id, cambios) => preguntas.actualizar(id, cambios)),
      eliminarPregunta: op((id: Id) => {
        restringir(
          respuestas.donde((r) => r.preguntaId === id).length > 0,
          'No se puede eliminar la pregunta: tiene respuestas registradas. Desactívala en su lugar.',
        );
        opcionesRespuesta.eliminarDonde((o) => o.preguntaId === id);
        preguntas.eliminar(id);
      }),
      listarOpciones: op(() => opcionesRespuesta.todos().sort((a, b) => a.orden - b.orden)),
      crearOpcion: op((datos) => opcionesRespuesta.insertar(datos)),
      actualizarOpcion: op((id, cambios) => opcionesRespuesta.actualizar(id, cambios)),
      eliminarOpcion: op((id: Id) => {
        restringir(
          respuestas.donde((r) => r.opcionId === id).length > 0,
          'No se puede eliminar la opción: hay respuestas que la usan.',
        );
        opcionesRespuesta.eliminar(id);
      }),
    },

    aprobaciones: {
      listarPorVerificacion: op((verificacionId: Id) =>
        aprobaciones.donde((a) => a.verificacionId === verificacionId),
      ),
    },

    historialPuntajes: {
      listarPorVerificacion: op((verificacionId: Id) =>
        historialPuntajes
          .donde((c) => c.verificacionId === verificacionId)
          .sort((a, b) => b.fecha.localeCompare(a.fecha) || Number(b.id) - Number(a.id)),
      ),
      // Como Dataverse: el autor (createdby) y la fecha (modifiedon) los pone el servidor.
      crear: op((datos) => historialPuntajes.insertar({ ...datos, autor: { ...s.usuarioActual }, fecha: ahoraISO() })),
      actualizar: op((id, cambios) => historialPuntajes.actualizar(id, { ...cambios, fecha: ahoraISO() })),
    },

    directorio: {
      usuarioActual: op(() => ({ ...s.usuarioActual })),
      buscarPersonas: op((texto: string) => {
        const t = texto.trim().toLocaleLowerCase('es');
        return personas.filter(
          (p) => !t || p.nombre.toLocaleLowerCase('es').includes(t) || p.email.toLocaleLowerCase().includes(t),
        );
      }),
      // El directorio de ejemplo no tiene roles: todas las personas pueden ser responsables.
      listarResponsables: op(() => personas.map((p) => ({ ...p }))),
    },
  };
}
