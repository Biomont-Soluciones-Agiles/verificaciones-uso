import type { Cambios } from '../../data/repositorios';
import type { CambiosBorradorEntrevista } from '../../data/servicios';
import type { Entrevista, Respuesta } from '../../domain/tipos';

/** Estado editable de una entrevista (lo que se autoguarda). */
export interface BorradorEntrevista {
  urlGrabacion: string;
  oportunidadesMejora: string;
  recomendaciones: string;
  respuestas: Respuesta[];
}

const CAMPOS_RESPUESTA = ['titulo', 'criterioId', 'opcionId', 'respuestaTexto', 'puntaje', 'sustento'] as const;

export function borradorDesde(entrevista: Entrevista, respuestas: Respuesta[]): BorradorEntrevista {
  return {
    urlGrabacion: entrevista.urlGrabacion ?? '',
    oportunidadesMejora: entrevista.oportunidadesMejora,
    recomendaciones: entrevista.recomendaciones,
    respuestas,
  };
}

/**
 * Cambios campo a campo entre el último borrador guardado y el actual (§3.4: el autoguardado
 * es por entrevista y por campo modificado, no del formulario completo). Las respuestas que no
 * estaban en el anterior (recién creadas) se envían completas.
 */
export function calcularCambios(nuevo: BorradorEntrevista, anterior: BorradorEntrevista): CambiosBorradorEntrevista {
  const entrevista: Cambios<Entrevista> = {};
  if (nuevo.urlGrabacion !== anterior.urlGrabacion) entrevista.urlGrabacion = nuevo.urlGrabacion.trim() || null;
  if (nuevo.oportunidadesMejora !== anterior.oportunidadesMejora) {
    entrevista.oportunidadesMejora = nuevo.oportunidadesMejora;
  }
  if (nuevo.recomendaciones !== anterior.recomendaciones) entrevista.recomendaciones = nuevo.recomendaciones;

  const respuestas: CambiosBorradorEntrevista['respuestas'] = [];
  for (const r of nuevo.respuestas) {
    const previa = anterior.respuestas.find((x) => x.id === r.id);
    const cambios: Cambios<Respuesta> = {};
    for (const campo of CAMPOS_RESPUESTA) {
      if (!previa || previa[campo] !== r[campo]) Object.assign(cambios, { [campo]: r[campo] });
    }
    if (Object.keys(cambios).length > 0) respuestas.push({ id: r.id, cambios });
  }
  return { entrevista, respuestas };
}

export function hayCambios(c: CambiosBorradorEntrevista): boolean {
  return Object.keys(c.entrevista).length > 0 || c.respuestas.length > 0;
}
