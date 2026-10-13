import type {
  Aprobacion,
  Area,
  Criterio,
  DiasAnticipacion,
  Documento,
  Entrevista,
  Evidencia,
  FechaISO,
  Id,
  OpcionRespuesta,
  Persona,
  Pregunta,
  PuntajeCriterio,
  Respuesta,
  Solucion,
  Verificacion,
} from '../../domain/tipos';
import type { Cambios } from '../repositorios';
import type {
  SPAprobacion,
  SPArea,
  SPChoice,
  SPCriterio,
  SPDocumentoSolucion,
  SPEntrevista,
  SPEscritura,
  SPEvidencia,
  SPLookup,
  SPOpcionRespuesta,
  SPPersona,
  SPPregunta,
  SPPuntajeCriterio,
  SPRespuesta,
  SPSolucion,
  SPVerificacion,
} from './tiposSharePoint';

/**
 * Mapeadores SharePoint ⇄ dominio. Aíslan búsquedas `{Id, Value}`, personas
 * `{Claims, Email, DisplayName}`, elecciones `{Value}` y los nombres internos de columna.
 */

export const ODATA_REFERENCIA = '#Microsoft.Azure.Connectors.SharePoint.SPListExpandedReference';
export const ODATA_USUARIO = '#Microsoft.Azure.Connectors.SharePoint.SPListExpandedUser';

// ---------------------------------------------------------------------------
// Tipos de columna
// ---------------------------------------------------------------------------

export function desdePersona(p: SPPersona | null | undefined): Persona | null {
  if (!p) return null;
  const email = p.Email || p.Claims?.split('|').pop() || '';
  return { email, nombre: p.DisplayName || email };
}

export function aPersona(p: Persona | null): (Pick<SPPersona, 'Claims' | '@odata.type'> & Partial<SPPersona>) | null {
  if (!p) return null;
  return {
    '@odata.type': ODATA_USUARIO,
    Claims: `i:0#.f|membership|${p.email}`,
    DisplayName: p.nombre,
    Email: p.email,
    Department: '',
    JobTitle: '',
    Picture: '',
  };
}

export function aBusqueda(id: Id | null): Pick<SPLookup, 'Id' | '@odata.type'> | null {
  return id === null ? null : { '@odata.type': ODATA_REFERENCIA, Id: id };
}

export function aEleccion<T extends string>(valor: T): SPChoice<T>;
export function aEleccion<T extends string>(valor: T | null): SPChoice<T> | null;
export function aEleccion<T extends string>(valor: T | null): SPChoice<T> | null {
  return valor === null ? null : { '@odata.type': ODATA_REFERENCIA, Value: valor };
}

/**
 * Fecha (solo día) de SharePoint → `YYYY-MM-DD`. SharePoint guarda las fechas sin hora como
 * medianoche de la zona del sitio convertida a UTC (Lima, UTC−5 → `T05:00:00Z`), así que la
 * parte de fecha coincide en zonas con desfase negativo. Validar si el sitio usa otra zona.
 */
export function desdeFecha(valor: string | null | undefined): FechaISO | null {
  return valor ? valor.slice(0, 10) : null;
}

function texto(valor: string | null | undefined): string {
  return valor ?? '';
}

function diasAnticipacion(valor: number): DiasAnticipacion {
  return valor === 7 || valor === 30 ? valor : 15;
}

type Conversores<D, S> = { [K in keyof D]?: (valor: Exclude<D[K], undefined>) => SPEscritura<S> };

/** Traduce solo las propiedades presentes en `cambios` (escritura parcial por campo). */
function aEscritura<D, S>(cambios: Partial<D>, conversores: Conversores<D, S>): SPEscritura<S> {
  const resultado: SPEscritura<S> = {};
  for (const clave of Object.keys(cambios) as (keyof D)[]) {
    const valor = cambios[clave];
    const conversor = conversores[clave];
    if (valor !== undefined && conversor) Object.assign(resultado, conversor(valor as Exclude<D[keyof D], undefined>));
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

export function mapearArea(i: SPArea): Area {
  return {
    id: i.ID,
    titulo: i.Title,
    tipo: i.TipoArea.Value,
    areaPadreId: i.AreaPadre?.Id ?? null,
    activo: i.Activo,
  };
}

export function mapearSolucion(i: SPSolucion): Solucion {
  return {
    id: i.ID,
    titulo: i.Title,
    descripcion: texto(i.Descripcion),
    tipoSolucion: i.TipoSolucion?.Value ?? null,
    procesoId: i.Proceso.Id,
    procesoNombre: i.Proceso.Value,
    responsable: desdePersona(i.Responsable) ?? { email: '', nombre: '' },
    usuariosObjetivo: i.UsuariosObjetivo ?? null,
    fechaActualizacion: desdeFecha(i.FechaActualizacion),
    periodicidadMeses: i.PeriodicidadMeses,
    proximaVU: desdeFecha(i.ProximaVU),
    estadoVU: i.EstadoVU.Value,
    ultimaVerificacionId: i.UltimaVerificacionId ?? null,
  };
}

export function solucionASP(c: Cambios<Solucion>): SPEscritura<SPSolucion> {
  // EstadoVU y UltimaVerificacionId los escribe el flujo F3: no se mapean.
  return aEscritura<Cambios<Solucion>, SPSolucion>(c, {
    titulo: (v) => ({ Title: v }),
    descripcion: (v) => ({ Descripcion: v }),
    tipoSolucion: (v) => ({ TipoSolucion: aEleccion(v) }),
    procesoId: (v) => ({ Proceso: aBusqueda(v) }),
    responsable: (v) => ({ Responsable: aPersona(v) }),
    usuariosObjetivo: (v) => ({ UsuariosObjetivo: v }),
    fechaActualizacion: (v) => ({ FechaActualizacion: v }),
    periodicidadMeses: (v) => ({ PeriodicidadMeses: v }),
  });
}

export function mapearDocumento(i: SPDocumentoSolucion): Documento {
  return {
    id: i.ID,
    titulo: i.Title,
    solucionId: i.Solucion.Id,
    tipo: i.TipoDocumento.Value,
    formato: i.Formato ?? null,
    enlace: i.Enlace,
    version: i.Version ?? null,
    vigente: i.Vigente,
  };
}

export function documentoASP(c: Cambios<Documento>): SPEscritura<SPDocumentoSolucion> {
  return aEscritura<Cambios<Documento>, SPDocumentoSolucion>(c, {
    titulo: (v) => ({ Title: v }),
    solucionId: (v) => ({ Solucion: aBusqueda(v) }),
    tipo: (v) => ({ TipoDocumento: aEleccion(v) }),
    formato: (v) => ({ Formato: v }),
    enlace: (v) => ({ Enlace: v }),
    version: (v) => ({ Version: v }),
    vigente: (v) => ({ Vigente: v }),
  });
}

export function mapearCriterio(i: SPCriterio): Criterio {
  return { id: i.ID, titulo: i.Title, peso: i.Peso, orden: i.Orden, activo: i.Activo };
}

export function criterioASP(c: Cambios<Criterio>): SPEscritura<SPCriterio> {
  return aEscritura<Cambios<Criterio>, SPCriterio>(c, {
    titulo: (v) => ({ Title: v }),
    peso: (v) => ({ Peso: v }),
    orden: (v) => ({ Orden: v }),
    activo: (v) => ({ Activo: v }),
  });
}

export function mapearPregunta(i: SPPregunta): Pregunta {
  return {
    id: i.ID,
    titulo: i.Title,
    criterioId: i.Criterio.Id,
    tipoRespuesta: i.TipoRespuesta.Value,
    orden: i.Orden,
    activo: i.Activo,
  };
}

export function preguntaASP(c: Cambios<Pregunta>): SPEscritura<SPPregunta> {
  return aEscritura<Cambios<Pregunta>, SPPregunta>(c, {
    titulo: (v) => ({ Title: v }),
    criterioId: (v) => ({ Criterio: aBusqueda(v) }),
    tipoRespuesta: (v) => ({ TipoRespuesta: aEleccion(v) }),
    orden: (v) => ({ Orden: v }),
    activo: (v) => ({ Activo: v }),
  });
}

export function mapearOpcion(i: SPOpcionRespuesta): OpcionRespuesta {
  return { id: i.ID, titulo: i.Title, preguntaId: i.Pregunta.Id, puntajeSugerido: i.PuntajeSugerido, orden: i.Orden };
}

export function opcionASP(c: Cambios<OpcionRespuesta>): SPEscritura<SPOpcionRespuesta> {
  return aEscritura<Cambios<OpcionRespuesta>, SPOpcionRespuesta>(c, {
    titulo: (v) => ({ Title: v }),
    preguntaId: (v) => ({ Pregunta: aBusqueda(v) }),
    puntajeSugerido: (v) => ({ PuntajeSugerido: v }),
    orden: (v) => ({ Orden: v }),
  });
}

// ---------------------------------------------------------------------------
// Transaccionales
// ---------------------------------------------------------------------------

export function mapearVerificacion(i: SPVerificacion): Verificacion {
  return {
    id: i.ID,
    codigo: i.Title ?? '',
    solucionId: i.Solucion.Id,
    solucionNombre: i.Solucion.Value,
    responsable: desdePersona(i.Responsable) ?? { email: '', nombre: '' },
    fechaObjetivo: desdeFecha(i.FechaObjetivo) ?? '',
    diasAnticipacion: diasAnticipacion(i.DiasAnticipacion),
    fechaAlerta: desdeFecha(i.FechaAlerta) ?? '',
    alertaEnviada: i.AlertaEnviada,
    entrevistasPrevistas: i.EntrevistasPrevistas,
    entrevistasCompletas: i.EntrevistasCompletas,
    modalidad: i.Modalidad.Value,
    objetivo: texto(i.Objetivo),
    estado: i.Estado.Value,
    indiceAdopcion: i.IndiceAdopcion ?? null,
    resultado: i.Resultado?.Value ?? null,
    sustentoGlobal: texto(i.SustentoGlobal),
    oportunidadesConsolidadas: texto(i.OportunidadesConsolidadas),
    recomendacionesConsolidadas: texto(i.RecomendacionesConsolidadas),
    aprobadorPiloto: desdePersona(i.AprobadorPiloto),
    aprobadorProductivo: desdePersona(i.AprobadorProductivo),
    notificarAlFinalizar: i.NotificarAlFinalizar,
    fechaEnvio: i.FechaEnvio ?? null,
    fechaAprobacion: i.FechaAprobacion ?? null,
  };
}

export function verificacionASP(c: Cambios<Verificacion>): SPEscritura<SPVerificacion> {
  // FechaAprobacion la escribe F2; solucionNombre es el Value de la búsqueda (solo lectura).
  return aEscritura<Cambios<Verificacion>, SPVerificacion>(c, {
    codigo: (v) => ({ Title: v }),
    solucionId: (v) => ({ Solucion: aBusqueda(v) }),
    responsable: (v) => ({ Responsable: aPersona(v) }),
    fechaObjetivo: (v) => ({ FechaObjetivo: v }),
    diasAnticipacion: (v) => ({ DiasAnticipacion: v }),
    fechaAlerta: (v) => ({ FechaAlerta: v }),
    alertaEnviada: (v) => ({ AlertaEnviada: v }),
    entrevistasPrevistas: (v) => ({ EntrevistasPrevistas: v }),
    entrevistasCompletas: (v) => ({ EntrevistasCompletas: v }),
    modalidad: (v) => ({ Modalidad: aEleccion(v) }),
    objetivo: (v) => ({ Objetivo: v }),
    estado: (v) => ({ Estado: aEleccion(v) }),
    indiceAdopcion: (v) => ({ IndiceAdopcion: v }),
    resultado: (v) => ({ Resultado: aEleccion(v) }),
    sustentoGlobal: (v) => ({ SustentoGlobal: v }),
    oportunidadesConsolidadas: (v) => ({ OportunidadesConsolidadas: v }),
    recomendacionesConsolidadas: (v) => ({ RecomendacionesConsolidadas: v }),
    aprobadorPiloto: (v) => ({ AprobadorPiloto: aPersona(v) }),
    aprobadorProductivo: (v) => ({ AprobadorProductivo: aPersona(v) }),
    notificarAlFinalizar: (v) => ({ NotificarAlFinalizar: v }),
    fechaEnvio: (v) => ({ FechaEnvio: v }),
  });
}

export function mapearEntrevista(i: SPEntrevista): Entrevista {
  return {
    id: i.ID,
    verificacionId: i.Verificacion.Id,
    numero: i.Numero,
    titulo: i.Title,
    entrevistado: desdePersona(i.Entrevistado),
    entrevistadoNombre: i.EntrevistadoNombre,
    areaId: i.Area?.Id ?? null,
    areaNombre: i.Area?.Value ?? null,
    fechaHora: i.FechaHora ?? null,
    modalidad: i.Modalidad?.Value ?? null,
    estado: i.Estado.Value,
    urlGrabacion: i.UrlGrabacion ?? null,
    oportunidadesMejora: texto(i.OportunidadesMejora),
    recomendaciones: texto(i.Recomendaciones),
    fechaCompletada: i.FechaCompletada ?? null,
  };
}

export function entrevistaASP(c: Cambios<Entrevista>): SPEscritura<SPEntrevista> {
  return aEscritura<Cambios<Entrevista>, SPEntrevista>(c, {
    titulo: (v) => ({ Title: v }),
    verificacionId: (v) => ({ Verificacion: aBusqueda(v) }),
    numero: (v) => ({ Numero: v }),
    entrevistado: (v) => ({ Entrevistado: aPersona(v) }),
    entrevistadoNombre: (v) => ({ EntrevistadoNombre: v }),
    areaId: (v) => ({ Area: aBusqueda(v) }),
    fechaHora: (v) => ({ FechaHora: v }),
    modalidad: (v) => ({ Modalidad: aEleccion(v) }),
    estado: (v) => ({ Estado: aEleccion(v) }),
    urlGrabacion: (v) => ({ UrlGrabacion: v }),
    oportunidadesMejora: (v) => ({ OportunidadesMejora: v }),
    recomendaciones: (v) => ({ Recomendaciones: v }),
    fechaCompletada: (v) => ({ FechaCompletada: v }),
  });
}

export function mapearRespuesta(i: SPRespuesta): Respuesta {
  return {
    id: i.ID,
    titulo: i.Title,
    entrevistaId: i.Entrevista.Id,
    verificacionId: i.Verificacion.Id,
    origen: i.Origen.Value,
    preguntaId: i.Pregunta?.Id ?? null,
    criterioId: i.Criterio.Id,
    opcionId: i.Opcion?.Id ?? null,
    respuestaTexto: texto(i.RespuestaTexto),
    puntaje: i.Puntaje ?? null,
    sustento: texto(i.Sustento),
    orden: i.Orden,
  };
}

export function respuestaASP(c: Cambios<Respuesta>): SPEscritura<SPRespuesta> {
  return aEscritura<Cambios<Respuesta>, SPRespuesta>(c, {
    titulo: (v) => ({ Title: v }),
    entrevistaId: (v) => ({ Entrevista: aBusqueda(v) }),
    verificacionId: (v) => ({ Verificacion: aBusqueda(v) }),
    origen: (v) => ({ Origen: aEleccion(v) }),
    preguntaId: (v) => ({ Pregunta: aBusqueda(v) }),
    criterioId: (v) => ({ Criterio: aBusqueda(v) }),
    opcionId: (v) => ({ Opcion: aBusqueda(v) }),
    respuestaTexto: (v) => ({ RespuestaTexto: v }),
    puntaje: (v) => ({ Puntaje: v }),
    sustento: (v) => ({ Sustento: v }),
    orden: (v) => ({ Orden: v }),
  });
}

export function mapearPuntaje(i: SPPuntajeCriterio): PuntajeCriterio {
  return {
    id: i.ID,
    titulo: i.Title,
    verificacionId: i.Verificacion.Id,
    criterioId: i.Criterio.Id,
    peso: i.Peso,
    puntajeSugerido: i.PuntajeSugerido ?? null,
    puntajeFinal: i.PuntajeFinal,
    sustentoAjuste: texto(i.SustentoAjuste),
  };
}

export function puntajeASP(c: Cambios<PuntajeCriterio>): SPEscritura<SPPuntajeCriterio> {
  return aEscritura<Cambios<PuntajeCriterio>, SPPuntajeCriterio>(c, {
    titulo: (v) => ({ Title: v }),
    verificacionId: (v) => ({ Verificacion: aBusqueda(v) }),
    criterioId: (v) => ({ Criterio: aBusqueda(v) }),
    peso: (v) => ({ Peso: v }),
    puntajeSugerido: (v) => ({ PuntajeSugerido: v }),
    puntajeFinal: (v) => ({ PuntajeFinal: v }),
    sustentoAjuste: (v) => ({ SustentoAjuste: v }),
  });
}

export function mapearAprobacion(i: SPAprobacion): Aprobacion {
  return {
    id: i.ID,
    titulo: i.Title,
    verificacionId: i.Verificacion.Id,
    nivel: i.Nivel.Value,
    aprobador: desdePersona(i.Aprobador) ?? { email: '', nombre: '' },
    decision: i.Decision.Value,
    comentario: texto(i.Comentario),
    fechaSolicitud: i.FechaSolicitud,
    fechaDecision: i.FechaDecision ?? null,
    approvalId: i.ApprovalId ?? null,
  };
}

export function mapearEvidencia(i: SPEvidencia): Evidencia {
  return {
    id: i.ID,
    nombreArchivo: i.Nombre,
    url: i.Enlace ?? null,
    verificacionId: i.Verificacion.Id,
    entrevistaId: i.Entrevista.Id,
    respuestaId: i.Respuesta?.Id ?? null,
    tipo: i.TipoEvidencia.Value,
  };
}

export function evidenciaASP(c: Cambios<Evidencia>): SPEscritura<SPEvidencia> {
  return aEscritura<Cambios<Evidencia>, SPEvidencia>(c, {
    verificacionId: (v) => ({ Verificacion: aBusqueda(v) }),
    entrevistaId: (v) => ({ Entrevista: aBusqueda(v) }),
    respuestaId: (v) => ({ Respuesta: aBusqueda(v) }),
    tipo: (v) => ({ TipoEvidencia: aEleccion(v) }),
  });
}
