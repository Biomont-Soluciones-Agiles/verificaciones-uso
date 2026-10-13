import { createContext, useContext } from 'react';
import type { FuenteDatos } from './fuente';
import type { Repositorios } from './repositorios';

export interface ValorRepositorios {
  repos: Repositorios;
  fuente: FuenteDatos;
}

export const RepositoriosContext = createContext<ValorRepositorios | null>(null);

export function useRepositorios(): Repositorios {
  const valor = useContext(RepositoriosContext);
  if (!valor) throw new Error('useRepositorios debe usarse dentro de <RepositoriesProvider>.');
  return valor.repos;
}

export function useFuenteDatos(): FuenteDatos {
  const valor = useContext(RepositoriosContext);
  if (!valor) throw new Error('useFuenteDatos debe usarse dentro de <RepositoriesProvider>.');
  return valor.fuente;
}
