import { getContext } from '@microsoft/power-apps/app';
import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../../.power/schemas/appschemas/dataSourcesInfo';
import type { IGetAllOptions, IGetOptions } from '../../generated/models/CommonModels';
import { SystemusersService } from '../../generated/services/SystemusersService';
import { Vu_aprobacionsService } from '../../generated/services/Vu_aprobacionsService';
import { Vu_areasService } from '../../generated/services/Vu_areasService';
import { Vu_criteriosService } from '../../generated/services/Vu_criteriosService';
import { Vu_documentosolucionsService } from '../../generated/services/Vu_documentosolucionsService';
import { Vu_entrevistasService } from '../../generated/services/Vu_entrevistasService';
import { Vu_evidenciasService } from '../../generated/services/Vu_evidenciasService';
import { Vu_opcionrespuestasService } from '../../generated/services/Vu_opcionrespuestasService';
import { Vu_preguntasService } from '../../generated/services/Vu_preguntasService';
import { Vu_puntajecriteriosService } from '../../generated/services/Vu_puntajecriteriosService';
import { Vu_respuestasService } from '../../generated/services/Vu_respuestasService';
import { Vu_solucionsService } from '../../generated/services/Vu_solucionsService';
import { Vu_verificacionsService } from '../../generated/services/Vu_verificacionsService';
import type { Id, Persona } from '../../domain/tipos';
import { ErrorValidacion } from '../errores';
import type { Cambios, Repositorios } from '../repositorios';
import {
  aprobacionDesdeFila,
  areaDesdeFila,
  criterioARegistro,
  criterioDesdeFila,
  documentoARegistro,
  documentoDesdeFila,
  entrevistaARegistro,
  entrevistaDesdeFila,
  evidenciaARegistro,
  evidenciaDesdeFila,
  opcionARegistro,
  opcionDesdeFila,
  personaDeUsuario,
  preguntaARegistro,
  preguntaDesdeFila,
  puntajeARegistro,
  puntajeDesdeFila,
  respuestaARegistro,
  respuestaDesdeFila,
  SELECT,
  sinBindsNulos,
  solucionARegistro,
  solucionDesdeFila,
  verificacionARegistro,
  verificacionDesdeFila,
} from './mapeadores';
import { CONJUNTOS, esGuid, filtroPorBusqueda, literal, type Conjunto, type Fila, type Registro } from './odata';

/**
 * Repositorios sobre los servicios generados por `pa app add data-source --connector dataverse`
 * (`src/generated/services/*`). Las llamadas pasan por el host de Power Apps: fuera de él
 * (p. ej. abriendo `http://localhost:3000` directamente) no hay datos; usa la URL "Local Play".
 *
 * - El SDK no admite `$expand`: los nombres de las búsquedas salen de la anotación
 *   `FormattedValue` (el SDK siempre pide `odata.include-annotations=*`) y los correos de las
 *   personas se completan con una consulta agrupada a `systemuser` (con caché).
 * - Tras crear o actualizar se vuelve a leer la fila con su `$select` para devolver el
 *   dominio completo (código autonumerado, nombres de búsquedas).
 */

// ---------------------------------------------------------------------------
// Acceso genérico a una tabla
// ---------------------------------------------------------------------------

interface ErrorOperacion {
  message?: string;
  status?: number;
}

interface Resultado<T> {
  success: boolean;
  data: T;
  error?: ErrorOperacion | Error;
  skipToken?: string;
}

/** Forma común de los servicios generados (métodos estáticos de cada `*Service`). */
interface ServicioGenerado {
  create(registro: Registro): Promise<Resultado<unknown>>;
  update(id: string, cambios: Registro): Promise<Resultado<unknown>>;
  get(id: string, opciones?: IGetOptions): Promise<Resultado<unknown>>;
  getAll(opciones?: IGetAllOptions): Promise<Resultado<unknown[]>>;
}

/** El `delete` generado descarta el resultado; se usa el cliente para poder informar errores. */
const cliente = getClient(dataSourcesInfo);

function mensaje(error: ErrorOperacion | Error | undefined): string {
  return error?.message?.trim() || 'error desconocido de Dataverse';
}

function comprobar<T>(r: Resultado<T>, accion: string): T {
  if (!r.success) throw new Error(`${accion}: ${mensaje(r.error)}`);
  return r.data;
}

function esNoEncontrado(error: ErrorOperacion | Error | undefined): boolean {
  if (!error) return false;
  if ('status' in error && error.status === 404) return true;
  return /does not exist|no existe|not found/i.test(error.message ?? '');
}

interface Tabla<T> {
  listar(opciones?: { filter?: string; orderBy?: string[] }): Promise<T[]>;
  obtener(id: Id): Promise<T | null>;
  crear(registro: Registro): Promise<T>;
  actualizar(id: Id, cambios: Registro): Promise<T>;
  eliminar(id: Id): Promise<void>;
}

function tabla<T>(
  nombre: string,
  conjunto: Conjunto,
  clave: string,
  servicio: ServicioGenerado,
  select: readonly string[],
  mapear: (f: Fila) => T,
): Tabla<T> {
  const obtener = async (id: Id): Promise<T | null> => {
    if (!esGuid(id)) return null;
    const r = await servicio.get(id, { select: [...select] });
    if (!r.success) {
      if (esNoEncontrado(r.error)) return null;
      throw new Error(`No se pudo leer ${nombre}: ${mensaje(r.error)}`);
    }
    return r.data ? mapear(r.data as Fila) : null;
  };
  const releer = async (id: Id, accion: string): Promise<T> => {
    const fila = await obtener(id);
    if (!fila) throw new Error(`${accion}: la fila ${id} no se pudo volver a leer.`);
    return fila;
  };
  return {
    // Paginación con skipToken (páginas de 500 filas).
    listar: async (opciones = {}) => {
      const filas: T[] = [];
      let skipToken: string | undefined;
      do {
        const r = await servicio.getAll({ select: [...select], ...opciones, skipToken });
        filas.push(...comprobar(r, `No se pudo consultar ${nombre}`).map((f) => mapear(f as Fila)));
        skipToken = r.skipToken;
      } while (skipToken);
      return filas;
    },
    obtener,
    crear: async (registro) => {
      const accion = `No se pudo crear ${nombre}`;
      const fila = comprobar(await servicio.create(sinBindsNulos(registro)), accion) as Fila | null;
      const id = fila?.[clave];
      if (typeof id !== 'string') throw new Error(`${accion}: Dataverse no devolvió el identificador.`);
      return releer(id, accion);
    },
    actualizar: async (id, cambios) => {
      const accion = `No se pudo actualizar ${nombre}`;
      if (Object.keys(cambios).length > 0) comprobar(await servicio.update(id, cambios), accion);
      return releer(id, accion);
    },
    eliminar: async (id) => {
      const r = await cliente.deleteRecordAsync(conjunto, id);
      if (!r.success) throw new ErrorValidacion([`No se pudo eliminar ${nombre}: ${mensaje(r.error)}`]);
    },
  };
}

// ---------------------------------------------------------------------------
// Personas (systemuser)
// ---------------------------------------------------------------------------

/** Tamaño máximo de `vu_evidencia.vu_archivo` (32 768 KB). */
export const TAMANO_MAXIMO_EVIDENCIA = 32 * 1024 * 1024;

/** Rol de seguridad de quienes pueden ser responsables de una verificación (§3.6). */
const ROL_RESPONSABLE = 'VU Responsable';

function crearDirectorioPersonas() {
  const cache = new Map<Id, Persona>();

  const consultarUsuarios = async (filter: string, top?: number): Promise<Persona[]> => {
    const r = await SystemusersService.getAll({ select: [...SELECT.usuario], filter, top, orderBy: ['fullname asc'] });
    const personas = comprobar(r, 'No se pudo consultar los usuarios').map((f) => personaDeUsuario(f as unknown as Fila));
    for (const p of personas) if (p.id) cache.set(p.id, p);
    return personas;
  };

  /** Completa nombre y correo de las personas que solo traen el `systemuserid`. */
  const completar = async (personas: (Persona | null | undefined)[]): Promise<void> => {
    const faltan = [...new Set(personas.filter((p): p is Persona => !!p?.id && !cache.has(p.id)).map((p) => p.id!))];
    for (let i = 0; i < faltan.length; i += 40) {
      const grupo = faltan.slice(i, i + 40).filter(esGuid);
      if (grupo.length > 0) await consultarUsuarios(grupo.map((id) => `systemuserid eq ${id}`).join(' or '));
    }
    for (const p of personas) {
      const conocida = p?.id ? cache.get(p.id) : undefined;
      if (p && conocida) {
        p.email = conocida.email;
        if (!p.nombre) p.nombre = conocida.nombre;
      }
    }
  };

  /** `systemuserid` de una persona (por id o por correo); null si no es usuario del entorno. */
  const resolverId = async (p: Persona): Promise<Id | null> => {
    if (p.id) return p.id;
    const email = p.email.trim();
    if (!email) return null;
    const [u] = await consultarUsuarios(
      `internalemailaddress eq ${literal(email)} or domainname eq ${literal(email)}`,
      1,
    );
    return u?.id ?? null;
  };

  /** Igual que `resolverId`, pero exige que la persona exista (búsquedas obligatorias a systemuser). */
  const conId = async (p: Persona | null | undefined): Promise<Persona | null | undefined> => {
    if (!p) return p;
    const id = await resolverId(p);
    if (!id) throw new ErrorValidacion([`${p.nombre || p.email} no es un usuario de este entorno de Power Platform.`]);
    return { ...p, id };
  };

  const usuarioActual = async (): Promise<Persona> => {
    const { user } = await getContext();
    const intentos: string[] = [];
    if (user.systemUserId && esGuid(user.systemUserId)) intentos.push(`systemuserid eq ${user.systemUserId}`);
    if (user.objectId && esGuid(user.objectId)) intentos.push(`azureactivedirectoryobjectid eq ${user.objectId}`);
    if (user.userPrincipalName) {
      const upn = literal(user.userPrincipalName);
      intentos.push(`domainname eq ${upn} or internalemailaddress eq ${upn}`);
    }
    for (const filtro of intentos) {
      const [u] = await consultarUsuarios(filtro, 1);
      if (u) return u;
    }
    // Sin fila de systemuser (no debería ocurrir en un entorno con Dataverse).
    const email = user.userPrincipalName ?? '';
    return { id: null, email, nombre: user.fullName || email };
  };

  // Usuarios humanos habilitados (accessmode 0 = lectura y escritura; excluye aplicaciones).
  const USUARIOS_HABILITADOS = 'isdisabled eq false and accessmode eq 0 and internalemailaddress ne null';

  const buscar = async (textoBuscado: string): Promise<Persona[]> => {
    const t = textoBuscado.trim().replace(/'/g, "''");
    const filtro = t
      ? `${USUARIOS_HABILITADOS} and (contains(fullname,'${t}') or contains(internalemailaddress,'${t}'))`
      : USUARIOS_HABILITADOS;
    // Sin texto: el selector carga el directorio una vez y filtra en el cliente.
    return consultarUsuarios(filtro, t ? 25 : 500);
  };

  /**
   * Por nombre de rol: hay una copia del rol por unidad de negocio. Incluye el rol heredado de
   * un equipo (`teamroles_association`), que es como se suele asignar en producción.
   */
  const responsables = async (): Promise<Persona[]> => {
    const rol = `r:r/name eq ${literal(ROL_RESPONSABLE)}`;
    const filtro =
      `${USUARIOS_HABILITADOS} and (systemuserroles_association/any(${rol})` +
      ` or teammembership_association/any(t:t/teamroles_association/any(${rol})))`;
    return consultarUsuarios(filtro, 500);
  };

  return { completar, resolverId, conId, usuarioActual, buscar, responsables };
}

// ---------------------------------------------------------------------------
// Repositorios
// ---------------------------------------------------------------------------

/** Ordena por una clave texto (localeCompare en español). */
const porTitulo = (a: { titulo: string }, b: { titulo: string }) => a.titulo.localeCompare(b.titulo, 'es');

export function crearRepositoriosDataverse(): Repositorios {
  const personas = crearDirectorioPersonas();

  const areas = tabla('el área', CONJUNTOS.area, 'vu_areaid', Vu_areasService, SELECT.area, areaDesdeFila);
  const soluciones = tabla('la solución', CONJUNTOS.solucion, 'vu_solucionid', Vu_solucionsService, SELECT.solucion, solucionDesdeFila);
  const documentos = tabla(
    'el documento',
    CONJUNTOS.documento,
    'vu_documentosolucionid',
    Vu_documentosolucionsService,
    SELECT.documento,
    documentoDesdeFila,
  );
  const criterios = tabla('el criterio', CONJUNTOS.criterio, 'vu_criterioid', Vu_criteriosService, SELECT.criterio, criterioDesdeFila);
  const preguntas = tabla('la pregunta', CONJUNTOS.pregunta, 'vu_preguntaid', Vu_preguntasService, SELECT.pregunta, preguntaDesdeFila);
  const opciones = tabla(
    'la opción',
    CONJUNTOS.opcion,
    'vu_opcionrespuestaid',
    Vu_opcionrespuestasService,
    SELECT.opcion,
    opcionDesdeFila,
  );
  const verificaciones = tabla(
    'la verificación',
    CONJUNTOS.verificacion,
    'vu_verificacionid',
    Vu_verificacionsService,
    SELECT.verificacion,
    verificacionDesdeFila,
  );
  const entrevistas = tabla(
    'la entrevista',
    CONJUNTOS.entrevista,
    'vu_entrevistaid',
    Vu_entrevistasService,
    SELECT.entrevista,
    entrevistaDesdeFila,
  );
  const respuestas = tabla('la respuesta', CONJUNTOS.respuesta, 'vu_respuestaid', Vu_respuestasService, SELECT.respuesta, respuestaDesdeFila);
  const evidencias = tabla('la evidencia', CONJUNTOS.evidencia, 'vu_evidenciaid', Vu_evidenciasService, SELECT.evidencia, evidenciaDesdeFila);
  const puntajes = tabla(
    'el puntaje',
    CONJUNTOS.puntaje,
    'vu_puntajecriterioid',
    Vu_puntajecriteriosService,
    SELECT.puntaje,
    puntajeDesdeFila,
  );
  const aprobaciones = tabla(
    'la aprobación',
    CONJUNTOS.aprobacion,
    'vu_aprobacionid',
    Vu_aprobacionsService,
    SELECT.aprobacion,
    aprobacionDesdeFila,
  );

  // --- Personas en las filas leídas -----------------------------------------
  const conPersonasSolucion = async <T extends { responsable: Persona | null } | null>(x: T): Promise<T> => {
    if (x) await personas.completar([x.responsable]);
    return x;
  };
  const conPersonasSoluciones = async <T extends { responsable: Persona | null }>(xs: T[]): Promise<T[]> => {
    await personas.completar(xs.map((x) => x.responsable));
    return xs;
  };
  type ConPersonasVerificacion = { responsable: Persona | null; aprobadorPiloto: Persona | null; aprobadorProductivo: Persona | null };
  const conPersonasVerificaciones = async <T extends ConPersonasVerificacion>(xs: T[]): Promise<T[]> => {
    await personas.completar(xs.flatMap((x) => [x.responsable, x.aprobadorPiloto, x.aprobadorProductivo]));
    return xs;
  };
  const conPersonasVerificacion = async <T extends ConPersonasVerificacion | null>(x: T): Promise<T> => {
    if (x) await conPersonasVerificaciones([x]);
    return x;
  };

  /** Asegura el `systemuserid` de las personas que se escriben como búsqueda obligatoria. */
  const resolverPersonasVerificacion = async <C extends Cambios<ConPersonasVerificacion>>(c: C): Promise<C> => ({
    ...c,
    responsable: await personas.conId(c.responsable),
    aprobadorPiloto: await personas.conId(c.aprobadorPiloto),
    aprobadorProductivo: await personas.conId(c.aprobadorProductivo),
  });
  /** El entrevistado puede no ser usuario del entorno: solo se intenta resolver su id. */
  const resolverEntrevistado = async <C extends { entrevistado?: Persona | null }>(c: C): Promise<C> => {
    if (!c.entrevistado || c.entrevistado.id) return c;
    return { ...c, entrevistado: { ...c.entrevistado, id: await personas.resolverId(c.entrevistado) } };
  };

  const porVerificacion = (verificacionId: Id) => filtroPorBusqueda('vu_verificacionid', verificacionId);

  return {
    soluciones: {
      listar: async () => conPersonasSoluciones(await soluciones.listar({ orderBy: ['vu_name asc'] })),
      obtener: async (id) => conPersonasSolucion(await soluciones.obtener(id)),
      // El responsable es opcional (catálogo importado sin responsables); null = sin asignar.
      crear: async (datos) => {
        const responsable = (await personas.conId(datos.responsable)) ?? null;
        return conPersonasSolucion(await soluciones.crear(solucionARegistro({ ...datos, responsable }, true)));
      },
      actualizar: async (id, cambios) => {
        const registro = solucionARegistro({ ...cambios, responsable: await personas.conId(cambios.responsable) });
        return conPersonasSolucion(await soluciones.actualizar(id, registro));
      },
      // Restrict: Dataverse rechaza el borrado si hay verificaciones; los documentos van en cascada.
      eliminar: (id) => soluciones.eliminar(id),
      listarDocumentos: (solucionId) =>
        documentos.listar({ filter: filtroPorBusqueda('vu_solucionid', solucionId), orderBy: ['vu_name asc'] }),
      crearDocumento: (datos) => documentos.crear(documentoARegistro(datos)),
      actualizarDocumento: (id, cambios) => documentos.actualizar(id, documentoARegistro(cambios)),
      eliminarDocumento: (id) => documentos.eliminar(id),
    },

    verificaciones: {
      listar: async (filtro) =>
        conPersonasVerificaciones(
          await verificaciones.listar({
            filter: filtro?.solucionId ? filtroPorBusqueda('vu_solucionid', filtro.solucionId) : undefined,
            orderBy: ['vu_name desc'],
          }),
        ),
      obtener: async (id) => conPersonasVerificacion(await verificaciones.obtener(id)),
      // El código (vu_name) lo asigna la autonumeración: no se envía.
      crear: async (datos) =>
        conPersonasVerificacion(await verificaciones.crear(verificacionARegistro(await resolverPersonasVerificacion(datos), true))),
      actualizar: async (id, cambios) =>
        conPersonasVerificacion(await verificaciones.actualizar(id, verificacionARegistro(await resolverPersonasVerificacion(cambios)))),
    },

    entrevistas: {
      listarPorVerificacion: (verificacionId) =>
        entrevistas.listar({ filter: porVerificacion(verificacionId), orderBy: ['vu_numero asc'] }),
      obtener: (id) => entrevistas.obtener(id),
      crear: async (datos) => entrevistas.crear(entrevistaARegistro(await resolverEntrevistado(datos))),
      actualizar: async (id, cambios) => entrevistas.actualizar(id, entrevistaARegistro(await resolverEntrevistado(cambios))),
      // Parental: respuestas y evidencias se borran en cascada.
      eliminar: (id) => entrevistas.eliminar(id),
    },

    respuestas: {
      listarPorVerificacion: (verificacionId) =>
        respuestas.listar({ filter: porVerificacion(verificacionId), orderBy: ['vu_orden asc'] }),
      listarPorEntrevista: (entrevistaId) =>
        respuestas.listar({ filter: filtroPorBusqueda('vu_entrevistaid', entrevistaId), orderBy: ['vu_orden asc'] }),
      crear: (datos) => respuestas.crear(respuestaARegistro(datos)),
      actualizar: (id, cambios) => respuestas.actualizar(id, respuestaARegistro(cambios)),
      eliminar: (id) => respuestas.eliminar(id),
    },

    puntajes: {
      listarPorVerificacion: (verificacionId) => puntajes.listar({ filter: porVerificacion(verificacionId) }),
      // La clave alternativa vu_ak_verificacion_criterio rechaza duplicados.
      crear: (datos) => puntajes.crear(puntajeARegistro(datos)),
      actualizar: (id, cambios) => puntajes.actualizar(id, puntajeARegistro(cambios)),
    },

    evidencias: {
      listarPorVerificacion: (verificacionId) =>
        evidencias.listar({ filter: porVerificacion(verificacionId), orderBy: ['createdon asc'] }),
      subir: async (datos) => {
        if (datos.archivo.size > TAMANO_MAXIMO_EVIDENCIA) {
          throw new ErrorValidacion([`"${datos.archivo.name}" supera el máximo de 32 MB por evidencia.`]);
        }
        // 1) Fila con los metadatos; 2) archivo en la columna vu_archivo. Si falla la subida se
        // borra la fila para no dejar evidencias sin archivo (vu_archivo es obligatorio).
        const fila = await evidencias.crear(
          evidenciaARegistro({
            nombreArchivo: datos.archivo.name.slice(0, 200),
            verificacionId: datos.verificacionId,
            entrevistaId: datos.entrevistaId,
            respuestaId: datos.respuestaId,
            tipo: datos.tipo,
          }),
        );
        const r = await Vu_evidenciasService.upload(fila.id, 'vu_archivo', datos.archivo);
        if (!r.success) {
          await evidencias.eliminar(fila.id).catch(() => undefined);
          throw new Error(`No se pudo subir "${datos.archivo.name}": ${mensaje(r.error)}`);
        }
        return fila;
      },
      descargar: async (id) => {
        const r = await Vu_evidenciasService.downloadFile(id, 'vu_archivo');
        if (!r.success) {
          if (esNoEncontrado(r.error)) return null;
          throw new Error(`No se pudo descargar la evidencia: ${mensaje(r.error)}`);
        }
        return r.data ? new Blob([new Uint8Array(r.data)]) : null;
      },
      actualizar: (id, cambios) => evidencias.actualizar(id, evidenciaARegistro(cambios)),
      eliminar: (id) => evidencias.eliminar(id),
    },

    catalogo: {
      listarAreas: async () => (await areas.listar({ orderBy: ['vu_name asc'] })).sort(porTitulo),
      listarCriterios: () => criterios.listar({ orderBy: ['vu_orden asc'] }),
      crearCriterio: (datos) => criterios.crear(criterioARegistro(datos)),
      actualizarCriterio: (id, cambios) => criterios.actualizar(id, criterioARegistro(cambios)),
      eliminarCriterio: (id) => criterios.eliminar(id),
      listarPreguntas: () => preguntas.listar({ orderBy: ['vu_orden asc'] }),
      crearPregunta: (datos) => preguntas.crear(preguntaARegistro(datos)),
      actualizarPregunta: (id, cambios) => preguntas.actualizar(id, preguntaARegistro(cambios)),
      eliminarPregunta: (id) => preguntas.eliminar(id),
      listarOpciones: () => opciones.listar({ orderBy: ['vu_orden asc'] }),
      crearOpcion: (datos) => opciones.crear(opcionARegistro(datos)),
      actualizarOpcion: (id, cambios) => opciones.actualizar(id, opcionARegistro(cambios)),
      eliminarOpcion: (id) => opciones.eliminar(id),
    },

    aprobaciones: {
      listarPorVerificacion: async (verificacionId) => {
        const lista = await aprobaciones.listar({ filter: porVerificacion(verificacionId), orderBy: ['vu_fechasolicitud asc'] });
        await personas.completar(lista.map((a) => a.aprobador));
        return lista;
      },
    },

    directorio: {
      usuarioActual: () => personas.usuarioActual(),
      buscarPersonas: (texto) => personas.buscar(texto),
      listarResponsables: () => personas.responsables(),
    },
  };
}
