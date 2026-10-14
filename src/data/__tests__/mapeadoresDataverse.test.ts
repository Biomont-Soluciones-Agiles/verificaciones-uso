import { describe, expect, it } from 'vitest';
import {
  Vu_aprobacionsvu_decision,
  Vu_aprobacionsvu_nivel,
} from '../../generated/models/Vu_aprobacionsModel';
import { Vu_areasvu_tipoarea } from '../../generated/models/Vu_areasModel';
import { Vu_documentosolucionsvu_tipodocumento } from '../../generated/models/Vu_documentosolucionsModel';
import { Vu_entrevistasvu_estadoentrevista } from '../../generated/models/Vu_entrevistasModel';
import { Vu_evidenciasvu_tipoevidencia } from '../../generated/models/Vu_evidenciasModel';
import { Vu_preguntasvu_tiporespuesta } from '../../generated/models/Vu_preguntasModel';
import { Vu_respuestasvu_origen } from '../../generated/models/Vu_respuestasModel';
import { Vu_solucionsvu_estadovu, Vu_solucionsvu_tiposolucion } from '../../generated/models/Vu_solucionsModel';
import {
  Vu_verificacionsvu_estado,
  Vu_verificacionsvu_modalidad,
  Vu_verificacionsvu_resultado,
} from '../../generated/models/Vu_verificacionsModel';
import {
  ESTADOS_ENTREVISTA,
  ESTADOS_VERIFICACION,
  ESTADOS_VU,
  MODALIDADES,
  type Persona,
} from '../../domain/tipos';
import {
  entrevistaARegistro,
  entrevistaDesdeFila,
  SELECT,
  sinBindsNulos,
  solucionARegistro,
  verificacionARegistro,
  verificacionDesdeFila,
} from '../dataverse/mapeadores';
import { aFechaSolo, bind, CONJUNTOS, fechaSolo, filtroPorBusqueda, literal } from '../dataverse/odata';
import * as O from '../dataverse/opciones';

const SOLUCION = '36e9ebba-21c7-f111-a05c-7ced8da8a834';
const VERIFICACION = 'b782fec0-21c7-f111-a05c-7ced8da8a834';
const USUARIO = 'adb70ce0-dd43-f011-877a-000d3ac02aee';
const FV = '@OData.Community.Display.V1.FormattedValue';

/** Fila con la forma real de la Web API (incluye anotaciones). */
const filaVerificacion = {
  vu_verificacionid: VERIFICACION,
  vu_name: 'VU-00001',
  _vu_solucionid_value: SOLUCION,
  [`_vu_solucionid_value${FV}`]: 'Plan de entregas',
  _vu_responsableid_value: USUARIO,
  [`_vu_responsableid_value${FV}`]: 'Alexandra Durand',
  vu_fechaobjetivo: '2026-08-15',
  vu_diasanticipacion: 15,
  vu_fechaalerta: '2026-07-31',
  vu_alertaenviada: true,
  vu_entrevistasprevistas: 4,
  vu_entrevistascompletas: 2,
  vu_modalidad: 100000000,
  vu_estado: 100000002,
  vu_indiceadopcion: null,
  vu_resultado: 100000001,
  _vu_aprobadorpilotoid_value: null,
  vu_notificaralfinalizar: false,
  vu_fechaenvio: null,
};

describe('opciones Dataverse ↔ etiquetas del dominio', () => {
  /** Los valores del contrato coinciden con los modelos generados del entorno (número → etiqueta). */
  const casos: [string, O.Opcion<string>, Record<number, string>][] = [
    ['vu_estado', O.ESTADO_VERIFICACION, Vu_verificacionsvu_estado],
    ['vu_modalidad', O.MODALIDAD, Vu_verificacionsvu_modalidad],
    ['vu_resultado', O.RESULTADO, Vu_verificacionsvu_resultado],
    ['vu_estadovu', O.ESTADO_VU, Vu_solucionsvu_estadovu],
    ['vu_tiposolucion', O.TIPO_SOLUCION, Vu_solucionsvu_tiposolucion],
    ['vu_tipoarea', O.TIPO_AREA, Vu_areasvu_tipoarea],
    ['vu_tipodocumento', O.TIPO_DOCUMENTO, Vu_documentosolucionsvu_tipodocumento],
    ['vu_tiporespuesta', O.TIPO_RESPUESTA, Vu_preguntasvu_tiporespuesta],
    ['vu_estadoentrevista', O.ESTADO_ENTREVISTA, Vu_entrevistasvu_estadoentrevista],
    ['vu_origen', O.ORIGEN_RESPUESTA, Vu_respuestasvu_origen],
    ['vu_tipoevidencia', O.TIPO_EVIDENCIA, Vu_evidenciasvu_tipoevidencia],
    ['vu_nivel', O.NIVEL_APROBACION, Vu_aprobacionsvu_nivel],
    ['vu_decision', O.DECISION_APROBACION, Vu_aprobacionsvu_decision],
  ];
  it.each(casos)('%s coincide con el modelo generado', (_, opcion, generado) => {
    const esperado = Object.fromEntries(Object.entries(generado).map(([n, t]) => [t, Number(n)]));
    expect(opcion.valores).toEqual(esperado);
  });

  it('cubren todas las etiquetas del dominio', () => {
    expect(Object.keys(O.ESTADO_VERIFICACION.valores)).toEqual([...ESTADOS_VERIFICACION]);
    expect(Object.keys(O.ESTADO_VU.valores)).toEqual([...ESTADOS_VU]);
    expect(Object.keys(O.MODALIDAD.valores)).toEqual([...MODALIDADES]);
    expect(Object.keys(O.ESTADO_ENTREVISTA.valores)).toEqual([...ESTADOS_ENTREVISTA]);
  });

  it('ida y vuelta, y valores desconocidos', () => {
    expect(O.ESTADO_VERIFICACION.aNumero('En revisión')).toBe(100000004);
    expect(O.ESTADO_VERIFICACION.aTexto(100000006)).toBe('Aprobada piloto');
    expect(O.RESULTADO.aTextoONull(null)).toBeNull();
    expect(() => O.ESTADO_VERIFICACION.aTexto(42)).toThrow('desconocido');
  });
});

describe('utilidades OData', () => {
  it('bind y desvinculación', () => {
    expect(bind('vu_SolucionId', CONJUNTOS.solucion, SOLUCION)).toEqual({
      'vu_SolucionId@odata.bind': `/vu_solucions(${SOLUCION})`,
    });
    expect(bind('vu_AreaId', CONJUNTOS.area, null)).toEqual({ 'vu_AreaId@odata.bind': null });
    expect(() => bind('vu_AreaId', CONJUNTOS.area, '12')).toThrow('GUID');
  });

  it('fechas DateOnly yyyy-MM-dd', () => {
    expect(fechaSolo({ f: '2026-08-15' }, 'f')).toBe('2026-08-15');
    expect(fechaSolo({ f: '2026-08-15T00:00:00Z' }, 'f')).toBe('2026-08-15');
    expect(fechaSolo({ f: null }, 'f')).toBeNull();
    expect(aFechaSolo('2026-07-31')).toBe('2026-07-31');
    expect(aFechaSolo(null)).toBeNull();
    expect(() => aFechaSolo('31/07/2026')).toThrow();
  });

  it('filtros y literales', () => {
    expect(filtroPorBusqueda('vu_verificacionid', VERIFICACION)).toBe(`_vu_verificacionid_value eq ${VERIFICACION}`);
    expect(literal("O'Brien")).toBe("'O''Brien'");
  });
});

describe('verificación', () => {
  it('fila → dominio', () => {
    const v = verificacionDesdeFila(filaVerificacion);
    expect(v).toMatchObject({
      id: VERIFICACION,
      codigo: 'VU-00001',
      solucionId: SOLUCION,
      solucionNombre: 'Plan de entregas',
      responsable: { id: USUARIO, nombre: 'Alexandra Durand', email: '' },
      fechaObjetivo: '2026-08-15',
      diasAnticipacion: 15,
      fechaAlerta: '2026-07-31',
      modalidad: 'Teams',
      estado: 'En levantamiento',
      resultado: 'Adopción parcial',
      indiceAdopcion: null,
      aprobadorPiloto: null,
      objetivo: '',
    });
  });

  it('crear: sin código (autonumeración), con enteros sin predeterminado y binds', () => {
    const responsable: Persona = { id: USUARIO, nombre: 'Alexandra', email: 'a@x' };
    const r = sinBindsNulos(
      verificacionARegistro(
        {
          codigo: '',
          solucionNombre: 'ignorado',
          solucionId: SOLUCION,
          responsable,
          fechaObjetivo: '2026-08-15',
          diasAnticipacion: 15,
          fechaAlerta: '2026-07-31',
          entrevistasPrevistas: 4,
          modalidad: 'Presencial',
          objetivo: '',
          aprobadorPiloto: null,
        },
        true,
      ),
    );
    expect(r).toEqual({
      'vu_SolucionId@odata.bind': `/vu_solucions(${SOLUCION})`,
      'vu_ResponsableId@odata.bind': `/systemusers(${USUARIO})`,
      vu_fechaobjetivo: '2026-08-15',
      vu_diasanticipacion: 15,
      vu_fechaalerta: '2026-07-31',
      vu_alertaenviada: false,
      vu_entrevistasprevistas: 4,
      vu_entrevistascompletas: 0,
      vu_modalidad: 100000001,
      vu_objetivo: null,
      vu_estado: 100000000,
      vu_notificaralfinalizar: false,
    });
    expect(r).not.toHaveProperty('vu_name');
  });

  it('actualizar: solo lo modificado; quitar aprobador = bind nulo', () => {
    expect(verificacionARegistro({ estado: 'En revisión', aprobadorProductivo: null })).toEqual({
      vu_estado: 100000004,
      'vu_AprobadorProductivoId@odata.bind': null,
    });
  });

  it('una persona sin systemuserid no se puede escribir', () => {
    expect(() => verificacionARegistro({ responsable: { nombre: 'X', email: 'x@y' } })).toThrow('usuario del entorno');
  });
});

describe('solución y entrevista', () => {
  it('solución nueva: periodicidad 6 por defecto y estado VU Pendiente', () => {
    const r = solucionARegistro(
      {
        titulo: 'App',
        procesoId: SOLUCION,
        responsable: { id: USUARIO, nombre: 'R', email: '' },
        periodicidadMeses: Number.NaN,
        estadoVU: 'Pendiente',
        fechaActualizacion: null,
      },
      true,
    );
    expect(r).toMatchObject({
      vu_name: 'App',
      'vu_ProcesoId@odata.bind': `/vu_areas(${SOLUCION})`,
      vu_periodicidadmeses: 6,
      vu_estadovu: 100000000,
      vu_fechaactualizacion: null,
    });
    // Al actualizar, el estado VU (lo escribe F3) no se envía.
    expect(solucionARegistro({ estadoVU: 'Vigente', periodicidadMeses: 12 })).toEqual({ vu_periodicidadmeses: 12 });
  });

  it('entrevistado externo: correo sí, búsqueda vacía', () => {
    const r = entrevistaARegistro({ entrevistado: { id: null, nombre: 'Ext', email: 'ext@otra.com' }, modalidad: null });
    expect(r).toEqual({
      vu_entrevistadocorreo: 'ext@otra.com',
      'vu_EntrevistadoId@odata.bind': null,
      vu_modalidad: null,
    });
  });

  it('entrevista: fila → dominio (Mixta no es modalidad de entrevista)', () => {
    const e = entrevistaDesdeFila({
      vu_entrevistaid: VERIFICACION,
      vu_name: 'Entrevista 1 – María',
      _vu_verificacionid_value: VERIFICACION,
      vu_numero: 1,
      vu_entrevistadonombre: 'María',
      _vu_areaid_value: SOLUCION,
      [`_vu_areaid_value${FV}`]: 'Operaciones',
      vu_modalidad: 100000002,
      vu_estadoentrevista: 100000002,
    });
    expect(e).toMatchObject({ numero: 1, areaNombre: 'Operaciones', modalidad: null, estado: 'Completa', entrevistado: null });
  });
});

describe('prueba de humo', () => {
  it('scripts/smoke-dataverse.mjs consulta los mismos $select que los repositorios', async () => {
    // @ts-expect-error: script Node sin tipos.
    const humo = (await import('../../../scripts/smoke-dataverse.mjs')) as { SELECT: Record<string, string[]> };
    expect(humo.SELECT).toEqual(SELECT);
  });
});
