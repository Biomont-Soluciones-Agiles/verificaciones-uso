import { beforeEach, describe, expect, it } from 'vitest';
import { crearRepositoriosMock } from '../mock/repositoriosMock';
import { PERSONAS } from '../mock/semilla';
import type { Repositorios } from '../repositorios';
import {
  abrirVerificacion,
  agregarEntrevista,
  completarEntrevista,
  finalizarYEnviar,
  guardarBorradorEntrevista,
  programarVerificacion,
  recalcularSugeridos,
  simularLevantamientoCompleto,
} from '../servicios';
import { ErrorValidacion } from '../errores';

let repos: Repositorios;

beforeEach(() => {
  repos = crearRepositoriosMock({ latenciaMs: 0 });
});

const datosProgramacion = {
  solucionId: '4',
  responsable: PERSONAS.alexandra,
  fechaObjetivo: '2026-08-15',
  diasAnticipacion: 15 as const,
  entrevistasPrevistas: 3,
  modalidad: 'Teams' as const,
  objetivo: 'Objetivo',
};

describe('programarVerificacion', () => {
  it('crea, asigna código VU-xxxxx, calcula la alerta y crea un puntaje por criterio', async () => {
    const v = await programarVerificacion(repos, datosProgramacion, { activar: true });
    expect(v.codigo).toBe('VU-00002');
    expect(v.fechaAlerta).toBe('2026-07-31');
    expect(v.estado).toBe('Programada');
    const puntajes = await repos.puntajes.listarPorVerificacion(v.id);
    expect(puntajes.map((p) => [p.titulo, p.peso])).toEqual([
      ['Frecuencia', 30],
      ['Cobertura', 25],
      ['Sustitución', 30],
      ['Satisfacción', 15],
    ]);
    // Simulación de F3: la solución pasa a "Programada".
    expect((await repos.soluciones.obtener('4'))?.estadoVU).toBe('Programada');
  });

  it('la app nunca escribe el código (lo pone la autonumeración) y crea con completas = 0', async () => {
    const crear = repos.verificaciones.crear;
    const actualizar = repos.verificaciones.actualizar;
    const creados: unknown[] = [];
    const cambios: object[] = [];
    repos.verificaciones.crear = (d) => (creados.push(d), crear(d));
    repos.verificaciones.actualizar = (id, c) => (cambios.push(c), actualizar(id, c));
    await programarVerificacion(repos, datosProgramacion, { activar: true });
    expect(creados[0]).toMatchObject({ entrevistasCompletas: 0, estado: 'Borrador' });
    expect(cambios.some((c) => 'codigo' in c)).toBe(false);
  });

  it('el borrador no cambia de estado y abrirla es idempotente', async () => {
    const v = await programarVerificacion(repos, datosProgramacion, { activar: false });
    expect(v.estado).toBe('Borrador');
    await abrirVerificacion(repos, v.id);
    await abrirVerificacion(repos, v.id);
    expect(await repos.puntajes.listarPorVerificacion(v.id)).toHaveLength(4);
  });

  it('impide una segunda verificación activa para la misma solución', async () => {
    await expect(
      programarVerificacion(repos, { ...datosProgramacion, solucionId: '1' }, { activar: false }),
    ).rejects.toBeInstanceOf(ErrorValidacion);
  });
});

describe('entrevistas', () => {
  it('completar valida las preguntas definidas', async () => {
    // Pedro Núñez (4) no tiene respuestas.
    await expect(completarEntrevista(repos, '4')).rejects.toThrow('Falta responder');
  });

  it('completar recuenta (no suma) y es idempotente', async () => {
    await completarEntrevista(repos, '3');
    const v = await completarEntrevista(repos, '3');
    expect(v.entrevistasCompletas).toBe(3);
    expect(v.estado).toBe('En levantamiento');
  });

  it('el autoguardado pasa la entrevista a "En curso"', async () => {
    const e = await guardarBorradorEntrevista(repos, '4', { entrevista: { urlGrabacion: 'https://x' }, respuestas: [] });
    expect(e.estado).toBe('En curso');
  });

  it('agregar una entrevista por encima de las previstas actualiza las previstas', async () => {
    await agregarEntrevista(repos, '1', {
      entrevistado: null,
      entrevistadoNombre: 'Nueva persona',
      areaId: '6',
      fechaHora: null,
      modalidad: 'Teams',
    });
    const v = await abrirVerificacion(repos, '1');
    expect(v.entrevistasPrevistas).toBe(5);
    const entrevistas = await repos.entrevistas.listarPorVerificacion('1');
    expect(entrevistas.at(-1)?.titulo).toBe('Entrevista 5 – Nueva persona');
  });
});

describe('evaluación y envío', () => {
  it('recalcula sugeridos solo con entrevistas completas (RN-04)', async () => {
    let puntajes = await recalcularSugeridos(repos, '1');
    expect(puntajes.map((p) => p.puntajeSugerido)).toEqual([8, 6, 7, 8]);
    await completarEntrevista(repos, '3'); // Lucía: Diariamente (9) y Cobertura 5
    puntajes = await recalcularSugeridos(repos, '1');
    expect(puntajes.map((p) => p.puntajeSugerido)).toEqual([8.3, 5.7, 7, 8]);
    // Los finales no ajustados siguen a la sugerencia.
    expect(puntajes.map((p) => p.puntajeFinal)).toEqual([8.3, 5.7, 7, 8]);
  });

  it('no permite finalizar con el levantamiento incompleto (RN-07)', async () => {
    const v = await abrirVerificacion(repos, '1');
    await expect(
      finalizarYEnviar(repos, '1', {
        oportunidadesConsolidadas: '',
        recomendacionesConsolidadas: '',
        aprobadorPiloto: v.aprobadorPiloto,
        aprobadorProductivo: v.aprobadorProductivo,
        notificarAlFinalizar: true,
      }),
    ).rejects.toThrow('2 de 4');
  });

  it('finaliza: guarda índice/resultado y pasa a "En revisión"', async () => {
    await simularLevantamientoCompleto(repos, '1');
    const antes = await abrirVerificacion(repos, '1');
    expect(antes.estado).toBe('En evaluación');
    const v = await finalizarYEnviar(repos, '1', {
      oportunidadesConsolidadas: 'A',
      recomendacionesConsolidadas: 'B',
      aprobadorPiloto: PERSONAS.alexandra,
      aprobadorProductivo: PERSONAS.denis,
      notificarAlFinalizar: true,
    });
    expect(v.estado).toBe('En revisión');
    expect(v.indiceAdopcion).toBe(28.8);
    expect(v.resultado).toBe('Usabilidad parcial');
    expect(v.fechaEnvio).not.toBeNull();
    // Simulación de F2: aprobación de nivel Piloto pendiente.
    const aprobaciones = await repos.aprobaciones.listarPorVerificacion('1');
    expect(aprobaciones).toMatchObject([{ nivel: 'Piloto', decision: 'Pendiente', titulo: 'VU-00001 · Piloto' }]);
  });
});
