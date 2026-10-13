import type {
  BaseDatos,
  DecisionAprobacion,
  EstadoDesarrollo,
  Evolucion,
  ResultadoVUDeclarado,
  TipoDiseno,
  TipoProceso,
  EstadoEntrevista,
  EstadoVerificacion,
  EstadoVU,
  Modalidad,
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
 * Valores numéricos de las opciones de Dataverse (`docs/diseno-verificacion-uso.md` §2.3 y
 * "Opciones globales"). El dominio trabaja con las etiquetas exactas; aquí se traducen.
 * Las pruebas comprueban que coinciden con los modelos generados en `src/generated/models/`.
 */
export interface Opcion<T extends string> {
  /** Etiqueta del dominio → valor de Dataverse. */
  readonly valores: Readonly<Record<T, number>>;
  aNumero(texto: T): number;
  /** Lanza un error si el valor no pertenece a la opción (no se inventan estados). */
  aTexto(valor: number): T;
  aTextoONull(valor: number | null | undefined): T | null;
  /** Para escribir: `undefined` = no se envía; `null` = se vacía la columna. */
  aNumeroONull(texto: T | null | undefined): number | null | undefined;
}

function opcion<T extends string>(nombre: string, valores: Record<T, number>): Opcion<T> {
  const inverso = new Map<number, T>((Object.entries(valores) as [T, number][]).map(([t, n]) => [n, t]));
  const aTexto = (valor: number): T => {
    const t = inverso.get(valor);
    if (t === undefined) throw new Error(`Valor ${valor} desconocido en la opción ${nombre}.`);
    return t;
  };
  return {
    valores,
    aNumero: (texto) => valores[texto],
    aTexto,
    aTextoONull: (valor) => (valor === null || valor === undefined ? null : aTexto(valor)),
    aNumeroONull: (texto) => (texto === undefined ? undefined : texto === null ? null : valores[texto]),
  };
}

// --- Opciones globales -------------------------------------------------------

export const MODALIDAD = opcion<Modalidad>('vu_modalidad', {
  Teams: 100000000,
  Presencial: 100000001,
  Mixta: 100000002,
});

export const ESTADO_VERIFICACION = opcion<EstadoVerificacion>('vu_estadoverificacion', {
  Borrador: 100000000,
  Programada: 100000001,
  'En levantamiento': 100000002,
  'En evaluación': 100000003,
  'En revisión': 100000004,
  Observada: 100000005,
  'Aprobada piloto': 100000006,
  Aprobada: 100000007,
  Cancelada: 100000008,
});

export const ESTADO_VU = opcion<EstadoVU>('vu_estadovu', {
  Pendiente: 100000000,
  Programada: 100000001,
  'En proceso': 100000002,
  'En revisión': 100000003,
  Vigente: 100000004,
});

// --- Opciones locales --------------------------------------------------------

export const TIPO_AREA = opcion<TipoArea>('vu_area.vu_tipoarea', { Proceso: 100000000, Área: 100000001 });

export const TIPO_SOLUCION = opcion<TipoSolucion>('vu_solucion.vu_tiposolucion', {
  'Power App': 100000000,
  Flujo: 100000001,
  Reporte: 100000002,
  Otro: 100000003,
});

export const TIPO_PROCESO = opcion<TipoProceso>('vu_solucion.vu_tipoproceso', {
  Estratégico: 100000000,
  Operativo: 100000001,
  Soporte: 100000002,
});

export const TIPO_DISENO = opcion<TipoDiseno>('vu_solucion.vu_tipodiseno', {
  Lienzo: 100000000,
  'Model Driven': 100000001,
  Otro: 100000002,
});

export const BASE_DATOS = opcion<BaseDatos>('vu_solucion.vu_basedatos', {
  SharePoint: 100000000,
  Dataverse: 100000001,
  Otro: 100000002,
});

export const ESTADO_DESARROLLO = opcion<EstadoDesarrollo>('vu_solucion.vu_estadodesarrollo', {
  'En proceso': 100000000,
  Entregado: 100000001,
  'En uso': 100000002,
});

export const EVOLUCION = opcion<Evolucion>('vu_solucion.vu_evolucion', {
  'En proceso': 100000000,
  Implementado: 100000001,
});

export const RESULTADO_VU_DECLARADO = opcion<ResultadoVUDeclarado>('vu_solucion.vu_resultadovu', {
  'En uso': 100000000,
  'Uso parcial': 100000001,
  'No confirmada': 100000002,
});

export const TIPO_DOCUMENTO = opcion<TipoDocumento>('vu_documentosolucion.vu_tipodocumento', {
  Manual: 100000000,
  Instructivo: 100000001,
  Video: 100000002,
  Carpeta: 100000003,
  Otro: 100000004,
});

export const TIPO_RESPUESTA = opcion<TipoRespuesta>('vu_pregunta.vu_tiporespuesta', {
  Selección: 100000000,
  Texto: 100000001,
  Numérica: 100000002,
});

export const RESULTADO = opcion<ResultadoAdopcion>('vu_verificacion.vu_resultado', {
  'Usabilidad confirmada': 100000000,
  'Usabilidad parcial': 100000001,
  'No confirmada': 100000002,
});

export const ESTADO_ENTREVISTA = opcion<EstadoEntrevista>('vu_entrevista.vu_estadoentrevista', {
  Pendiente: 100000000,
  'En curso': 100000001,
  Completa: 100000002,
});

export const ORIGEN_RESPUESTA = opcion<OrigenRespuesta>('vu_respuesta.vu_origen', {
  Definida: 100000000,
  'Surgida en reunión': 100000001,
});

export const TIPO_EVIDENCIA = opcion<TipoEvidencia>('vu_evidencia.vu_tipoevidencia', {
  Captura: 100000000,
  Documento: 100000001,
});

export const NIVEL_APROBACION = opcion<NivelAprobacion>('vu_aprobacion.vu_nivel', {
  Piloto: 100000000,
  Productiva: 100000001,
});

export const DECISION_APROBACION = opcion<DecisionAprobacion>('vu_aprobacion.vu_decision', {
  Pendiente: 100000000,
  Aprobada: 100000001,
  Observada: 100000002,
  Rechazada: 100000003,
});

/** `statecode` nativo de los catálogos (§2.1): 0 = activo, 1 = inactivo (statuscode 1 / 2). */
export const ESTADO_ACTIVO = { statecode: 0, statuscode: 1 } as const;
export const ESTADO_INACTIVO = { statecode: 1, statuscode: 2 } as const;
