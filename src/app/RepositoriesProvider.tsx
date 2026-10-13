import { useState, type ReactNode } from 'react';
import { RepositoriosContext, type ValorRepositorios } from '../data/contexto';
import { crearRepositorios, fuenteConfigurada } from '../data/fuente';

export interface RepositoriesProviderProps {
  children: ReactNode;
  /** Para pruebas o historias: repositorios ya construidos. */
  valor?: ValorRepositorios;
}

/** Inyecta la implementación de repositorios elegida por `VITE_DATA_SOURCE`. */
export function RepositoriesProvider({ children, valor }: RepositoriesProviderProps) {
  const [actual] = useState<ValorRepositorios>(() => {
    if (valor) return valor;
    const fuente = fuenteConfigurada();
    return { fuente, repos: crearRepositorios(fuente) };
  });
  return <RepositoriosContext.Provider value={actual}>{children}</RepositoriosContext.Provider>;
}
