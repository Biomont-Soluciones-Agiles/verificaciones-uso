import { describe, expect, it } from 'vitest';
import type { Respuesta } from '../../../domain/tipos';
import { calcularCambios, hayCambios, type BorradorEntrevista } from '../borrador';

const respuesta: Respuesta = {
  id: 1,
  titulo: 'P',
  entrevistaId: 1,
  verificacionId: 1,
  origen: 'Definida',
  preguntaId: 1,
  criterioId: 1,
  opcionId: null,
  respuestaTexto: '',
  puntaje: null,
  sustento: '',
  orden: 1,
};

const base: BorradorEntrevista = { urlGrabacion: '', oportunidadesMejora: '', recomendaciones: '', respuestas: [respuesta] };

describe('calcularCambios (autoguardado por campo)', () => {
  it('sin cambios', () => {
    expect(hayCambios(calcularCambios(base, base))).toBe(false);
  });

  it('solo envía los campos modificados', () => {
    const nuevo = {
      ...base,
      urlGrabacion: ' https://grabacion ',
      respuestas: [{ ...respuesta, opcionId: 2, puntaje: 8 }],
    };
    expect(calcularCambios(nuevo, base)).toEqual({
      entrevista: { urlGrabacion: 'https://grabacion' },
      respuestas: [{ id: 1, cambios: { opcionId: 2, puntaje: 8 } }],
    });
  });

  it('una URL vacía se guarda como null', () => {
    expect(calcularCambios(base, { ...base, urlGrabacion: 'https://x' }).entrevista).toEqual({ urlGrabacion: null });
  });

  it('las respuestas nuevas se envían completas', () => {
    const nueva = { ...respuesta, id: 2, origen: 'Surgida en reunión' as const, titulo: '¿Algo?' };
    const c = calcularCambios({ ...base, respuestas: [respuesta, nueva] }, base);
    expect(c.respuestas).toHaveLength(1);
    expect(c.respuestas[0].cambios).toMatchObject({ titulo: '¿Algo?', criterioId: 1 });
  });
});
