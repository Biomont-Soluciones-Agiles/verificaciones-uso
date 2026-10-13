import type {
  DecisionAprobacion,
  EstadoEntrevista,
  EstadoVerificacion,
  EstadoVU,
  Modalidad,
  ModalidadEntrevista,
  NivelAprobacion,
  OrigenRespuesta,
  ResultadoAdopcion,
  TipoArea,
  TipoDocumento,
  TipoEvidencia,
  TipoRespuesta,
  TipoSolucion,
} from '../../domain/tipos';

/**
 * Forma de los elementos tal como los devuelve el conector SharePoint Online
 * (nombres internos EXACTOS de §2.3). Cuando existan las listas, `pac code add-data-source`
 * generará los modelos en `src/generated/models/`; estos tipos describen el subconjunto
 * que usan los mapeadores y deben coincidir con ellos (sustituir por los generados si difieren).
 */

/** Columna de búsqueda expandida. */
export interface SPLookup {
  '@odata.type'?: string;
  Id: number;
  Value: string;
}

/** Columna de persona expandida. `Claims` = `i:0#.f|membership|{email}`. */
export interface SPPersona {
  '@odata.type'?: string;
  Claims: string;
  DisplayName: string;
  Email: string;
  Department?: string | null;
  JobTitle?: string | null;
  Picture?: string | null;
}

/** Columna de elección. */
export interface SPChoice<T extends string> {
  '@odata.type'?: string;
  Value: T;
}

/** Columnas nativas presentes en todas las listas. */
export interface SPItemBase {
  ID: number;
  Title: string;
  Created?: string;
  Modified?: string;
  Author?: SPPersona;
  Editor?: SPPersona;
}

export interface SPArea extends SPItemBase {
  TipoArea: SPChoice<TipoArea>;
  AreaPadre?: SPLookup | null;
  Activo: boolean;
}

export interface SPSolucion extends SPItemBase {
  Descripcion?: string | null;
  TipoSolucion?: SPChoice<TipoSolucion> | null;
  Proceso: SPLookup;
  Responsable: SPPersona;
  UsuariosObjetivo?: number | null;
  FechaActualizacion?: string | null;
  PeriodicidadMeses: number;
  ProximaVU?: string | null;
  EstadoVU: SPChoice<EstadoVU>;
  UltimaVerificacionId?: number | null;
}

export interface SPDocumentoSolucion extends SPItemBase {
  Solucion: SPLookup;
  TipoDocumento: SPChoice<TipoDocumento>;
  Formato?: string | null;
  /** Hipervínculo: el conector lo expone como texto con la URL. */
  Enlace: string;
  Version?: string | null;
  Vigente: boolean;
}

export interface SPCriterio extends SPItemBase {
  Peso: number;
  Orden: number;
  Activo: boolean;
}

export interface SPPregunta extends SPItemBase {
  Criterio: SPLookup;
  TipoRespuesta: SPChoice<TipoRespuesta>;
  Orden: number;
  Activo: boolean;
}

export interface SPOpcionRespuesta extends SPItemBase {
  Pregunta: SPLookup;
  PuntajeSugerido: number;
  Orden: number;
}

export interface SPVerificacion extends SPItemBase {
  Solucion: SPLookup;
  Responsable: SPPersona;
  FechaObjetivo: string;
  DiasAnticipacion: number;
  FechaAlerta: string;
  AlertaEnviada: boolean;
  EntrevistasPrevistas: number;
  EntrevistasCompletas: number;
  Modalidad: SPChoice<Modalidad>;
  Objetivo?: string | null;
  Estado: SPChoice<EstadoVerificacion>;
  IndiceAdopcion?: number | null;
  Resultado?: SPChoice<ResultadoAdopcion> | null;
  SustentoGlobal?: string | null;
  OportunidadesConsolidadas?: string | null;
  RecomendacionesConsolidadas?: string | null;
  AprobadorPiloto?: SPPersona | null;
  AprobadorProductivo?: SPPersona | null;
  NotificarAlFinalizar: boolean;
  FechaEnvio?: string | null;
  FechaAprobacion?: string | null;
}

export interface SPEntrevista extends SPItemBase {
  Verificacion: SPLookup;
  Numero: number;
  Entrevistado?: SPPersona | null;
  EntrevistadoNombre: string;
  Area?: SPLookup | null;
  FechaHora?: string | null;
  Modalidad?: SPChoice<ModalidadEntrevista> | null;
  Estado: SPChoice<EstadoEntrevista>;
  UrlGrabacion?: string | null;
  OportunidadesMejora?: string | null;
  Recomendaciones?: string | null;
  FechaCompletada?: string | null;
}

export interface SPRespuesta extends SPItemBase {
  Entrevista: SPLookup;
  Verificacion: SPLookup;
  Origen: SPChoice<OrigenRespuesta>;
  Pregunta?: SPLookup | null;
  Criterio: SPLookup;
  Opcion?: SPLookup | null;
  RespuestaTexto?: string | null;
  Puntaje?: number | null;
  Sustento?: string | null;
  Orden: number;
}

export interface SPPuntajeCriterio extends SPItemBase {
  Verificacion: SPLookup;
  Criterio: SPLookup;
  Peso: number;
  PuntajeSugerido?: number | null;
  PuntajeFinal: number;
  SustentoAjuste?: string | null;
}

export interface SPAprobacion extends SPItemBase {
  Verificacion: SPLookup;
  Nivel: SPChoice<NivelAprobacion>;
  Aprobador: SPPersona;
  Decision: SPChoice<DecisionAprobacion>;
  Comentario?: string | null;
  FechaSolicitud: string;
  FechaDecision?: string | null;
  ApprovalId?: string | null;
}

/** Elemento de la biblioteca VU_Evidencias (metadatos del archivo). */
export interface SPEvidencia {
  ID: number;
  /** Nombre del archivo (`FileLeafRef` / `{Name}` según la operación del conector). */
  Nombre: string;
  /** URL absoluta o relativa al servidor (`{Link}` / `FileRef`). */
  Enlace?: string | null;
  Verificacion: SPLookup;
  Entrevista: SPLookup;
  Respuesta?: SPLookup | null;
  TipoEvidencia: SPChoice<TipoEvidencia>;
}

/** Al escribir, las búsquedas y personas solo necesitan su clave. */
export type SPEscritura<T> = {
  [K in keyof T]?: T[K] extends SPLookup | null | undefined
    ? Pick<SPLookup, 'Id' | '@odata.type'> | null
    : T[K] extends SPPersona | null | undefined
      ? Pick<SPPersona, 'Claims' | '@odata.type'> & Partial<SPPersona> | null
      : T[K];
};
