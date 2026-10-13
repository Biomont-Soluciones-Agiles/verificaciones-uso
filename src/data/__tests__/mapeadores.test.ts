import { describe, expect, it } from 'vitest';
import { filtroPorBusqueda, literalOData } from '../sharepoint/listas';
import { mapearVerificacion, verificacionASP } from '../sharepoint/mapeadores';
import type { SPVerificacion } from '../sharepoint/tiposSharePoint';
import { crearRepositoriosSharePoint } from '../sharepoint/repositoriosSharePoint';

const item: SPVerificacion = {
  ID: 12,
  Title: 'VU-00012',
  Solucion: { Id: 1, Value: 'Plan de entregas' },
  Responsable: {
    Claims: 'i:0#.f|membership|alexandra.durand@biomont.example',
    DisplayName: 'Alexandra Durand',
    Email: 'alexandra.durand@biomont.example',
  },
  FechaObjetivo: '2026-08-15T05:00:00Z',
  DiasAnticipacion: 15,
  FechaAlerta: '2026-07-31T05:00:00Z',
  AlertaEnviada: false,
  EntrevistasPrevistas: 4,
  EntrevistasCompletas: 2,
  Modalidad: { Value: 'Teams' },
  Estado: { Value: 'En levantamiento' },
  NotificarAlFinalizar: false,
  AprobadorPiloto: null,
};

describe('mapeadores SharePoint', () => {
  it('item → dominio', () => {
    const v = mapearVerificacion(item);
    expect(v).toMatchObject({
      id: 12,
      codigo: 'VU-00012',
      solucionId: 1,
      solucionNombre: 'Plan de entregas',
      responsable: { email: 'alexandra.durand@biomont.example', nombre: 'Alexandra Durand' },
      fechaObjetivo: '2026-08-15',
      fechaAlerta: '2026-07-31',
      estado: 'En levantamiento',
      aprobadorPiloto: null,
      objetivo: '',
    });
  });

  it('dominio → escritura parcial con nombres internos', () => {
    const escritura = verificacionASP({
      estado: 'En revisión',
      solucionId: 3,
      aprobadorPiloto: { email: 'a@b.example', nombre: 'A' },
      indiceAdopcion: 72,
    });
    expect(escritura).toEqual({
      Estado: { '@odata.type': expect.any(String), Value: 'En revisión' },
      Solucion: { '@odata.type': expect.any(String), Id: 3 },
      AprobadorPiloto: expect.objectContaining({ Claims: 'i:0#.f|membership|a@b.example', Email: 'a@b.example' }),
      IndiceAdopcion: 72,
    });
  });

  it('utilidades OData', () => {
    expect(filtroPorBusqueda('Verificacion', 12)).toBe('Verificacion/Id eq 12');
    expect(literalOData("O'Brien")).toBe("'O''Brien'");
  });

  it('los repositorios sin conectar rechazan con un TODO explícito', async () => {
    const repos = crearRepositoriosSharePoint();
    await expect(repos.verificaciones.listar()).rejects.toThrow(
      'TODO: conectar servicio generado por pac code add-data-source para VU_Verificaciones',
    );
  });
});
