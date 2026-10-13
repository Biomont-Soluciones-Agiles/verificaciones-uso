import { describe, expect, it } from 'vitest';
import {
  calcularFechaAlerta,
  calcularProximaVU,
  esFechaValida,
  formatearFecha,
  hoyISO,
  sumarMeses,
} from '../fechas';

describe('calcularFechaAlerta (RN-01)', () => {
  it('15/08/2026 con 15 días de anticipación → 31/07/2026', () => {
    expect(calcularFechaAlerta('2026-08-15', 15)).toBe('2026-07-31');
  });

  it('cruza de año correctamente', () => {
    expect(calcularFechaAlerta('2027-01-10', 30)).toBe('2026-12-11');
  });

  it('7 días', () => {
    expect(calcularFechaAlerta('2026-03-05', 7)).toBe('2026-02-26');
  });

  it('rechaza anticipaciones negativas o fechas inválidas', () => {
    expect(() => calcularFechaAlerta('2026-08-15', -1)).toThrow();
    expect(() => calcularFechaAlerta('2026-02-30', 7)).toThrow();
  });
});

describe('calcularProximaVU (RN-10)', () => {
  it('fecha de aprobación + periodicidad en meses', () => {
    expect(calcularProximaVU('2026-06-23', 6)).toBe('2026-12-23');
    expect(calcularProximaVU('2026-08-06', 6)).toBe('2027-02-06');
  });

  it('acepta fecha y hora ISO', () => {
    expect(calcularProximaVU('2026-08-06T15:30:00.000Z', 12)).toBe('2027-08-06');
  });

  it('ajusta al último día del mes cuando no existe', () => {
    expect(calcularProximaVU('2026-08-31', 6)).toBe('2027-02-28');
    expect(sumarMeses('2027-08-31', 6)).toBe('2028-02-29');
  });

  it('rechaza periodicidades no válidas', () => {
    expect(() => calcularProximaVU('2026-08-06', 0)).toThrow();
  });
});

describe('utilidades', () => {
  it('formatearFecha', () => {
    expect(formatearFecha('2026-08-15')).toBe('15/08/2026');
    expect(formatearFecha(null)).toBe('—');
  });

  it('esFechaValida', () => {
    expect(esFechaValida('2026-02-28')).toBe(true);
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('')).toBe(false);
  });

  it('hoyISO usa la fecha local', () => {
    expect(hoyISO(new Date(2026, 9, 13, 23, 59))).toBe('2026-10-13');
  });
});
