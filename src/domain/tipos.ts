/**
 * Tipos de dominio de la verificación de uso (VU).
 *
 * Los textos de las elecciones son EXACTAMENTE las etiquetas de `docs/diseno-verificacion-uso.md`
 * §2.3–§2.5. En Dataverse se guardan como valores numéricos de opción (100000000…); la
 * traducción texto ↔ número vive en `src/data/dataverse/opciones.ts`.
 * Este módulo no depende de Dataverse.
 */

/** Identificador de fila: GUID en Dataverse; texto corto en el modo mock. */
export type Id = string;

/** Fecha sin hora en formato ISO `YYYY-MM-DD`. */
export type FechaISO = string;
/** Fecha y hora en formato ISO 8601 (`2026-08-12T15:00:00.000Z`). */
export type FechaHoraISO = string;

export interface Persona {
  /** `systemuserid` en Dataverse (si se conoce); el mock no lo usa. */
  id?: Id | null;
  email: string;
  nombre: string;
}

// ---------------------------------------------------------------------------
// Elecciones (valores exactos)
// ---------------------------------------------------------------------------

export const TIPOS_AREA = ['Proceso', 'Área'] as const;
export type TipoArea = (typeof TIPOS_AREA)[number];

export const TIPOS_SOLUCION = ['Power App', 'Flujo', 'Reporte', 'Otro'] as const;
export type TipoSolucion = (typeof TIPOS_SOLUCION)[number];

/** §2.5 `VU_Soluciones.EstadoVU` */
export const ESTADOS_VU = ['Pendiente', 'Programada', 'En proceso', 'En revisión', 'Vigente'] as const;
export type EstadoVU = (typeof ESTADOS_VU)[number];

export const TIPOS_DOCUMENTO = ['Manual', 'Instructivo', 'Video', 'Carpeta', 'Otro'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const TIPOS_RESPUESTA = ['Selección', 'Texto', 'Numérica'] as const;
export type TipoRespuesta = (typeof TIPOS_RESPUESTA)[number];

/** §2.4 `VU_Verificaciones.Estado` */
export const ESTADOS_VERIFICACION = [
  'Borrador',
  'Programada',
  'En levantamiento',
  'En evaluación',
  'En revisión',
  'Observada',
  'Aprobada piloto',
  'Aprobada',
  'Cancelada',
] as const;
export type EstadoVerificacion = (typeof ESTADOS_VERIFICACION)[number];

/** `VU_Verificaciones.DiasAnticipacion` (validación de columna: 7, 15 o 30). */
export const DIAS_ANTICIPACION = [7, 15, 30] as const;
export type DiasAnticipacion = (typeof DIAS_ANTICIPACION)[number];

export const MODALIDADES = ['Teams', 'Presencial', 'Mixta'] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const MODALIDADES_ENTREVISTA = ['Teams', 'Presencial'] as const;
export type ModalidadEntrevista = (typeof MODALIDADES_ENTREVISTA)[number];

/** RN-09 `VU_Verificaciones.Resultado` */
export const RESULTADOS_ADOPCION = ['Adopción plena', 'Adopción parcial', 'Adopción baja'] as const;
export type ResultadoAdopcion = (typeof RESULTADOS_ADOPCION)[number];

export const ESTADOS_ENTREVISTA = ['Pendiente', 'En curso', 'Completa'] as const;
export type EstadoEntrevista = (typeof ESTADOS_ENTREVISTA)[number];

export const ORIGENES_RESPUESTA = ['Definida', 'Surgida en reunión'] as const;
export type OrigenRespuesta = (typeof ORIGENES_RESPUESTA)[number];

export const TIPOS_EVIDENCIA = ['Captura', 'Documento'] as const;
export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number];

/** RN-08 */
export const NIVELES_APROBACION = ['Piloto', 'Productiva'] as const;
export type NivelAprobacion = (typeof NIVELES_APROBACION)[number];

export const DECISIONES_APROBACION = ['Pendiente', 'Aprobada', 'Observada', 'Rechazada'] as const;
export type DecisionAprobacion = (typeof DECISIONES_APROBACION)[number];

export const TIPOS_NOTIFICACION = [
  'Alerta anticipada',
  'Envío a revisión',
  'Decisión',
  'Recordatorio de vencimiento',
] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

export const CANALES_NOTIFICACION = ['Correo', 'Teams'] as const;
export type CanalNotificacion = (typeof CANALES_NOTIFICACION)[number];

export const ESTADOS_ENVIO = ['Enviada', 'Error'] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

export interface Area {
  id: Id;
  titulo: string;
  tipo: TipoArea;
  areaPadreId: Id | null;
  activo: boolean;
}

export interface Solucion {
  id: Id;
  titulo: string;
  descripcion: string;
  tipoSolucion: TipoSolucion | null;
  procesoId: Id;
  /** Valor de la búsqueda (solo lectura). */
  procesoNombre: string;
  responsable: Persona;
  usuariosObjetivo: number | null;
  fechaActualizacion: FechaISO | null;
  periodicidadMeses: number;
  proximaVU: FechaISO | null;
  /** Lo escribe el flujo F3 (§2.5); la app solo lo lee. */
  estadoVU: EstadoVU;
  ultimaVerificacionId: Id | null;
}

export interface Documento {
  id: Id;
  titulo: string;
  solucionId: Id;
  tipo: TipoDocumento;
  formato: string | null;
  enlace: string;
  version: string | null;
  vigente: boolean;
}

export interface Criterio {
  id: Id;
  titulo: string;
  peso: number;
  orden: number;
  activo: boolean;
}

export interface Pregunta {
  id: Id;
  titulo: string;
  criterioId: Id;
  tipoRespuesta: TipoRespuesta;
  orden: number;
  activo: boolean;
}

export interface OpcionRespuesta {
  id: Id;
  titulo: string;
  preguntaId: Id;
  puntajeSugerido: number;
  orden: number;
}

// ---------------------------------------------------------------------------
// Transaccionales
// ---------------------------------------------------------------------------

export interface Verificacion {
  id: Id;
  /** `VU-00012`: lo asigna la autonumeración de Dataverse al crear la fila (la app no lo escribe). */
  codigo: string;
  solucionId: Id;
  /** Valor de la búsqueda (solo lectura). */
  solucionNombre: string;
  responsable: Persona;
  fechaObjetivo: FechaISO;
  diasAnticipacion: DiasAnticipacion;
  fechaAlerta: FechaISO;
  alertaEnviada: boolean;
  entrevistasPrevistas: number;
  entrevistasCompletas: number;
  modalidad: Modalidad;
  objetivo: string;
  estado: EstadoVerificacion;
  indiceAdopcion: number | null;
  resultado: ResultadoAdopcion | null;
  sustentoGlobal: string;
  oportunidadesConsolidadas: string;
  recomendacionesConsolidadas: string;
  aprobadorPiloto: Persona | null;
  aprobadorProductivo: Persona | null;
  notificarAlFinalizar: boolean;
  fechaEnvio: FechaHoraISO | null;
  fechaAprobacion: FechaHoraISO | null;
}

export interface Entrevista {
  id: Id;
  verificacionId: Id;
  numero: number;
  titulo: string;
  entrevistado: Persona | null;
  entrevistadoNombre: string;
  areaId: Id | null;
  areaNombre: string | null;
  fechaHora: FechaHoraISO | null;
  modalidad: ModalidadEntrevista | null;
  estado: EstadoEntrevista;
  urlGrabacion: string | null;
  oportunidadesMejora: string;
  recomendaciones: string;
  fechaCompletada: FechaHoraISO | null;
}

export interface Respuesta {
  id: Id;
  /** Copia del texto de la pregunta (también en las definidas). */
  titulo: string;
  entrevistaId: Id;
  /** Desnormalizada (§2.3) para consultar todas las respuestas de una verificación. */
  verificacionId: Id;
  origen: OrigenRespuesta;
  preguntaId: Id | null;
  criterioId: Id;
  opcionId: Id | null;
  respuestaTexto: string;
  puntaje: number | null;
  sustento: string;
  orden: number;
}

export interface Evidencia {
  id: Id;
  nombreArchivo: string;
  /** URL directa del archivo, si la hay (en Dataverse se descarga con `EvidenciasRepo.descargar`). */
  url: string | null;
  verificacionId: Id;
  entrevistaId: Id;
  respuestaId: Id | null;
  tipo: TipoEvidencia;
}

export interface PuntajeCriterio {
  id: Id;
  /** Nombre del criterio (copia). */
  titulo: string;
  verificacionId: Id;
  criterioId: Id;
  /** Copia del peso al crear la verificación. */
  peso: number;
  puntajeSugerido: number | null;
  puntajeFinal: number;
  sustentoAjuste: string;
}

export interface Aprobacion {
  id: Id;
  titulo: string;
  verificacionId: Id;
  nivel: NivelAprobacion;
  aprobador: Persona;
  decision: DecisionAprobacion;
  comentario: string;
  fechaSolicitud: FechaHoraISO;
  fechaDecision: FechaHoraISO | null;
  approvalId: string | null;
}

export interface Notificacion {
  id: Id;
  titulo: string;
  verificacionId: Id;
  tipo: TipoNotificacion;
  destinatario: Persona;
  canal: CanalNotificacion;
  fechaEnvio: FechaHoraISO;
  estadoEnvio: EstadoEnvio;
}
