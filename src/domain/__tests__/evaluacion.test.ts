import { describe, expect, it } from 'vitest';
import {
  aplicarSugerido,
  faltaSustento,
  indiceAdopcion,
  pesosValidos,
  puntajeSugerido,
  requiereSustento,
  resultado,
  UMBRAL_ADOPCION_PARCIAL,
  UMBRAL_ADOPCION_PLENA,
} from '../evaluacion';
import type { Entrevista, PuntajeCriterio, Respuesta } from '../tipos';

describe('indiceAdopcion (RN-03)', () => {
  it('finales 8, 6, 7, 8 con pesos 30, 25, 30, 15 → 72', () => {
    expect(
      indiceAdopcion([
        { puntajeFinal: 8, peso: 30 },
        { puntajeFinal: 6, peso: 25 },
        { puntajeFinal: 7, peso: 30 },
        { puntajeFinal: 8, peso: 15 },
      ]),
    ).toBe(72);
  });

  it('redondea a 1 decimal', () => {
    expect(
      indiceAdopcion([
        { puntajeFinal: 8.3, peso: 30 },
        { puntajeFinal: 5.7, peso: 25 },
        { puntajeFinal: 7, peso: 30 },
        { puntajeFinal: 8, peso: 15 },
      ]),
    ).toBe(72.2);
  });

  it('todo 10 → 100', () => {
    expect(indiceAdopcion([{ puntajeFinal: 10, peso: 60 }, { puntajeFinal: 10, peso: 40 }])).toBe(100);
  });
});

describe('resultado (RN-09)', () => {
  it('umbrales exportados', () => {
    expect(UMBRAL_ADOPCION_PLENA).toBe(85);
    expect(UMBRAL_ADOPCION_PARCIAL).toBe(60);
  });

  it.each([
    [100, 'Adopción plena'],
    [85, 'Adopción plena'],
    [84.9, 'Adopción parcial'],
    [72, 'Adopción parcial'],
    [60, 'Adopción parcial'],
    [59.9, 'Adopción baja'],
    [10, 'Adopción baja'],
  ] as const)('%d → %s', (indice, esperado) => {
    expect(resultado(indice)).toBe(esperado);
  });
});

describe('puntajeSugerido (RN-04)', () => {
  const entrevistas: Pick<Entrevista, 'id' | 'estado'>[] = [
    { id: 1, estado: 'Completa' },
    { id: 2, estado: 'Completa' },
    { id: 3, estado: 'En curso' },
    { id: 4, estado: 'Pendiente' },
  ];
  const respuestas: Pick<Respuesta, 'entrevistaId' | 'criterioId' | 'puntaje'>[] = [
    { entrevistaId: 1, criterioId: 10, puntaje: 8 },
    { entrevistaId: 2, criterioId: 10, puntaje: 9 },
    { entrevistaId: 2, criterioId: 10, puntaje: null }, // surgida sin puntaje: se ignora
    { entrevistaId: 3, criterioId: 10, puntaje: 1 }, // entrevista no completa: se ignora
    { entrevistaId: 4, criterioId: 10, puntaje: 1 }, // entrevista no completa: se ignora
    { entrevistaId: 1, criterioId: 20, puntaje: 5 }, // otro criterio
  ];

  it('promedia solo puntajes no nulos de entrevistas completas', () => {
    expect(puntajeSugerido(10, respuestas, entrevistas)).toBe(8.5);
  });

  it('filtra por criterio', () => {
    expect(puntajeSugerido(20, respuestas, entrevistas)).toBe(5);
  });

  it('null si no hay datos', () => {
    expect(puntajeSugerido(30, respuestas, entrevistas)).toBeNull();
    expect(puntajeSugerido(10, respuestas, [{ id: 1, estado: 'En curso' }])).toBeNull();
  });

  it('redondea a 1 decimal', () => {
    const r = [
      { entrevistaId: 1, criterioId: 1, puntaje: 8 },
      { entrevistaId: 1, criterioId: 1, puntaje: 8 },
      { entrevistaId: 2, criterioId: 1, puntaje: 9 },
    ];
    expect(puntajeSugerido(1, r, entrevistas)).toBe(8.3);
  });
});

describe('requiereSustento (RN-05)', () => {
  it('no lo exige si el final coincide con el sugerido', () => {
    expect(requiereSustento({ puntajeFinal: 7, puntajeSugerido: 7 })).toBe(false);
  });

  it('lo exige si difiere', () => {
    expect(requiereSustento({ puntajeFinal: 6, puntajeSugerido: 7 })).toBe(true);
  });

  it('lo exige si no hay sugerencia', () => {
    expect(requiereSustento({ puntajeFinal: 5, puntajeSugerido: null })).toBe(true);
  });

  it('faltaSustento considera el texto', () => {
    expect(faltaSustento({ puntajeFinal: 6, puntajeSugerido: 7, sustentoAjuste: '  ' })).toBe(true);
    expect(faltaSustento({ puntajeFinal: 6, puntajeSugerido: 7, sustentoAjuste: 'Motivo' })).toBe(false);
  });
});

describe('aplicarSugerido', () => {
  const base: PuntajeCriterio = {
    id: 1,
    titulo: 'Cobertura',
    verificacionId: 1,
    criterioId: 2,
    peso: 25,
    puntajeSugerido: 6,
    puntajeFinal: 6,
    sustentoAjuste: '',
  };

  it('el final sigue a la sugerencia si no fue ajustado', () => {
    expect(aplicarSugerido(base, 5.7)).toMatchObject({ puntajeSugerido: 5.7, puntajeFinal: 5.7 });
    expect(aplicarSugerido({ ...base, puntajeSugerido: null, puntajeFinal: 5 }, 8)).toMatchObject({ puntajeFinal: 8 });
  });

  it('respeta un ajuste manual con sustento', () => {
    const ajustado = { ...base, puntajeFinal: 4, sustentoAjuste: 'Hoja auxiliar' };
    expect(aplicarSugerido(ajustado, 5.7)).toMatchObject({ puntajeSugerido: 5.7, puntajeFinal: 4 });
  });

  it('es idempotente', () => {
    const una = aplicarSugerido(base, 5.7);
    expect(aplicarSugerido(una, 5.7)).toEqual(una);
  });
});

describe('pesosValidos', () => {
  it('los activos deben sumar 100', () => {
    expect(
      pesosValidos([
        { peso: 30, activo: true },
        { peso: 25, activo: true },
        { peso: 30, activo: true },
        { peso: 15, activo: true },
        { peso: 50, activo: false },
      ]),
    ).toBe(true);
    expect(pesosValidos([{ peso: 30, activo: true }])).toBe(false);
  });
});
