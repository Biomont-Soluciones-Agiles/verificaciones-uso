import type {
  Aprobacion,
  Area,
  Criterio,
  Documento,
  Entrevista,
  Evidencia,
  Id,
  OpcionRespuesta,
  Persona,
  Pregunta,
  PuntajeCriterio,
  Respuesta,
  Solucion,
  TipoEvidencia,
  Verificacion,
} from '../domain/tipos';

/**
 * Contratos de acceso a datos por agregado. Las pantallas y los servicios de aplicación
 * solo conocen estos contratos y los tipos de dominio; las implementaciones viven en
 * `mock/` (en memoria) y `dataverse/` (servicios generados por `pa app add data-source`).
 */

export type SinId<T> = Omit<T, 'id'>;
export type Cambios<T> = Partial<Omit<T, 'id'>>;

export interface SolucionesRepo {
  listar(): Promise<Solucion[]>;
  obtener(id: Id): Promise<Solucion | null>;
  crear(datos: SinId<Solucion>): Promise<Solucion>;
  actualizar(id: Id, cambios: Cambios<Solucion>): Promise<Solucion>;
  /** Restringido si la solución tiene verificaciones; los documentos se borran en cascada. */
  eliminar(id: Id): Promise<void>;
  listarDocumentos(solucionId: Id): Promise<Documento[]>;
  crearDocumento(datos: SinId<Documento>): Promise<Documento>;
  actualizarDocumento(id: Id, cambios: Cambios<Documento>): Promise<Documento>;
  eliminarDocumento(id: Id): Promise<void>;
}

export interface FiltroVerificaciones {
  solucionId?: Id;
}

export interface VerificacionesRepo {
  listar(filtro?: FiltroVerificaciones): Promise<Verificacion[]>;
  obtener(id: Id): Promise<Verificacion | null>;
  crear(datos: SinId<Verificacion>): Promise<Verificacion>;
  actualizar(id: Id, cambios: Cambios<Verificacion>): Promise<Verificacion>;
}

export interface EntrevistasRepo {
  listarPorVerificacion(verificacionId: Id): Promise<Entrevista[]>;
  obtener(id: Id): Promise<Entrevista | null>;
  crear(datos: SinId<Entrevista>): Promise<Entrevista>;
  actualizar(id: Id, cambios: Cambios<Entrevista>): Promise<Entrevista>;
  /** Las respuestas se borran en cascada. */
  eliminar(id: Id): Promise<void>;
}

export interface RespuestasRepo {
  /** Filtra por la búsqueda desnormalizada `vu_verificacionid`. */
  listarPorVerificacion(verificacionId: Id): Promise<Respuesta[]>;
  listarPorEntrevista(entrevistaId: Id): Promise<Respuesta[]>;
  crear(datos: SinId<Respuesta>): Promise<Respuesta>;
  actualizar(id: Id, cambios: Cambios<Respuesta>): Promise<Respuesta>;
  eliminar(id: Id): Promise<void>;
}

export interface PuntajesRepo {
  listarPorVerificacion(verificacionId: Id): Promise<PuntajeCriterio[]>;
  crear(datos: SinId<PuntajeCriterio>): Promise<PuntajeCriterio>;
  actualizar(id: Id, cambios: Cambios<PuntajeCriterio>): Promise<PuntajeCriterio>;
}

export interface NuevaEvidencia {
  verificacionId: Id;
  entrevistaId: Id;
  respuestaId: Id | null;
  tipo: TipoEvidencia;
  archivo: File;
}

export interface EvidenciasRepo {
  listarPorVerificacion(verificacionId: Id): Promise<Evidencia[]>;
  /** Crea la fila `vu_evidencia` y sube el archivo a su columna `vu_archivo` (máx. 32 MB). */
  subir(datos: NuevaEvidencia): Promise<Evidencia>;
  /** Contenido del archivo (null si no tiene o en modo mock). */
  descargar(id: Id): Promise<Blob | null>;
  actualizar(id: Id, cambios: Pick<Cambios<Evidencia>, 'respuestaId' | 'tipo'>): Promise<Evidencia>;
  eliminar(id: Id): Promise<void>;
}

export interface CatalogoRepo {
  listarAreas(): Promise<Area[]>;
  listarCriterios(): Promise<Criterio[]>;
  crearCriterio(datos: SinId<Criterio>): Promise<Criterio>;
  actualizarCriterio(id: Id, cambios: Cambios<Criterio>): Promise<Criterio>;
  /** Restringido si hay preguntas, respuestas o puntajes que lo usan. */
  eliminarCriterio(id: Id): Promise<void>;
  listarPreguntas(): Promise<Pregunta[]>;
  crearPregunta(datos: SinId<Pregunta>): Promise<Pregunta>;
  actualizarPregunta(id: Id, cambios: Cambios<Pregunta>): Promise<Pregunta>;
  /** Las opciones se borran en cascada; restringido si tiene respuestas. */
  eliminarPregunta(id: Id): Promise<void>;
  listarOpciones(): Promise<OpcionRespuesta[]>;
  crearOpcion(datos: SinId<OpcionRespuesta>): Promise<OpcionRespuesta>;
  actualizarOpcion(id: Id, cambios: Cambios<OpcionRespuesta>): Promise<OpcionRespuesta>;
  eliminarOpcion(id: Id): Promise<void>;
}

/** Solo lectura: las aprobaciones las crea y decide el flujo F2. */
export interface AprobacionesRepo {
  listarPorVerificacion(verificacionId: Id): Promise<Aprobacion[]>;
}

/** Personas: usuarios del entorno (`systemuser`) para el usuario actual y el selector de personas. */
export interface DirectorioRepo {
  usuarioActual(): Promise<Persona>;
  buscarPersonas(texto: string): Promise<Persona[]>;
  /** Usuarios con el rol "VU Responsable" (asignado directamente o por equipo). */
  listarResponsables(): Promise<Persona[]>;
}

export interface Repositorios {
  soluciones: SolucionesRepo;
  verificaciones: VerificacionesRepo;
  entrevistas: EntrevistasRepo;
  respuestas: RespuestasRepo;
  puntajes: PuntajesRepo;
  evidencias: EvidenciasRepo;
  catalogo: CatalogoRepo;
  aprobaciones: AprobacionesRepo;
  directorio: DirectorioRepo;
}
