import { getContext } from '@microsoft/power-apps/app';
import type { Persona } from '../../domain/tipos';
import type { Repositorios } from '../repositorios';
import { LISTAS } from './listas';

/**
 * Repositorios contra SharePoint Online — ESQUELETO.
 *
 * Las listas aún no existen, así que no se han generado los servicios. Cuando estén
 * aprovisionadas (`infra/sharepoint/`), por cada lista:
 *
 *   npx --no-install pa app add data-source --connector shared_sharepointonline \
 *     --connection-id <id> --dataset https://biomont.sharepoint.com/sites/VerificacionUso \
 *     --table VU_Verificaciones --table VU_Entrevistas ... --as table
 *
 * (equivale a `pac code add-data-source -a shared_sharepointonline -c <id> -d <sitio> -t <lista>`), lo que crea
 * `src/generated/services/VU_VerificacionesService.ts` y su modelo. Luego se reemplaza cada
 * `pendiente(...)` por la llamada al servicio + el mapeador de `./mapeadores`. Ejemplo:
 *
 *   import { VU_VerificacionesService } from '../../generated/services/VU_VerificacionesService';
 *
 *   obtener: async (id) => {
 *     const r = await VU_VerificacionesService.get(String(id), { select: [...SELECT.verificaciones] });
 *     if (!r.success) throw r.error ?? new Error('Error al leer VU_Verificaciones');
 *     return r.data ? mapearVerificacion(r.data as SPVerificacion) : null;
 *   },
 *   listar: async (filtro) => {
 *     const r = await VU_VerificacionesService.getAll({
 *       filter: filtro?.solucionId ? filtroPorBusqueda('Solucion', filtro.solucionId) : undefined,
 *       orderBy: ['ID desc'],
 *     });
 *     return (r.data ?? []).map((i) => mapearVerificacion(i as SPVerificacion));
 *   },
 *   actualizar: async (id, cambios) => {
 *     const r = await VU_VerificacionesService.update(String(id), verificacionASP(cambios));
 *     return mapearVerificacion(r.data as SPVerificacion);
 *   },
 *
 * Paginación: `getAll` devuelve `skipToken`; las listas con más de 5 000 elementos
 * (VU_Respuestas) SIEMPRE se consultan filtrando por una columna indexada.
 */

const CONECTOR_USUARIOS = 'Office 365 Users (shared_office365users)';

function pendiente(origen: string): never {
  throw new Error(`TODO: conectar servicio generado por pac code add-data-source para ${origen}`);
}

/** Cada operación devuelve una promesa rechazada hasta que se conecte el servicio generado. */
function sinConectar(origen: string) {
  return async (): Promise<never> => pendiente(origen);
}

export function crearRepositoriosSharePoint(): Repositorios {
  return {
    soluciones: {
      listar: sinConectar(LISTAS.soluciones),
      obtener: sinConectar(LISTAS.soluciones),
      crear: sinConectar(LISTAS.soluciones),
      actualizar: sinConectar(LISTAS.soluciones),
      eliminar: sinConectar(LISTAS.soluciones),
      listarDocumentos: sinConectar(LISTAS.documentos),
      crearDocumento: sinConectar(LISTAS.documentos),
      actualizarDocumento: sinConectar(LISTAS.documentos),
      eliminarDocumento: sinConectar(LISTAS.documentos),
    },
    verificaciones: {
      listar: sinConectar(LISTAS.verificaciones),
      obtener: sinConectar(LISTAS.verificaciones),
      crear: sinConectar(LISTAS.verificaciones),
      actualizar: sinConectar(LISTAS.verificaciones),
    },
    entrevistas: {
      listarPorVerificacion: sinConectar(LISTAS.entrevistas),
      obtener: sinConectar(LISTAS.entrevistas),
      crear: sinConectar(LISTAS.entrevistas),
      actualizar: sinConectar(LISTAS.entrevistas),
      eliminar: sinConectar(LISTAS.entrevistas),
    },
    respuestas: {
      listarPorVerificacion: sinConectar(LISTAS.respuestas),
      listarPorEntrevista: sinConectar(LISTAS.respuestas),
      crear: sinConectar(LISTAS.respuestas),
      actualizar: sinConectar(LISTAS.respuestas),
      eliminar: sinConectar(LISTAS.respuestas),
    },
    puntajes: {
      listarPorVerificacion: sinConectar(LISTAS.puntajes),
      crear: sinConectar(LISTAS.puntajes),
      actualizar: sinConectar(LISTAS.puntajes),
    },
    evidencias: {
      listarPorVerificacion: sinConectar(LISTAS.evidencias),
      // Subida: operación de creación de archivo del conector en la carpeta
      // `carpetaEvidencias(codigo, numero)` y después actualizar sus metadatos con `evidenciaASP`.
      subir: sinConectar(LISTAS.evidencias),
      actualizar: sinConectar(LISTAS.evidencias),
      eliminar: sinConectar(LISTAS.evidencias),
    },
    catalogo: {
      listarAreas: sinConectar(LISTAS.areas),
      listarCriterios: sinConectar(LISTAS.criterios),
      crearCriterio: sinConectar(LISTAS.criterios),
      actualizarCriterio: sinConectar(LISTAS.criterios),
      eliminarCriterio: sinConectar(LISTAS.criterios),
      listarPreguntas: sinConectar(LISTAS.preguntas),
      crearPregunta: sinConectar(LISTAS.preguntas),
      actualizarPregunta: sinConectar(LISTAS.preguntas),
      eliminarPregunta: sinConectar(LISTAS.preguntas),
      listarOpciones: sinConectar(LISTAS.opciones),
      crearOpcion: sinConectar(LISTAS.opciones),
      actualizarOpcion: sinConectar(LISTAS.opciones),
      eliminarOpcion: sinConectar(LISTAS.opciones),
    },
    aprobaciones: {
      listarPorVerificacion: sinConectar(LISTAS.aprobaciones),
    },
    directorio: {
      // El usuario actual sí está disponible: lo expone el host de Power Apps.
      usuarioActual: async (): Promise<Persona> => {
        const { user } = await getContext();
        const email = user.userPrincipalName ?? '';
        return { email, nombre: user.fullName || email };
      },
      buscarPersonas: sinConectar(CONECTOR_USUARIOS),
    },
  };
}
