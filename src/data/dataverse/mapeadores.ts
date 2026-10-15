import type {
  Aprobacion,
  CambioPuntaje,
  Area,
  Criterio,
  DiasAnticipacion,
  Documento,
  Entrevista,
  Evidencia,
  ModalidadEntrevista,
  OpcionRespuesta,
  Persona,
  Pregunta,
  PuntajeCriterio,
  Respuesta,
  Solucion,
  Verificacion,
} from '../../domain/tipos';
import type { Cambios } from '../repositorios';
import {
  aFechaSolo,
  bind,
  booleano,
  booleanoONull,
  CONJUNTOS,
  fechaHora,
  fechaSolo,
  leerId,
  nombreBusqueda,
  numero,
  numeroONull,
  sinIndefinidos,
  texto,
  textoONull,
  type Fila,
  type Registro,
} from './odata';
import {
  BASE_DATOS,
  DECISION_APROBACION,
  ESTADO_DESARROLLO,
  EVOLUCION,
  RESULTADO_VU_DECLARADO,
  TIPO_DISENO,
  TIPO_PROCESO,
  ESTADO_ACTIVO,
  ESTADO_ENTREVISTA,
  ESTADO_INACTIVO,
  ESTADO_VERIFICACION,
  ESTADO_VU,
  MODALIDAD,
  NIVEL_APROBACION,
  ORIGEN_RESPUESTA,
  RESULTADO,
  TIPO_AREA,
  TIPO_DOCUMENTO,
  TIPO_EVIDENCIA,
  TIPO_RESPUESTA,
  TIPO_SOLUCION,
} from './opciones';

/**
 * Traducción fila de Dataverse ↔ tipo de dominio. Funciones puras (sin SDK):
 * - opciones: número ↔ etiqueta exacta (`./opciones`);
 * - búsquedas: se leen de `_x_value` (+ nombre formateado) y se escriben con `Nav@odata.bind`;
 * - fechas *DateOnly* como `yyyy-MM-dd`;
 * - personas (`systemuser`): id + nombre formateado; el correo lo completa el repositorio.
 * Los `aRegistro` solo incluyen las columnas presentes en `cambios` (actualización parcial).
 */

/** Periodicidad estándar (§2.3): Dataverse no admite valor predeterminado en enteros. */
export const PERIODICIDAD_PREDETERMINADA = 6;

// ---------------------------------------------------------------------------
// $select por tabla (sin columnas virtuales `*name`)
// ---------------------------------------------------------------------------

export const SELECT = {
  area: ['vu_areaid', 'vu_name', 'vu_tipoarea', '_vu_areapadreid_value', 'statecode'],
  solucion: [
    'vu_solucionid',
    'vu_name',
    'vu_descripcion',
    'vu_tiposolucion',
    '_vu_procesoid_value',
    '_vu_responsableid_value',
    'vu_usuariosobjetivo',
    'vu_fechaactualizacion',
    'vu_periodicidadmeses',
    'vu_proximavu',
    'vu_estadovu',
    '_vu_ultimaverificacionid_value',
    'vu_tipoproceso',
    'vu_proveedor',
    'vu_tipodiseno',
    'vu_basedatos',
    'vu_tienedashboard',
    'vu_estadodesarrollo',
    'vu_evolucion',
    'vu_beneficioanualpen',
    'vu_capexpen',
    'vu_capexusd',
    'vu_fechaimplementacion',
    'vu_resultadovu',
  ],
  documento: [
    'vu_documentosolucionid',
    'vu_name',
    '_vu_solucionid_value',
    'vu_tipodocumento',
    'vu_formato',
    'vu_enlace',
    'vu_version',
    'vu_vigente',
  ],
  criterio: ['vu_criterioid', 'vu_name', 'vu_peso', 'vu_orden', 'statecode'],
  pregunta: ['vu_preguntaid', 'vu_name', '_vu_criterioid_value', 'vu_tiporespuesta', 'vu_orden', 'vu_obligatoria', 'statecode'],
  opcion: ['vu_opcionrespuestaid', 'vu_name', '_vu_preguntaid_value', 'vu_puntajesugerido', 'vu_orden'],
  verificacion: [
    'vu_verificacionid',
    'vu_name',
    '_vu_solucionid_value',
    '_vu_responsableid_value',
    'vu_fechaobjetivo',
    'vu_diasanticipacion',
    'vu_fechaalerta',
    'vu_alertaenviada',
    'vu_entrevistasprevistas',
    'vu_entrevistascompletas',
    'vu_modalidad',
    'vu_objetivo',
    'vu_estado',
    'vu_indiceadopcion',
    'vu_resultado',
    'vu_sustentoglobal',
    'vu_oportunidadesconsolidadas',
    'vu_recomendacionesconsolidadas',
    '_vu_aprobadorpilotoid_value',
    'vu_notificaralfinalizar',
    'vu_fechaenvio',
    'vu_fechaaprobacion',
  ],
  entrevista: [
    'vu_entrevistaid',
    'vu_name',
    '_vu_verificacionid_value',
    'vu_numero',
    '_vu_entrevistadoid_value',
    'vu_entrevistadonombre',
    'vu_entrevistadocorreo',
    '_vu_areaid_value',
    'vu_fechahora',
    'vu_modalidad',
    'vu_estadoentrevista',
    'vu_urlgrabacion',
    'vu_oportunidadesmejora',
    'vu_recomendaciones',
    'vu_fechacompletada',
  ],
  respuesta: [
    'vu_respuestaid',
    'vu_name',
    '_vu_entrevistaid_value',
    '_vu_verificacionid_value',
    'vu_origen',
    '_vu_preguntaid_value',
    '_vu_criterioid_value',
    '_vu_opcionid_value',
    'vu_respuestatexto',
    'vu_puntaje',
    'vu_sustento',
    'vu_orden',
  ],
  evidencia: [
    'vu_evidenciaid',
    'vu_name',
    '_vu_entrevistaid_value',
    '_vu_verificacionid_value',
    '_vu_respuestaid_value',
    'vu_tipoevidencia',
  ],
  puntaje: [
    'vu_puntajecriterioid',
    'vu_name',
    '_vu_verificacionid_value',
    '_vu_criterioid_value',
    'vu_peso',
    'vu_puntajesugerido',
    'vu_puntajefinal',
    'vu_sustentoajuste',
  ],
  aprobacion: [
    'vu_aprobacionid',
    'vu_name',
    '_vu_verificacionid_value',
    'vu_nivel',
    '_vu_aprobadorid_value',
    'vu_decision',
    'vu_comentario',
    'vu_fechasolicitud',
    'vu_fechadecision',
    'vu_approvalid',
  ],
  historialPuntaje: [
    'vu_historialpuntajeid',
    'vu_name',
    '_vu_respuestaid_value',
    '_vu_verificacionid_value',
    'vu_puntajeanterior',
    'vu_puntajenuevo',
    '_createdby_value',
    'modifiedon',
  ],
  usuario: ['systemuserid', 'fullname', 'internalemailaddress', 'domainname'],
} as const satisfies Record<string, readonly string[]>;

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function idObligatorio(fila: Fila, columna: string): string {
  const v = fila[columna];
  if (typeof v !== 'string' || !v) throw new Error(`La fila no trae ${columna}.`);
  return v;
}

/** Búsqueda obligatoria (`_x_value`); cadena vacía si la fila llegó sin ella. */
function busqueda(fila: Fila, columna: string): string {
  return leerId(fila, columna) ?? '';
}

/** Persona desde una búsqueda a `systemuser` (sin correo: lo completa el repositorio). */
export function personaDeBusqueda(fila: Fila, columna: string): Persona | null {
  const id = leerId(fila, columna);
  if (!id) return null;
  return { id, nombre: nombreBusqueda(fila, columna) ?? '', email: '' };
}

export function personaDeUsuario(fila: Fila): Persona {
  const email = texto(fila, 'internalemailaddress') || texto(fila, 'domainname');
  return { id: idObligatorio(fila, 'systemuserid'), nombre: texto(fila, 'fullname') || email, email };
}

/** Bind a `systemuser`; la persona debe traer su `id` (el repositorio lo resuelve antes). */
export function bindPersona(navegacion: string, persona: Persona | null): Registro {
  if (persona === null) return bind(navegacion, CONJUNTOS.usuario, null);
  if (!persona.id) throw new Error(`No se pudo identificar a ${persona.nombre || persona.email} como usuario del entorno.`);
  return bind(navegacion, CONJUNTOS.usuario, persona.id);
}

/** Texto multilínea opcional: vacío → null (Dataverse no guarda cadenas vacías). */
function opcionalTexto(valor: string | null | undefined): string | null | undefined {
  if (valor === undefined) return undefined;
  return valor === null || valor.trim() === '' ? null : valor;
}

function estadoActivo(activo: boolean | undefined): Registro {
  if (activo === undefined) return {};
  return { ...(activo ? ESTADO_ACTIVO : ESTADO_INACTIVO) };
}

const DIAS_VALIDOS: readonly number[] = [7, 15, 30];

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

export function areaDesdeFila(f: Fila): Area {
  return {
    id: idObligatorio(f, 'vu_areaid'),
    titulo: texto(f, 'vu_name'),
    tipo: TIPO_AREA.aTexto(numero(f, 'vu_tipoarea')),
    areaPadreId: leerId(f, 'vu_areapadreid'),
    activo: numero(f, 'statecode') === 0,
  };
}

export function solucionDesdeFila(f: Fila): Solucion {
  return {
    id: idObligatorio(f, 'vu_solucionid'),
    titulo: texto(f, 'vu_name'),
    descripcion: texto(f, 'vu_descripcion'),
    tipoSolucion: TIPO_SOLUCION.aTextoONull(numeroONull(f, 'vu_tiposolucion')),
    procesoId: busqueda(f, 'vu_procesoid'),
    procesoNombre: nombreBusqueda(f, 'vu_procesoid') ?? '',
    responsable: personaDeBusqueda(f, 'vu_responsableid'),
    usuariosObjetivo: numeroONull(f, 'vu_usuariosobjetivo'),
    fechaActualizacion: fechaSolo(f, 'vu_fechaactualizacion'),
    periodicidadMeses: numero(f, 'vu_periodicidadmeses', PERIODICIDAD_PREDETERMINADA),
    proximaVU: fechaSolo(f, 'vu_proximavu'),
    estadoVU: ESTADO_VU.aTexto(numero(f, 'vu_estadovu', ESTADO_VU.valores.Pendiente)),
    ultimaVerificacionId: leerId(f, 'vu_ultimaverificacionid'),
    tipoProceso: TIPO_PROCESO.aTextoONull(numeroONull(f, 'vu_tipoproceso')),
    proveedor: textoONull(f, 'vu_proveedor'),
    tipoDiseno: TIPO_DISENO.aTextoONull(numeroONull(f, 'vu_tipodiseno')),
    baseDatos: BASE_DATOS.aTextoONull(numeroONull(f, 'vu_basedatos')),
    tieneDashboard: booleanoONull(f, 'vu_tienedashboard'),
    estadoDesarrollo: ESTADO_DESARROLLO.aTextoONull(numeroONull(f, 'vu_estadodesarrollo')),
    evolucion: EVOLUCION.aTextoONull(numeroONull(f, 'vu_evolucion')),
    beneficioAnualPEN: numeroONull(f, 'vu_beneficioanualpen'),
    capexPEN: numeroONull(f, 'vu_capexpen'),
    capexUSD: numeroONull(f, 'vu_capexusd'),
    fechaImplementacion: fechaSolo(f, 'vu_fechaimplementacion'),
    resultadoVUDeclarado: RESULTADO_VU_DECLARADO.aTextoONull(numeroONull(f, 'vu_resultadovu')),
  };
}

/**
 * `estadoVU` y `ultimaVerificacionId` los escribe F3 (§2.5): al crear se envía "Pendiente"
 * (es obligatorio) y nunca se actualizan desde la app. `vu_periodicidadmeses` se envía
 * siempre al crear (6 si no se indica).
 */
export function solucionARegistro(c: Cambios<Solucion>, creando = false): Registro {
  const periodicidad =
    c.periodicidadMeses !== undefined && Number.isFinite(c.periodicidadMeses) && c.periodicidadMeses > 0
      ? c.periodicidadMeses
      : creando
        ? PERIODICIDAD_PREDETERMINADA
        : undefined;
  return sinIndefinidos({
    vu_name: c.titulo,
    vu_descripcion: opcionalTexto(c.descripcion),
    vu_tiposolucion:
      c.tipoSolucion === undefined ? undefined : c.tipoSolucion === null ? null : TIPO_SOLUCION.aNumero(c.tipoSolucion),
    ...(c.procesoId !== undefined ? bind('vu_ProcesoId', CONJUNTOS.area, c.procesoId) : {}),
    ...(c.responsable !== undefined ? bindPersona('vu_ResponsableId', c.responsable) : {}),
    vu_usuariosobjetivo: c.usuariosObjetivo,
    vu_fechaactualizacion: c.fechaActualizacion === undefined ? undefined : aFechaSolo(c.fechaActualizacion),
    vu_periodicidadmeses: periodicidad,
    vu_proximavu: c.proximaVU === undefined ? undefined : aFechaSolo(c.proximaVU),
    vu_estadovu: creando ? ESTADO_VU.aNumero(c.estadoVU ?? 'Pendiente') : undefined,
    vu_tipoproceso: TIPO_PROCESO.aNumeroONull(c.tipoProceso),
    vu_proveedor: opcionalTexto(c.proveedor),
    vu_tipodiseno: TIPO_DISENO.aNumeroONull(c.tipoDiseno),
    vu_basedatos: BASE_DATOS.aNumeroONull(c.baseDatos),
    vu_tienedashboard: c.tieneDashboard,
    vu_estadodesarrollo: ESTADO_DESARROLLO.aNumeroONull(c.estadoDesarrollo),
    vu_evolucion: EVOLUCION.aNumeroONull(c.evolucion),
    vu_beneficioanualpen: c.beneficioAnualPEN,
    vu_capexpen: c.capexPEN,
    vu_capexusd: c.capexUSD,
    vu_fechaimplementacion: c.fechaImplementacion === undefined ? undefined : aFechaSolo(c.fechaImplementacion),
    vu_resultadovu: RESULTADO_VU_DECLARADO.aNumeroONull(c.resultadoVUDeclarado),
  });
}

export function documentoDesdeFila(f: Fila): Documento {
  return {
    id: idObligatorio(f, 'vu_documentosolucionid'),
    titulo: texto(f, 'vu_name'),
    solucionId: busqueda(f, 'vu_solucionid'),
    tipo: TIPO_DOCUMENTO.aTexto(numero(f, 'vu_tipodocumento')),
    formato: textoONull(f, 'vu_formato'),
    enlace: texto(f, 'vu_enlace'),
    version: textoONull(f, 'vu_version'),
    vigente: booleano(f, 'vu_vigente'),
  };
}

export function documentoARegistro(c: Cambios<Documento>): Registro {
  return sinIndefinidos({
    vu_name: c.titulo,
    ...(c.solucionId !== undefined ? bind('vu_SolucionId', CONJUNTOS.solucion, c.solucionId) : {}),
    vu_tipodocumento: c.tipo === undefined ? undefined : TIPO_DOCUMENTO.aNumero(c.tipo),
    vu_formato: opcionalTexto(c.formato),
    vu_enlace: c.enlace,
    vu_version: opcionalTexto(c.version),
    vu_vigente: c.vigente,
  });
}

export function criterioDesdeFila(f: Fila): Criterio {
  return {
    id: idObligatorio(f, 'vu_criterioid'),
    titulo: texto(f, 'vu_name'),
    peso: numero(f, 'vu_peso'),
    orden: numero(f, 'vu_orden'),
    activo: numero(f, 'statecode') === 0,
  };
}

export function criterioARegistro(c: Cambios<Criterio>): Registro {
  return sinIndefinidos({ vu_name: c.titulo, vu_peso: c.peso, vu_orden: c.orden, ...estadoActivo(c.activo) });
}

export function preguntaDesdeFila(f: Fila): Pregunta {
  return {
    id: idObligatorio(f, 'vu_preguntaid'),
    titulo: texto(f, 'vu_name'),
    criterioId: busqueda(f, 'vu_criterioid'),
    tipoRespuesta: TIPO_RESPUESTA.aTexto(numero(f, 'vu_tiporespuesta')),
    orden: numero(f, 'vu_orden'),
    // Las filas anteriores a la columna llegan sin valor: eran todas obligatorias.
    obligatoria: booleanoONull(f, 'vu_obligatoria') ?? true,
    activo: numero(f, 'statecode') === 0,
  };
}

export function preguntaARegistro(c: Cambios<Pregunta>): Registro {
  return sinIndefinidos({
    vu_name: c.titulo,
    ...(c.criterioId !== undefined ? bind('vu_CriterioId', CONJUNTOS.criterio, c.criterioId) : {}),
    vu_tiporespuesta: c.tipoRespuesta === undefined ? undefined : TIPO_RESPUESTA.aNumero(c.tipoRespuesta),
    vu_orden: c.orden,
    vu_obligatoria: c.obligatoria,
    ...estadoActivo(c.activo),
  });
}

export function opcionDesdeFila(f: Fila): OpcionRespuesta {
  return {
    id: idObligatorio(f, 'vu_opcionrespuestaid'),
    titulo: texto(f, 'vu_name'),
    preguntaId: busqueda(f, 'vu_preguntaid'),
    puntajeSugerido: numero(f, 'vu_puntajesugerido'),
    orden: numero(f, 'vu_orden'),
  };
}

export function opcionARegistro(c: Cambios<OpcionRespuesta>): Registro {
  return sinIndefinidos({
    vu_name: c.titulo,
    ...(c.preguntaId !== undefined ? bind('vu_PreguntaId', CONJUNTOS.pregunta, c.preguntaId) : {}),
    vu_puntajesugerido: c.puntajeSugerido,
    vu_orden: c.orden,
  });
}

// ---------------------------------------------------------------------------
// Transaccionales
// ---------------------------------------------------------------------------

export function verificacionDesdeFila(f: Fila): Verificacion {
  const dias = numeroONull(f, 'vu_diasanticipacion');
  return {
    id: idObligatorio(f, 'vu_verificacionid'),
    codigo: texto(f, 'vu_name'),
    solucionId: busqueda(f, 'vu_solucionid'),
    solucionNombre: nombreBusqueda(f, 'vu_solucionid') ?? '',
    // Las verificaciones históricas traen estos campos nulos: se conservan como null.
    responsable: personaDeBusqueda(f, 'vu_responsableid'),
    fechaObjetivo: fechaSolo(f, 'vu_fechaobjetivo'),
    diasAnticipacion: dias !== null && DIAS_VALIDOS.includes(dias) ? (dias as DiasAnticipacion) : null,
    fechaAlerta: fechaSolo(f, 'vu_fechaalerta'),
    alertaEnviada: booleano(f, 'vu_alertaenviada'),
    entrevistasPrevistas: numero(f, 'vu_entrevistasprevistas'),
    entrevistasCompletas: numero(f, 'vu_entrevistascompletas'),
    modalidad: MODALIDAD.aTextoONull(numeroONull(f, 'vu_modalidad')),
    objetivo: texto(f, 'vu_objetivo'),
    estado: ESTADO_VERIFICACION.aTexto(numero(f, 'vu_estado', ESTADO_VERIFICACION.valores.Borrador)),
    indiceAdopcion: numeroONull(f, 'vu_indiceadopcion'),
    resultado: RESULTADO.aTextoONull(numeroONull(f, 'vu_resultado')),
    sustentoGlobal: texto(f, 'vu_sustentoglobal'),
    oportunidadesConsolidadas: texto(f, 'vu_oportunidadesconsolidadas'),
    recomendacionesConsolidadas: texto(f, 'vu_recomendacionesconsolidadas'),
    aprobadorPiloto: personaDeBusqueda(f, 'vu_aprobadorpilotoid'),
    notificarAlFinalizar: booleano(f, 'vu_notificaralfinalizar'),
    fechaEnvio: fechaHora(f, 'vu_fechaenvio'),
    fechaAprobacion: fechaHora(f, 'vu_fechaaprobacion'),
  };
}

/**
 * `vu_name` (código) no se envía nunca: lo pone la autonumeración `VU-{SEQNUM:5}`.
 * `vu_fechaaprobacion` la escribe F2. Al crear se envían siempre los enteros sin valor
 * predeterminado en Dataverse (`vu_entrevistascompletas` = 0 si no se indica).
 */
export function verificacionARegistro(c: Cambios<Verificacion>, creando = false): Registro {
  return sinIndefinidos({
    ...(c.solucionId !== undefined ? bind('vu_SolucionId', CONJUNTOS.solucion, c.solucionId) : {}),
    ...(c.responsable !== undefined ? bindPersona('vu_ResponsableId', c.responsable) : {}),
    vu_fechaobjetivo: c.fechaObjetivo === undefined ? undefined : aFechaSolo(c.fechaObjetivo),
    vu_diasanticipacion: c.diasAnticipacion,
    vu_fechaalerta: c.fechaAlerta === undefined ? undefined : aFechaSolo(c.fechaAlerta),
    vu_alertaenviada: c.alertaEnviada ?? (creando ? false : undefined),
    vu_entrevistasprevistas: c.entrevistasPrevistas,
    vu_entrevistascompletas: c.entrevistasCompletas ?? (creando ? 0 : undefined),
    vu_modalidad: MODALIDAD.aNumeroONull(c.modalidad),
    vu_objetivo: opcionalTexto(c.objetivo),
    vu_estado:
      c.estado !== undefined
        ? ESTADO_VERIFICACION.aNumero(c.estado)
        : creando
          ? ESTADO_VERIFICACION.valores.Borrador
          : undefined,
    vu_indiceadopcion: c.indiceAdopcion,
    vu_resultado: c.resultado === undefined ? undefined : c.resultado === null ? null : RESULTADO.aNumero(c.resultado),
    vu_sustentoglobal: opcionalTexto(c.sustentoGlobal),
    vu_oportunidadesconsolidadas: opcionalTexto(c.oportunidadesConsolidadas),
    vu_recomendacionesconsolidadas: opcionalTexto(c.recomendacionesConsolidadas),
    ...(c.aprobadorPiloto !== undefined ? bindPersona('vu_AprobadorPilotoId', c.aprobadorPiloto) : {}),
    vu_notificaralfinalizar: c.notificarAlFinalizar ?? (creando ? false : undefined),
    vu_fechaenvio: c.fechaEnvio,
  });
}

function modalidadEntrevista(valor: number | null): ModalidadEntrevista | null {
  if (valor === null) return null;
  const m = MODALIDAD.aTexto(valor);
  return m === 'Teams' || m === 'Presencial' ? m : null;
}

export function entrevistaDesdeFila(f: Fila): Entrevista {
  const nombre = texto(f, 'vu_entrevistadonombre');
  const correo = texto(f, 'vu_entrevistadocorreo');
  const usuarioId = leerId(f, 'vu_entrevistadoid');
  const entrevistado: Persona | null =
    usuarioId || correo
      ? { id: usuarioId, nombre: nombreBusqueda(f, 'vu_entrevistadoid') ?? nombre, email: correo }
      : null;
  return {
    id: idObligatorio(f, 'vu_entrevistaid'),
    verificacionId: busqueda(f, 'vu_verificacionid'),
    numero: numero(f, 'vu_numero'),
    titulo: texto(f, 'vu_name'),
    entrevistado,
    entrevistadoNombre: nombre,
    areaId: leerId(f, 'vu_areaid'),
    areaNombre: nombreBusqueda(f, 'vu_areaid'),
    fechaHora: fechaHora(f, 'vu_fechahora'),
    modalidad: modalidadEntrevista(numeroONull(f, 'vu_modalidad')),
    estado: ESTADO_ENTREVISTA.aTexto(numero(f, 'vu_estadoentrevista', ESTADO_ENTREVISTA.valores.Pendiente)),
    urlGrabacion: textoONull(f, 'vu_urlgrabacion'),
    oportunidadesMejora: texto(f, 'vu_oportunidadesmejora'),
    recomendaciones: texto(f, 'vu_recomendaciones'),
    fechaCompletada: fechaHora(f, 'vu_fechacompletada'),
  };
}

/**
 * El entrevistado puede no ser usuario del entorno: el correo se guarda siempre en
 * `vu_entrevistadocorreo` y la búsqueda `vu_EntrevistadoId` solo si se conoce su `systemuserid`.
 */
export function entrevistaARegistro(c: Cambios<Entrevista>): Registro {
  let entrevistado: Registro = {};
  if (c.entrevistado !== undefined) {
    const p = c.entrevistado;
    entrevistado = {
      vu_entrevistadocorreo: p?.email ? p.email : null,
      ...bind('vu_EntrevistadoId', CONJUNTOS.usuario, p?.id ?? null),
    };
  }
  return sinIndefinidos({
    vu_name: c.titulo,
    ...(c.verificacionId !== undefined ? bind('vu_VerificacionId', CONJUNTOS.verificacion, c.verificacionId) : {}),
    vu_numero: c.numero,
    ...entrevistado,
    vu_entrevistadonombre: c.entrevistadoNombre,
    ...(c.areaId !== undefined ? bind('vu_AreaId', CONJUNTOS.area, c.areaId) : {}),
    vu_fechahora: c.fechaHora,
    vu_modalidad: c.modalidad === undefined ? undefined : c.modalidad === null ? null : MODALIDAD.aNumero(c.modalidad),
    vu_estadoentrevista: c.estado === undefined ? undefined : ESTADO_ENTREVISTA.aNumero(c.estado),
    vu_urlgrabacion: opcionalTexto(c.urlGrabacion),
    vu_oportunidadesmejora: opcionalTexto(c.oportunidadesMejora),
    vu_recomendaciones: opcionalTexto(c.recomendaciones),
    vu_fechacompletada: c.fechaCompletada,
  });
}

/** Al crear, las búsquedas opcionales vacías no se envían (un bind nulo en POST no aporta nada). */
export function sinBindsNulos(registro: Registro): Registro {
  return Object.fromEntries(Object.entries(registro).filter(([k, v]) => !(k.endsWith('@odata.bind') && v === null)));
}

export function respuestaDesdeFila(f: Fila): Respuesta {
  return {
    id: idObligatorio(f, 'vu_respuestaid'),
    titulo: texto(f, 'vu_name'),
    entrevistaId: busqueda(f, 'vu_entrevistaid'),
    verificacionId: busqueda(f, 'vu_verificacionid'),
    origen: ORIGEN_RESPUESTA.aTexto(numero(f, 'vu_origen', ORIGEN_RESPUESTA.valores.Definida)),
    preguntaId: leerId(f, 'vu_preguntaid'),
    criterioId: busqueda(f, 'vu_criterioid'),
    opcionId: leerId(f, 'vu_opcionid'),
    respuestaTexto: texto(f, 'vu_respuestatexto'),
    puntaje: numeroONull(f, 'vu_puntaje'),
    sustento: texto(f, 'vu_sustento'),
    orden: numero(f, 'vu_orden'),
  };
}

export function respuestaARegistro(c: Cambios<Respuesta>): Registro {
  return sinIndefinidos({
    vu_name: c.titulo,
    ...(c.entrevistaId !== undefined ? bind('vu_EntrevistaId', CONJUNTOS.entrevista, c.entrevistaId) : {}),
    ...(c.verificacionId !== undefined ? bind('vu_VerificacionId', CONJUNTOS.verificacion, c.verificacionId) : {}),
    vu_origen: c.origen === undefined ? undefined : ORIGEN_RESPUESTA.aNumero(c.origen),
    ...(c.preguntaId !== undefined ? bind('vu_PreguntaId', CONJUNTOS.pregunta, c.preguntaId) : {}),
    ...(c.criterioId !== undefined ? bind('vu_CriterioId', CONJUNTOS.criterio, c.criterioId) : {}),
    ...(c.opcionId !== undefined ? bind('vu_OpcionId', CONJUNTOS.opcion, c.opcionId) : {}),
    vu_respuestatexto: opcionalTexto(c.respuestaTexto),
    vu_puntaje: c.puntaje,
    vu_sustento: opcionalTexto(c.sustento),
    vu_orden: c.orden,
  });
}

export function evidenciaDesdeFila(f: Fila): Evidencia {
  return {
    id: idObligatorio(f, 'vu_evidenciaid'),
    nombreArchivo: texto(f, 'vu_name'),
    url: null,
    verificacionId: busqueda(f, 'vu_verificacionid'),
    entrevistaId: busqueda(f, 'vu_entrevistaid'),
    respuestaId: leerId(f, 'vu_respuestaid'),
    tipo: TIPO_EVIDENCIA.aTexto(numero(f, 'vu_tipoevidencia', TIPO_EVIDENCIA.valores.Captura)),
  };
}

export function evidenciaARegistro(c: Cambios<Evidencia>): Registro {
  return sinIndefinidos({
    vu_name: c.nombreArchivo,
    ...(c.verificacionId !== undefined ? bind('vu_VerificacionId', CONJUNTOS.verificacion, c.verificacionId) : {}),
    ...(c.entrevistaId !== undefined ? bind('vu_EntrevistaId', CONJUNTOS.entrevista, c.entrevistaId) : {}),
    ...(c.respuestaId !== undefined ? bind('vu_RespuestaId', CONJUNTOS.respuesta, c.respuestaId) : {}),
    vu_tipoevidencia: c.tipo === undefined ? undefined : TIPO_EVIDENCIA.aNumero(c.tipo),
  });
}

export function puntajeDesdeFila(f: Fila): PuntajeCriterio {
  return {
    id: idObligatorio(f, 'vu_puntajecriterioid'),
    titulo: texto(f, 'vu_name'),
    verificacionId: busqueda(f, 'vu_verificacionid'),
    criterioId: busqueda(f, 'vu_criterioid'),
    peso: numero(f, 'vu_peso'),
    puntajeSugerido: numeroONull(f, 'vu_puntajesugerido'),
    puntajeFinal: numero(f, 'vu_puntajefinal'),
    sustentoAjuste: texto(f, 'vu_sustentoajuste'),
  };
}

export function puntajeARegistro(c: Cambios<PuntajeCriterio>): Registro {
  return sinIndefinidos({
    vu_name: c.titulo,
    ...(c.verificacionId !== undefined ? bind('vu_VerificacionId', CONJUNTOS.verificacion, c.verificacionId) : {}),
    ...(c.criterioId !== undefined ? bind('vu_CriterioId', CONJUNTOS.criterio, c.criterioId) : {}),
    vu_peso: c.peso,
    vu_puntajesugerido: c.puntajeSugerido,
    vu_puntajefinal: c.puntajeFinal,
    vu_sustentoajuste: opcionalTexto(c.sustentoAjuste),
  });
}

export function cambioPuntajeDesdeFila(f: Fila): CambioPuntaje {
  return {
    id: idObligatorio(f, 'vu_historialpuntajeid'),
    titulo: texto(f, 'vu_name'),
    respuestaId: busqueda(f, 'vu_respuestaid'),
    verificacionId: busqueda(f, 'vu_verificacionid'),
    puntajeAnterior: numeroONull(f, 'vu_puntajeanterior'),
    puntajeNuevo: numeroONull(f, 'vu_puntajenuevo'),
    autor: personaDeBusqueda(f, 'createdby'),
    fecha: fechaHora(f, 'modifiedon') ?? '',
  };
}

export function cambioPuntajeARegistro(c: Partial<Omit<CambioPuntaje, 'id' | 'autor' | 'fecha'>>): Registro {
  return sinIndefinidos({
    vu_name: c.titulo === undefined ? undefined : c.titulo.slice(0, 500),
    ...(c.respuestaId !== undefined ? bind('vu_RespuestaId', CONJUNTOS.respuesta, c.respuestaId) : {}),
    ...(c.verificacionId !== undefined ? bind('vu_VerificacionId', CONJUNTOS.verificacion, c.verificacionId) : {}),
    vu_puntajeanterior: c.puntajeAnterior,
    vu_puntajenuevo: c.puntajeNuevo,
  });
}

export function aprobacionDesdeFila(f: Fila): Aprobacion {
  return {
    id: idObligatorio(f, 'vu_aprobacionid'),
    titulo: texto(f, 'vu_name'),
    verificacionId: busqueda(f, 'vu_verificacionid'),
    nivel: NIVEL_APROBACION.aTexto(numero(f, 'vu_nivel', NIVEL_APROBACION.valores.Piloto)),
    aprobador: personaDeBusqueda(f, 'vu_aprobadorid') ?? { id: null, nombre: '', email: '' },
    decision: DECISION_APROBACION.aTexto(numero(f, 'vu_decision', DECISION_APROBACION.valores.Pendiente)),
    comentario: texto(f, 'vu_comentario'),
    fechaSolicitud: fechaHora(f, 'vu_fechasolicitud') ?? '',
    fechaDecision: fechaHora(f, 'vu_fechadecision'),
    approvalId: textoONull(f, 'vu_approvalid'),
  };
}
