import { compararFechas, esFechaValida } from './fechas';
import { faltaSustento } from './evaluacion';
import {
  DIAS_ANTICIPACION,
  type Entrevista,
  type EstadoVerificacion,
  type EstadoVU,
  type FechaISO,
  type Id,
  type Pregunta,
  type PuntajeCriterio,
  type Respuesta,
  type Verificacion,
} from './tipos';

// ---------------------------------------------------------------------------
// Estados de la verificación (§2.4)
// ---------------------------------------------------------------------------

export const TRANSICIONES: Readonly<Record<EstadoVerificacion, readonly EstadoVerificacion[]>> = {
  Borrador: ['Programada', 'Cancelada'],
  Programada: ['En levantamiento', 'Cancelada'],
  'En levantamiento': ['En evaluación'],
  'En evaluación': ['En revisión'],
  'En revisión': ['Observada', 'Aprobada piloto'],
  Observada: ['En evaluación'],
  'Aprobada piloto': ['Aprobada'],
  Aprobada: [],
  Cancelada: [],
};

/** Estados que solo escribe el flujo F2 (la app solo puede llegar hasta "En revisión"). */
export const ESTADOS_ESCRITOS_POR_FLUJO: readonly EstadoVerificacion[] = ['Observada', 'Aprobada piloto', 'Aprobada'];

export function puedeTransicionar(desde: EstadoVerificacion, hacia: EstadoVerificacion): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export function puedeTransicionarDesdeApp(desde: EstadoVerificacion, hacia: EstadoVerificacion): boolean {
  return puedeTransicionar(desde, hacia) && !ESTADOS_ESCRITOS_POR_FLUJO.includes(hacia);
}

/** La app puede editar la verificación mientras no se haya enviado a revisión (u observada para corregir). */
export function esEditableDesdeApp(estado: EstadoVerificacion): boolean {
  return ['Borrador', 'Programada', 'En levantamiento', 'En evaluación', 'Observada'].includes(estado);
}

/** Se pueden registrar entrevistas una vez programada y hasta antes del envío. */
export function admiteEntrevistas(estado: EstadoVerificacion): boolean {
  return ['Programada', 'En levantamiento', 'En evaluación', 'Observada'].includes(estado);
}

/** Verificación "viva": impide programar otra para la misma solución. */
export function esVerificacionActiva(estado: EstadoVerificacion): boolean {
  return estado !== 'Aprobada' && estado !== 'Cancelada';
}

/** Antes de "En revisión" nada notifica a la aprobadora (RN-06). */
export function estaSinNotificar(estado: EstadoVerificacion): boolean {
  return ['Borrador', 'Programada', 'En levantamiento', 'En evaluación'].includes(estado);
}

// ---------------------------------------------------------------------------
// Progreso y finalización
// ---------------------------------------------------------------------------

export function contarCompletas(entrevistas: readonly Pick<Entrevista, 'estado'>[]): number {
  return entrevistas.filter((e) => e.estado === 'Completa').length;
}

/** RN-02: progreso del levantamiento en porcentaje entero (0–100). */
export function progreso(completas: number, previstas: number): number {
  if (previstas <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completas / previstas) * 100)));
}

/** RN-07: solo se finaliza cuando las entrevistas completas alcanzan las previstas. */
export function puedeFinalizar(v: Pick<Verificacion, 'entrevistasCompletas' | 'entrevistasPrevistas'>): boolean {
  return v.entrevistasPrevistas > 0 && v.entrevistasCompletas >= v.entrevistasPrevistas;
}

/**
 * Motivos que impiden "Finalizar y enviar". Lista vacía = se puede enviar.
 * Revalida RN-07, RN-05, la aprobadora del piloto y el estado.
 */
export function validarEnvio(
  v: Pick<Verificacion, 'estado' | 'entrevistasCompletas' | 'entrevistasPrevistas' | 'aprobadorPiloto'>,
  puntajes: readonly Pick<PuntajeCriterio, 'titulo' | 'puntajeFinal' | 'puntajeSugerido' | 'sustentoAjuste'>[],
): string[] {
  const errores: string[] = [];
  if (!['En levantamiento', 'En evaluación', 'Observada'].includes(v.estado)) {
    errores.push(`La verificación está en estado "${v.estado}" y no se puede enviar a revisión.`);
  }
  if (!puedeFinalizar(v)) {
    errores.push(
      `El levantamiento aún está incompleto (${v.entrevistasCompletas} de ${v.entrevistasPrevistas} entrevistas).`,
    );
  }
  if (puntajes.length === 0) errores.push('No hay puntajes por criterio.');
  for (const p of puntajes) {
    if (faltaSustento(p)) errores.push(`Falta el sustento del ajuste de ${p.titulo}.`);
  }
  if (!v.aprobadorPiloto) errores.push('Indica la aprobadora del piloto.');
  return errores;
}

// ---------------------------------------------------------------------------
// Validaciones de formularios
// ---------------------------------------------------------------------------

export interface DatosProgramacionValidables {
  solucionId: Id | null;
  responsable: { email: string } | null;
  fechaObjetivo: string;
  diasAnticipacion: number;
  entrevistasPrevistas: number;
}

export function validarProgramacion(d: DatosProgramacionValidables): string[] {
  const errores: string[] = [];
  if (!d.solucionId) errores.push('Selecciona la solución digital.');
  if (!d.responsable?.email) errores.push('Indica la persona responsable de la verificación.');
  if (!esFechaValida(d.fechaObjetivo)) errores.push('Indica una fecha objetivo válida.');
  if (!(DIAS_ANTICIPACION as readonly number[]).includes(d.diasAnticipacion)) {
    errores.push('La anticipación del aviso debe ser de 7, 15 o 30 días.');
  }
  if (!Number.isInteger(d.entrevistasPrevistas) || d.entrevistasPrevistas < 1 || d.entrevistasPrevistas > 20) {
    errores.push('Las entrevistas previstas deben estar entre 1 y 20.');
  }
  return errores;
}

/**
 * Para completar una entrevista, toda pregunta definida activa y **obligatoria** debe tener
 * una respuesta con puntaje (§2.3). Las no obligatorias pueden quedar sin puntaje (no aplica).
 */
export function validarRespuestasDefinidas(
  preguntasActivas: readonly Pick<Pregunta, 'id' | 'titulo' | 'obligatoria'>[],
  respuestasDeEntrevista: readonly Pick<Respuesta, 'preguntaId' | 'origen' | 'puntaje'>[],
): string[] {
  const errores: string[] = [];
  for (const pregunta of preguntasActivas) {
    if (!pregunta.obligatoria) continue;
    const r = respuestasDeEntrevista.find((x) => x.origen === 'Definida' && x.preguntaId === pregunta.id);
    if (!r) errores.push(`Falta responder: "${pregunta.titulo}".`);
    else if (r.puntaje === null) errores.push(`Falta el puntaje de: "${pregunta.titulo}".`);
  }
  return errores;
}

// ---------------------------------------------------------------------------
// Estado derivado de la solución (§2.5)
// ---------------------------------------------------------------------------

/**
 * EstadoVU de la solución según su última verificación. Un borrador o una
 * verificación cancelada no cuentan como verificación (equivalen a "no existe").
 */
export function estadoSolucion(
  ultima: Pick<Verificacion, 'estado'> | null,
  proximaVU: FechaISO | null,
  hoy: FechaISO,
): EstadoVU {
  const estado = ultima?.estado;
  switch (estado) {
    case 'Programada':
      return 'Programada';
    case 'En levantamiento':
    case 'En evaluación':
    case 'Observada':
      return 'En proceso';
    case 'En revisión':
    case 'Aprobada piloto':
      return 'En revisión';
    case 'Aprobada':
      return proximaVU && compararFechas(proximaVU, hoy) >= 0 ? 'Vigente' : 'Pendiente';
    default:
      return 'Pendiente';
  }
}

// ---------------------------------------------------------------------------
// Stepper: Programación → Entrevistas → Evaluación → Consolidación → Aprobación
// ---------------------------------------------------------------------------

export const ETAPAS = ['Programación', 'Entrevistas', 'Evaluación', 'Consolidación', 'Aprobación'] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Qué etapas están terminadas según el estado y el avance de la verificación. */
export function etapasCompletadas(
  v: Pick<Verificacion, 'estado' | 'entrevistasCompletas' | 'entrevistasPrevistas'>,
): boolean[] {
  const enviada = ['En revisión', 'Aprobada piloto', 'Aprobada'].includes(v.estado);
  return [
    v.estado !== 'Borrador' && v.estado !== 'Cancelada',
    enviada || puedeFinalizar(v),
    enviada,
    enviada,
    v.estado === 'Aprobada',
  ];
}
