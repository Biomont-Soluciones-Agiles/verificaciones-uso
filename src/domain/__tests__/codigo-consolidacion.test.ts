import { describe, expect, it } from 'vitest';
import { carpetaEvidencias, formatearCodigoVU, tituloAprobacion, tituloEntrevista } from '../codigo';
import { consolidarTextos, resumirEvidencias, textoEvidencias } from '../consolidacion';

describe('formatearCodigoVU', () => {
  it('12 → VU-00012', () => expect(formatearCodigoVU(12)).toBe('VU-00012'));
  it('1 → VU-00001', () => expect(formatearCodigoVU(1)).toBe('VU-00001'));
  it('123456 → VU-123456', () => expect(formatearCodigoVU(123456)).toBe('VU-123456'));
  it('rechaza IDs no válidos', () => {
    expect(() => formatearCodigoVU(0)).toThrow();
    expect(() => formatearCodigoVU(1.5)).toThrow();
  });
});

describe('títulos derivados', () => {
  it('entrevista', () => expect(tituloEntrevista(3, 'Lucía Campos')).toBe('Entrevista 3 – Lucía Campos'));
  it('aprobación', () => expect(tituloAprobacion('VU-00012', 'Piloto')).toBe('VU-00012 · Piloto'));
  it('carpeta de evidencias', () => expect(carpetaEvidencias('VU-00012', 3)).toBe('VU-00012/Entrevista-03'));
});

describe('consolidación', () => {
  it('une, quita viñetas y duplicados', () => {
    expect(
      consolidarTextos(['- Revisar permisos.\nCapacitar usuarios', '', 'capacitar usuarios\n• Guía rápida']),
    ).toBe('Revisar permisos.\nCapacitar usuarios\nGuía rápida');
  });

  it('resume evidencias como en el prototipo', () => {
    const r = resumirEvidencias(
      [{ urlGrabacion: 'https://a' }, { urlGrabacion: 'https://b' }, { urlGrabacion: 'https://c' }, { urlGrabacion: null }],
      Array.from({ length: 7 }, () => ({ tipo: 'Captura' as const })),
    );
    expect(textoEvidencias(r)).toBe('3 grabaciones · 7 capturas');
  });
});
