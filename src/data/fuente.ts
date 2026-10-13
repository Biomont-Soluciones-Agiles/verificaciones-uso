import { crearRepositoriosDataverse } from './dataverse/repositoriosDataverse';
import { crearRepositoriosMock } from './mock/repositoriosMock';
import type { Repositorios } from './repositorios';

export type FuenteDatos = 'dataverse' | 'mock';

/** `VITE_DATA_SOURCE` (ver `.env.example`); `dataverse` por defecto (§3.5). */
export function fuenteConfigurada(): FuenteDatos {
  return import.meta.env.VITE_DATA_SOURCE === 'mock' ? 'mock' : 'dataverse';
}

export function crearRepositorios(fuente: FuenteDatos = fuenteConfigurada()): Repositorios {
  return fuente === 'mock' ? crearRepositoriosMock() : crearRepositoriosDataverse();
}
