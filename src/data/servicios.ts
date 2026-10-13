import { formatearCodigoVU, tituloEntrevista } from '../domain/codigo';
import { ahoraISO, calcularFechaAlerta } from '../domain/fechas';
import {
  aplicarSugerido,
  indiceAdopcion,
  PUNTAJE_INICIAL,
  puntajeSugerido,
  resultado,
} from '../domain/evaluacion';
import {
  admiteEntrevistas,
  contarCompletas,
  esEditableDesdeApp,
  esVerificacionActiva,
  puedeFinalizar,
  puedeTransicionarDesdeApp,
  validarEnvio,
  validarProgramacion,
  validarRespuestasDefinidas,
} from '../domain/flujo';
import type {
  DiasAnticipacion,
  Entrevista,
  EstadoVerificacion,
  FechaHoraISO,
  FechaISO,
  Id,
  Modalidad,
  ModalidadEntrevista,
  Persona,
  PuntajeCriterio,
  Respuesta,
  Verificacion,
} from '../domain/tipos';
import { ErrorNoEncontrado, ErrorValidacion } from './errores';
import type { Cambios, Repositorios } from './repositorios';

/**
 * Servicios de aplicación: operaciones de varios pasos sin transacciones (§3.4).
 * Cada paso es idempotente: se puede reintentar sin descuadrar los datos
 * (se crea si falta, se recuenta en lugar de sumar, los derivados se regeneran).
 * Ninguna operación de este módulo notifica: las notificaciones las disparan los
 * flujos al pasar a "Programada" (F1, por fecha) o "En revisión" (F2) — RN-06.
 */

async function obtenerVerificacion(repos: Repositorios, id: Id): Promise<Verificacion> {
  const v = await repos.verificaciones.obtener(id);
  if (!v) throw new ErrorNoEncontrado('la verificación', id);
  return v;
}

async function obtenerEntrevista(repos: Repositorios, id: Id): Promise<Entrevista> {
  const e = await repos.entrevistas.obtener(id);
  if (!e) throw new ErrorNoEncontrado('la entrevista', id);
  return e;
}

async function cambiarEstado(
  repos: Repositorios,
  v: Verificacion,
  hacia: EstadoVerificacion,
  extra: Cambios<Verificacion> = {},
): Promise<Verificacion> {
  if (v.estado === hacia) return v;
  if (!puedeTransicionarDesdeApp(v.estado, hacia)) {
    throw new ErrorValidacion([`Transición no permitida: ${v.estado} → ${hacia}.`]);
  }
  return repos.verificaciones.actualizar(v.id, { ...extra, estado: hacia });
}

// ---------------------------------------------------------------------------
// Programación
// ---------------------------------------------------------------------------

export interface DatosProgramacion {
  solucionId: Id;
  responsable: Persona;
  fechaObjetivo: FechaISO;
  diasAnticipacion: DiasAnticipacion;
  entrevistasPrevistas: number;
  modalidad: Modalidad;
  objetivo: string;
}

/**
 * Pasos 2 y 3 de "Programar verificación", reintentables al abrirla:
 * escribe `Title = VU-{ID}` y crea las filas de puntaje por criterio activo con el peso copiado.
 */
export async function asegurarIntegridad(repos: Repositorios, verificacion: Verificacion): Promise<Verificacion> {
  let v = verificacion;
  if (!v.codigo) v = await repos.verificaciones.actualizar(v.id, { codigo: formatearCodigoVU(v.id) });
  if (!esEditableDesdeApp(v.estado)) return v;

  const [criterios, puntajes] = await Promise.all([
    repos.catalogo.listarCriterios(),
    repos.puntajes.listarPorVerificacion(v.id),
  ]);
  const faltantes = criterios.filter((c) => c.activo && !puntajes.some((p) => p.criterioId === c.id));
  for (const c of faltantes) {
    await repos.puntajes.crear({
      titulo: c.titulo,
      verificacionId: v.id,
      criterioId: c.id,
      peso: c.peso,
      puntajeSugerido: null,
      puntajeFinal: PUNTAJE_INICIAL,
      sustentoAjuste: '',
    });
  }
  return v;
}

/** Abre una verificación reparando los pasos que hubieran quedado pendientes. */
export async function abrirVerificacion(repos: Repositorios, id: Id): Promise<Verificacion> {
  return asegurarIntegridad(repos, await obtenerVerificacion(repos, id));
}

/**
 * "Guardar borrador" (activar = false) o "Programar y activar alerta" (activar = true).
 * Crea o actualiza la verificación, calcula la fecha de alerta (RN-01) y asegura código y puntajes.
 */
export async function programarVerificacion(
  repos: Repositorios,
  datos: DatosProgramacion,
  opciones: { activar: boolean; verificacionId?: Id },
): Promise<Verificacion> {
  const errores = validarProgramacion(datos);
  if (errores.length > 0) throw new ErrorValidacion(errores);
  const fechaAlerta = calcularFechaAlerta(datos.fechaObjetivo, datos.diasAnticipacion);

  let v: Verificacion;
  if (opciones.verificacionId !== undefined) {
    const actual = await obtenerVerificacion(repos, opciones.verificacionId);
    if (actual.estado !== 'Borrador' && actual.estado !== 'Programada') {
      throw new ErrorValidacion([`La programación ya no se puede modificar (estado "${actual.estado}").`]);
    }
    const cambios: Cambios<Verificacion> = { ...datos, fechaAlerta };
    // Si cambia la fecha de alerta, el flujo F1 debe volver a avisar.
    if (actual.fechaAlerta !== fechaAlerta) cambios.alertaEnviada = false;
    v = await repos.verificaciones.actualizar(actual.id, cambios);
  } else {
    const existentes = await repos.verificaciones.listar({ solucionId: datos.solucionId });
    const activa = existentes.find((x) => esVerificacionActiva(x.estado));
    if (activa) {
      throw new ErrorValidacion([
        `La solución ya tiene la verificación ${activa.codigo || `#${activa.id}`} en estado "${activa.estado}".`,
      ]);
    }
    v = await repos.verificaciones.crear({
      ...datos,
      codigo: '',
      solucionNombre: '',
      fechaAlerta,
      alertaEnviada: false,
      entrevistasCompletas: 0,
      estado: 'Borrador',
      indiceAdopcion: null,
      resultado: null,
      sustentoGlobal: '',
      oportunidadesConsolidadas: '',
      recomendacionesConsolidadas: '',
      aprobadorPiloto: null,
      aprobadorProductivo: null,
      notificarAlFinalizar: false,
      fechaEnvio: null,
      fechaAprobacion: null,
    });
  }

  v = await asegurarIntegridad(repos, v);
  if (opciones.activar) v = await cambiarEstado(repos, v, 'Programada');
  return v;
}

export async function cancelarVerificacion(repos: Repositorios, id: Id): Promise<Verificacion> {
  return cambiarEstado(repos, await obtenerVerificacion(repos, id), 'Cancelada');
}

// ---------------------------------------------------------------------------
// Entrevistas
// ---------------------------------------------------------------------------

/**
 * Recuenta las entrevistas completas (nunca `+1`) y avanza el estado si corresponde:
 * Programada → En levantamiento (hay alguna iniciada) → En evaluación (completas = previstas).
 */
export async function recontarCompletas(repos: Repositorios, verificacionId: Id): Promise<Verificacion> {
  const [v, entrevistas] = await Promise.all([
    obtenerVerificacion(repos, verificacionId),
    repos.entrevistas.listarPorVerificacion(verificacionId),
  ]);
  const completas = contarCompletas(entrevistas);
  const cambios: Cambios<Verificacion> = {};
  if (v.entrevistasCompletas !== completas) cambios.entrevistasCompletas = completas;

  let estado = v.estado;
  if (estado === 'Programada' && entrevistas.some((e) => e.estado !== 'Pendiente')) estado = 'En levantamiento';
  if (
    estado === 'En levantamiento' &&
    puedeFinalizar({ entrevistasCompletas: completas, entrevistasPrevistas: v.entrevistasPrevistas })
  ) {
    estado = 'En evaluación';
  }
  if (estado !== v.estado) cambios.estado = estado;

  return Object.keys(cambios).length > 0 ? repos.verificaciones.actualizar(v.id, cambios) : v;
}

export interface DatosNuevaEntrevista {
  entrevistado: Persona | null;
  entrevistadoNombre: string;
  areaId: Id | null;
  fechaHora: FechaHoraISO | null;
  modalidad: ModalidadEntrevista | null;
}

/** Agrega una entrevista. Si supera las previstas, actualiza las previstas para no romper RN-07. */
export async function agregarEntrevista(
  repos: Repositorios,
  verificacionId: Id,
  datos: DatosNuevaEntrevista,
): Promise<Entrevista> {
  const v = await obtenerVerificacion(repos, verificacionId);
  if (!admiteEntrevistas(v.estado)) {
    throw new ErrorValidacion([`No se pueden registrar entrevistas en estado "${v.estado}".`]);
  }
  const nombre = (datos.entrevistado?.nombre ?? datos.entrevistadoNombre).trim();
  if (!nombre) throw new ErrorValidacion(['Indica a la persona entrevistada.']);

  const existentes = await repos.entrevistas.listarPorVerificacion(verificacionId);
  const numero = existentes.reduce((max, e) => Math.max(max, e.numero), 0) + 1;
  const nueva = await repos.entrevistas.crear({
    verificacionId,
    numero,
    titulo: tituloEntrevista(numero, nombre),
    entrevistado: datos.entrevistado,
    entrevistadoNombre: nombre,
    areaId: datos.areaId,
    areaNombre: null,
    fechaHora: datos.fechaHora,
    modalidad: datos.modalidad,
    estado: 'Pendiente',
    urlGrabacion: null,
    oportunidadesMejora: '',
    recomendaciones: '',
    fechaCompletada: null,
  });
  const total = existentes.length + 1;
  if (total > v.entrevistasPrevistas) {
    await repos.verificaciones.actualizar(v.id, { entrevistasPrevistas: total });
  }
  return nueva;
}

/** `Title` es obligatorio en SharePoint: texto de respaldo para preguntas surgidas sin redactar. */
export const TITULO_SURGIDA_PREDETERMINADO = 'Pregunta surgida en la reunión';

function normalizarRespuesta(cambios: Cambios<Respuesta>): Cambios<Respuesta> {
  if (cambios.titulo !== undefined && !cambios.titulo.trim()) {
    return { ...cambios, titulo: TITULO_SURGIDA_PREDETERMINADO };
  }
  return cambios;
}

function ordenarRespuestas(respuestas: Respuesta[]): Respuesta[] {
  const peso = (r: Respuesta) => (r.origen === 'Definida' ? 0 : 1);
  return [...respuestas].sort((a, b) => peso(a) - peso(b) || a.orden - b.orden || a.id - b.id);
}

/**
 * Respuestas de una entrevista, creando (si faltan) las de las preguntas definidas activas
 * con puntaje vacío. Idempotente; solo escribe si la verificación admite entrevistas.
 */
export async function prepararRespuestasEntrevista(repos: Repositorios, entrevistaId: Id): Promise<Respuesta[]> {
  const e = await obtenerEntrevista(repos, entrevistaId);
  const v = await obtenerVerificacion(repos, e.verificacionId);
  const [preguntas, respuestas] = await Promise.all([
    repos.catalogo.listarPreguntas(),
    repos.respuestas.listarPorEntrevista(entrevistaId),
  ]);
  if (admiteEntrevistas(v.estado)) {
    const faltantes = preguntas.filter(
      (p) => p.activo && !respuestas.some((r) => r.origen === 'Definida' && r.preguntaId === p.id),
    );
    for (const p of faltantes) {
      respuestas.push(
        await repos.respuestas.crear({
          titulo: p.titulo,
          entrevistaId,
          verificacionId: e.verificacionId,
          origen: 'Definida',
          preguntaId: p.id,
          criterioId: p.criterioId,
          opcionId: null,
          respuestaTexto: '',
          puntaje: null,
          sustento: '',
          orden: p.orden,
        }),
      );
    }
  }
  return ordenarRespuestas(respuestas);
}

/** "Agregar pregunta surgida en la reunión". */
export async function agregarPreguntaSurgida(
  repos: Repositorios,
  entrevista: Pick<Entrevista, 'id' | 'verificacionId'>,
  criterioId: Id,
): Promise<Respuesta> {
  const existentes = await repos.respuestas.listarPorEntrevista(entrevista.id);
  const orden = existentes.reduce((max, r) => Math.max(max, r.orden), 0) + 1;
  return repos.respuestas.crear({
    titulo: TITULO_SURGIDA_PREDETERMINADO,
    entrevistaId: entrevista.id,
    verificacionId: entrevista.verificacionId,
    origen: 'Surgida en reunión',
    preguntaId: null,
    criterioId,
    opcionId: null,
    respuestaTexto: '',
    puntaje: null,
    sustento: '',
    orden,
  });
}

export interface CambiosBorradorEntrevista {
  entrevista: Cambios<Entrevista>;
  respuestas: { id: Id; cambios: Cambios<Respuesta> }[];
}

/**
 * Autoguardado / "Guardar avance sin notificar": escribe solo los campos modificados.
 * La primera vez que se toca una entrevista Pendiente pasa a "En curso" (y la verificación
 * Programada a "En levantamiento"). Nunca notifica (RN-06).
 */
export async function guardarBorradorEntrevista(
  repos: Repositorios,
  entrevistaId: Id,
  cambios: CambiosBorradorEntrevista,
): Promise<Entrevista> {
  let e = await obtenerEntrevista(repos, entrevistaId);
  const cambiosEntrevista: Cambios<Entrevista> = { ...cambios.entrevista };
  if (e.estado === 'Pendiente') cambiosEntrevista.estado = 'En curso';
  if (Object.keys(cambiosEntrevista).length > 0) e = await repos.entrevistas.actualizar(e.id, cambiosEntrevista);
  for (const r of cambios.respuestas) {
    if (Object.keys(r.cambios).length > 0) await repos.respuestas.actualizar(r.id, normalizarRespuesta(r.cambios));
  }
  if (cambiosEntrevista.estado) await recontarCompletas(repos, e.verificacionId);
  return e;
}

/** Marca la entrevista como Completa y recuenta (idempotente). Valida las preguntas definidas. */
export async function completarEntrevista(repos: Repositorios, entrevistaId: Id): Promise<Verificacion> {
  const e = await obtenerEntrevista(repos, entrevistaId);
  const v = await obtenerVerificacion(repos, e.verificacionId);
  if (!admiteEntrevistas(v.estado)) {
    throw new ErrorValidacion([`No se pueden completar entrevistas en estado "${v.estado}".`]);
  }
  const [preguntas, respuestas] = await Promise.all([
    repos.catalogo.listarPreguntas(),
    repos.respuestas.listarPorEntrevista(e.id),
  ]);
  const errores = validarRespuestasDefinidas(
    preguntas.filter((p) => p.activo),
    respuestas,
  );
  if (errores.length > 0) throw new ErrorValidacion(errores);

  if (e.estado !== 'Completa') {
    await repos.entrevistas.actualizar(e.id, { estado: 'Completa', fechaCompletada: ahoraISO() });
  }
  return recontarCompletas(repos, e.verificacionId);
}

/** Solo demo (modo mock): replica el botón "Simular todas las entrevistas completas" del prototipo. */
export async function simularLevantamientoCompleto(repos: Repositorios, verificacionId: Id): Promise<Verificacion> {
  const v = await obtenerVerificacion(repos, verificacionId);
  if (!admiteEntrevistas(v.estado)) {
    throw new ErrorValidacion([`No se pueden completar entrevistas en estado "${v.estado}".`]);
  }
  const entrevistas = await repos.entrevistas.listarPorVerificacion(verificacionId);
  for (const e of entrevistas) {
    if (e.estado !== 'Completa') {
      await repos.entrevistas.actualizar(e.id, { estado: 'Completa', fechaCompletada: ahoraISO() });
    }
  }
  for (let n = entrevistas.length + 1; n <= v.entrevistasPrevistas; n++) {
    await repos.entrevistas.crear({
      verificacionId,
      numero: n,
      titulo: tituloEntrevista(n, 'Entrevista simulada'),
      entrevistado: null,
      entrevistadoNombre: 'Entrevista simulada',
      areaId: null,
      areaNombre: null,
      fechaHora: ahoraISO(),
      modalidad: 'Teams',
      estado: 'Completa',
      urlGrabacion: null,
      oportunidadesMejora: '',
      recomendaciones: '',
      fechaCompletada: ahoraISO(),
    });
  }
  return recontarCompletas(repos, verificacionId);
}

// ---------------------------------------------------------------------------
// Evaluación
// ---------------------------------------------------------------------------

/**
 * "Abrir Evaluación": recalcula el puntaje sugerido de cada criterio (RN-04) a partir de las
 * respuestas de las entrevistas completas. Valor derivado: se puede regenerar siempre.
 * Devuelve los puntajes en el orden de los criterios.
 */
export async function recalcularSugeridos(repos: Repositorios, verificacionId: Id): Promise<PuntajeCriterio[]> {
  const v = await abrirVerificacion(repos, verificacionId);
  const [criterios, entrevistas, respuestas, puntajes] = await Promise.all([
    repos.catalogo.listarCriterios(),
    repos.entrevistas.listarPorVerificacion(verificacionId),
    repos.respuestas.listarPorVerificacion(verificacionId),
    repos.puntajes.listarPorVerificacion(verificacionId),
  ]);
  const orden = new Map(criterios.map((c) => [c.id, c.orden]));
  const editable = esEditableDesdeApp(v.estado);

  const resultadoPuntajes: PuntajeCriterio[] = [];
  for (const p of puntajes) {
    if (!editable) {
      resultadoPuntajes.push(p);
      continue;
    }
    const nuevo = aplicarSugerido(p, puntajeSugerido(p.criterioId, respuestas, entrevistas));
    if (nuevo.puntajeSugerido !== p.puntajeSugerido || nuevo.puntajeFinal !== p.puntajeFinal) {
      resultadoPuntajes.push(
        await repos.puntajes.actualizar(p.id, {
          puntajeSugerido: nuevo.puntajeSugerido,
          puntajeFinal: nuevo.puntajeFinal,
        }),
      );
    } else {
      resultadoPuntajes.push(p);
    }
  }
  return resultadoPuntajes.sort((a, b) => (orden.get(a.criterioId) ?? 0) - (orden.get(b.criterioId) ?? 0));
}

/** "Guardar evaluación en borrador": puntajes finales, sustentos e índice preliminar (RN-03/RN-09). */
export async function guardarEvaluacion(
  repos: Repositorios,
  verificacionId: Id,
  puntajes: readonly PuntajeCriterio[],
  sustentoGlobal: string,
): Promise<Verificacion> {
  const v = await obtenerVerificacion(repos, verificacionId);
  if (!esEditableDesdeApp(v.estado)) {
    throw new ErrorValidacion([`La evaluación no se puede modificar en estado "${v.estado}".`]);
  }
  const actuales = await repos.puntajes.listarPorVerificacion(verificacionId);
  for (const p of puntajes) {
    const actual = actuales.find((a) => a.id === p.id);
    if (!actual) continue;
    if (actual.puntajeFinal !== p.puntajeFinal || actual.sustentoAjuste !== p.sustentoAjuste) {
      await repos.puntajes.actualizar(p.id, { puntajeFinal: p.puntajeFinal, sustentoAjuste: p.sustentoAjuste });
    }
  }
  const indice = indiceAdopcion(puntajes);
  return repos.verificaciones.actualizar(v.id, {
    sustentoGlobal,
    indiceAdopcion: indice,
    resultado: resultado(indice),
  });
}

// ---------------------------------------------------------------------------
// Consolidación y envío
// ---------------------------------------------------------------------------

export interface DatosConsolidado {
  oportunidadesConsolidadas: string;
  recomendacionesConsolidadas: string;
  aprobadorPiloto: Persona | null;
  aprobadorProductivo: Persona | null;
  notificarAlFinalizar: boolean;
}

/** "Guardar borrador sin notificar" en la revisión final. */
export async function guardarConsolidado(
  repos: Repositorios,
  verificacionId: Id,
  datos: DatosConsolidado,
): Promise<Verificacion> {
  const v = await obtenerVerificacion(repos, verificacionId);
  if (!esEditableDesdeApp(v.estado)) {
    throw new ErrorValidacion([`El consolidado no se puede modificar en estado "${v.estado}".`]);
  }
  return repos.verificaciones.actualizar(v.id, { ...datos });
}

/**
 * "Finalizar y enviar a revisión": revalida RN-07 (recontando), RN-05 y la aprobadora,
 * guarda el consolidado, el índice y el resultado y pone `Estado = En revisión`,
 * lo que dispara F2 (primera notificación a la aprobadora, RN-06/RN-08).
 */
export async function finalizarYEnviar(
  repos: Repositorios,
  verificacionId: Id,
  datos: DatosConsolidado,
): Promise<Verificacion> {
  let v = await recontarCompletas(repos, verificacionId);
  const puntajes = await repos.puntajes.listarPorVerificacion(verificacionId);
  const errores = validarEnvio({ ...v, aprobadorPiloto: datos.aprobadorPiloto }, puntajes);
  if (errores.length > 0) throw new ErrorValidacion(errores);

  const indice = indiceAdopcion(puntajes);
  v = await repos.verificaciones.actualizar(v.id, {
    ...datos,
    indiceAdopcion: indice,
    resultado: resultado(indice),
  });
  // Observada → En evaluación ("Corregir") y En levantamiento → En evaluación antes del envío.
  if (v.estado === 'Observada' || v.estado === 'En levantamiento') v = await cambiarEstado(repos, v, 'En evaluación');
  return cambiarEstado(repos, v, 'En revisión', { fechaEnvio: ahoraISO() });
}
