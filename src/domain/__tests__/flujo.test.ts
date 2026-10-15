import { describe, expect, it } from 'vitest';
import {
  avancePorCriterio,
  etapasCompletadas,
  etapasDisponibles,
  estadoSolucion,
  progreso,
  puedeFinalizar,
  puedeTransicionar,
  puedeTransicionarDesdeApp,
  TRANSICIONES,
  validarEnvio,
  validarProgramacion,
  validarRespuestasDefinidas,
} from '../flujo';
import { ESTADOS_VERIFICACION, type EstadoVerificacion } from '../tipos';

describe('puedeFinalizar (RN-07)', () => {
  it('2 de 4 → false', () => {
    expect(puedeFinalizar({ entrevistasCompletas: 2, entrevistasPrevistas: 4 })).toBe(false);
  });

  it('4 de 4 → true', () => {
    expect(puedeFinalizar({ entrevistasCompletas: 4, entrevistasPrevistas: 4 })).toBe(true);
  });

  it('0 previstas → false', () => {
    expect(puedeFinalizar({ entrevistasCompletas: 0, entrevistasPrevistas: 0 })).toBe(false);
  });
});

describe('progreso (RN-02)', () => {
  it('2 de 4 → 50 %', () => expect(progreso(2, 4)).toBe(50));
  it('1 de 3 → 33 %', () => expect(progreso(1, 3)).toBe(33));
  it('sin previstas → 0', () => expect(progreso(0, 0)).toBe(0));
  it('no supera 100', () => expect(progreso(5, 4)).toBe(100));
});

describe('transiciones de estado (§2.4)', () => {
  const validas: [EstadoVerificacion, EstadoVerificacion][] = [
    ['Borrador', 'Programada'],
    ['Programada', 'En levantamiento'],
    ['En levantamiento', 'En evaluación'],
    ['En evaluación', 'En revisión'],
    ['En revisión', 'Observada'],
    ['Observada', 'En evaluación'],
    ['En revisión', 'Aprobada'],
    ['En evaluación', 'En levantamiento'],
    ['Aprobada piloto', 'Aprobada'],
    ['Borrador', 'Cancelada'],
    ['Programada', 'Cancelada'],
  ];
  const invalidas: [EstadoVerificacion, EstadoVerificacion][] = [
    ['Borrador', 'En levantamiento'],
    ['Programada', 'En revisión'],
    ['En levantamiento', 'En revisión'],
    ['En levantamiento', 'Cancelada'],
    ['En revisión', 'Aprobada piloto'],
    ['Aprobada', 'Borrador'],
    ['Cancelada', 'Programada'],
    ['Observada', 'En revisión'],
  ];

  it.each(validas)('%s → %s es válida', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(true);
  });

  it.each(invalidas)('%s → %s no es válida', (desde, hacia) => {
    expect(puedeTransicionar(desde, hacia)).toBe(false);
  });

  it('todos los estados tienen entrada en la tabla', () => {
    for (const e of ESTADOS_VERIFICACION) expect(TRANSICIONES[e]).toBeDefined();
  });

  it('la app solo cambia el estado hasta "En revisión"', () => {
    expect(puedeTransicionarDesdeApp('En evaluación', 'En revisión')).toBe(true);
    expect(puedeTransicionarDesdeApp('Observada', 'En evaluación')).toBe(true);
    expect(puedeTransicionarDesdeApp('En revisión', 'Observada')).toBe(false);
    expect(puedeTransicionarDesdeApp('En revisión', 'Aprobada')).toBe(false);
    expect(puedeTransicionarDesdeApp('En evaluación', 'En levantamiento')).toBe(true);
  });
});

describe('estadoSolucion (§2.5)', () => {
  const hoy = '2026-10-13';

  it('sin verificación → Pendiente', () => {
    expect(estadoSolucion(null, null, hoy)).toBe('Pendiente');
    expect(estadoSolucion(null, '2027-01-01', hoy)).toBe('Pendiente');
  });

  it('Programada → Programada', () => {
    expect(estadoSolucion({ estado: 'Programada' }, '2026-08-15', hoy)).toBe('Programada');
  });

  it.each(['En levantamiento', 'En evaluación', 'Observada'] as const)('%s → En proceso', (estado) => {
    expect(estadoSolucion({ estado }, null, hoy)).toBe('En proceso');
  });

  it.each(['En revisión', 'Aprobada piloto'] as const)('%s → En revisión', (estado) => {
    expect(estadoSolucion({ estado }, null, hoy)).toBe('En revisión');
  });

  it('Aprobada y ProximaVU ≥ hoy → Vigente', () => {
    expect(estadoSolucion({ estado: 'Aprobada' }, '2026-12-23', hoy)).toBe('Vigente');
    expect(estadoSolucion({ estado: 'Aprobada' }, hoy, hoy)).toBe('Vigente');
  });

  it('Aprobada y ProximaVU < hoy → Pendiente', () => {
    expect(estadoSolucion({ estado: 'Aprobada' }, '2026-10-12', hoy)).toBe('Pendiente');
    expect(estadoSolucion({ estado: 'Aprobada' }, null, hoy)).toBe('Pendiente');
  });

  it('Borrador o Cancelada equivalen a no tener verificación', () => {
    expect(estadoSolucion({ estado: 'Borrador' }, '2027-01-01', hoy)).toBe('Pendiente');
    expect(estadoSolucion({ estado: 'Cancelada' }, '2027-01-01', hoy)).toBe('Pendiente');
  });
});

describe('validarEnvio', () => {
  const puntajes = [
    { titulo: 'Frecuencia', puntajeFinal: 8, puntajeSugerido: 8, sustentoAjuste: '' },
    { titulo: 'Cobertura', puntajeFinal: 5, puntajeSugerido: 6, sustentoAjuste: '' },
  ];
  const aprobadora = { email: 'a@b.c', nombre: 'A' };

  it('acumula los motivos de bloqueo', () => {
    const errores = validarEnvio(
      { estado: 'En levantamiento', entrevistasCompletas: 2, entrevistasPrevistas: 4, aprobadorPiloto: null },
      puntajes,
    );
    expect(errores).toHaveLength(3);
    expect(errores[0]).toContain('2 de 4');
  });

  it('sin errores cuando todo está completo', () => {
    expect(
      validarEnvio(
        { estado: 'En evaluación', entrevistasCompletas: 4, entrevistasPrevistas: 4, aprobadorPiloto: aprobadora },
        [puntajes[0], { ...puntajes[1], sustentoAjuste: 'Hoja auxiliar' }],
      ),
    ).toEqual([]);
  });

  it('no permite reenviar desde "En revisión"', () => {
    expect(
      validarEnvio(
        { estado: 'En revisión', entrevistasCompletas: 4, entrevistasPrevistas: 4, aprobadorPiloto: aprobadora },
        [puntajes[0]],
      ),
    ).toHaveLength(1);
  });
});

describe('validaciones de formularios', () => {
  it('validarProgramacion', () => {
    expect(
      validarProgramacion({
        solucionId: '1',
        responsable: { email: 'x@y.z' },
        fechaObjetivo: '2026-08-15',
        diasAnticipacion: 15,
        entrevistasPrevistas: 4,
      }),
    ).toEqual([]);
    expect(
      validarProgramacion({
        solucionId: null,
        responsable: null,
        fechaObjetivo: '',
        diasAnticipacion: 10,
        entrevistasPrevistas: 21,
      }),
    ).toHaveLength(5);
  });

  it('validarRespuestasDefinidas exige respuesta y puntaje', () => {
    const preguntas = [
      { id: '1', titulo: 'P1', obligatoria: true },
      { id: '2', titulo: 'P2', obligatoria: true },
    ];
    expect(
      validarRespuestasDefinidas(preguntas, [
        { preguntaId: '1', origen: 'Definida', puntaje: 9 },
        { preguntaId: '2', origen: 'Definida', puntaje: null },
      ]),
    ).toEqual(['Falta el puntaje de: "P2".']);
    expect(validarRespuestasDefinidas(preguntas, [])).toHaveLength(2);
  });

  it('validarRespuestasDefinidas no exige las preguntas no obligatorias', () => {
    const preguntas = [
      { id: '1', titulo: 'P1', obligatoria: true },
      { id: '2', titulo: 'Si corresponde', obligatoria: false },
    ];
    expect(validarRespuestasDefinidas(preguntas, [{ preguntaId: '1', origen: 'Definida', puntaje: 8 }])).toEqual([]);
    expect(
      validarRespuestasDefinidas(preguntas, [
        { preguntaId: '1', origen: 'Definida', puntaje: 8 },
        { preguntaId: '2', origen: 'Definida', puntaje: null },
      ]),
    ).toEqual([]);
  });
});

describe('etapasCompletadas', () => {
  it('refleja el avance', () => {
    expect(etapasCompletadas({ estado: 'Borrador', entrevistasCompletas: 0, entrevistasPrevistas: 4 })).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(
      etapasCompletadas({ estado: 'En levantamiento', entrevistasCompletas: 2, entrevistasPrevistas: 4 }),
    ).toEqual([true, false, false, false, false]);
    expect(etapasCompletadas({ estado: 'Aprobada', entrevistasCompletas: 4, entrevistasPrevistas: 4 })).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});

describe('etapasDisponibles (cada etapa exige la anterior)', () => {
  const v = (estado: EstadoVerificacion, completas: number, previstas: number, indice: number | null = null) => ({
    estado,
    entrevistasCompletas: completas,
    entrevistasPrevistas: previstas,
    indiceAdopcion: indice,
  });

  it('borrador: solo programación', () => {
    expect(etapasDisponibles(v('Borrador', 0, 4))).toEqual([true, false, false, false, false]);
  });

  it('programada o en levantamiento incompleto: hasta entrevistas', () => {
    expect(etapasDisponibles(v('Programada', 0, 4))).toEqual([true, true, false, false, false]);
    expect(etapasDisponibles(v('En levantamiento', 2, 4, 72))).toEqual([true, true, false, false, false]);
  });

  it('levantamiento completo sin evaluación guardada: hasta evaluación', () => {
    expect(etapasDisponibles(v('En evaluación', 4, 4))).toEqual([true, true, true, false, false]);
  });

  it('evaluación guardada: todas', () => {
    expect(etapasDisponibles(v('En evaluación', 4, 4, 72))).toEqual([true, true, true, true, true]);
    expect(etapasDisponibles(v('Observada', 4, 4, 72))).toEqual([true, true, true, true, true]);
  });

  it('enviada o aprobada (también las históricas sin entrevistas): todas', () => {
    expect(etapasDisponibles(v('En revisión', 4, 4, 80))).toEqual([true, true, true, true, true]);
    expect(etapasDisponibles(v('Aprobada', 0, 0, 87))).toEqual([true, true, true, true, true]);
  });
});

describe('avancePorCriterio', () => {
  const r = (criterioId: string, puntaje: number | null, origen: 'Definida' | 'Surgida en reunión' = 'Definida', respuestaTexto = '') => ({
    criterioId,
    puntaje,
    origen,
    respuestaTexto,
  });

  it('cuenta las definidas atendidas por criterio; "No aplica" cuenta como atendida', () => {
    const avance = avancePorCriterio(
      ['f', 'c'],
      [r('f', 8), r('f', null), r('c', 7), r('c', null, 'Definida', 'No aplica'), r('c', null, 'Surgida en reunión')],
    );
    expect(avance).toEqual([
      { criterioId: 'f', respondidas: 1, total: 2, completo: false },
      { criterioId: 'c', respondidas: 2, total: 2, completo: true },
    ]);
  });

  it('un criterio sin preguntas definidas no figura como completo', () => {
    expect(avancePorCriterio(['x'], [])[0]).toEqual({ criterioId: 'x', respondidas: 0, total: 0, completo: false });
  });
});
