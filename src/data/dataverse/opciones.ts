import type {
  DecisionAprobacion,
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
  'Adopción plena': 100000000,
  'Adopción parcial': 100000001,
  'Adopción baja': 100000002,
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
