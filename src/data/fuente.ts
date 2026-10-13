import { crearRepositoriosMock } from './mock/repositoriosMock';
import type { Repositorios } from './repositorios';
import { crearRepositoriosSharePoint } from './sharepoint/repositoriosSharePoint';

export type FuenteDatos = 'mock' | 'sharepoint';

/** `VITE_DATA_SOURCE` (ver `.env.example`); `mock` por defecto. */
export function fuenteConfigurada(): FuenteDatos {
  return import.meta.env.VITE_DATA_SOURCE === 'sharepoint' ? 'sharepoint' : 'mock';
}

export function crearRepositorios(fuente: FuenteDatos = fuenteConfigurada()): Repositorios {
  return fuente === 'sharepoint' ? crearRepositoriosSharePoint() : crearRepositoriosMock();
}
