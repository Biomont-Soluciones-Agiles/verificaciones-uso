import type { Id } from '../../domain/tipos';
import { ErrorNoEncontrado } from '../errores';
import type { Cambios, SinId } from '../repositorios';

/** Tabla en memoria con IDs autoincrementales (como texto, igual que los GUID); devuelve siempre copias. */
export interface Tabla<T extends { id: Id }> {
  todos(): T[];
  donde(predicado: (fila: T) => boolean): T[];
  buscar(id: Id): T | null;
  obtener(id: Id): T;
  insertar(datos: SinId<T>): T;
  actualizar(id: Id, cambios: Cambios<T>): T;
  eliminar(id: Id): void;
  eliminarDonde(predicado: (fila: T) => boolean): void;
}

function copiar<T>(valor: T): T {
  return structuredClone(valor);
}

function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function crearTabla<T extends { id: Id }>(entidad: string, filasIniciales: readonly T[]): Tabla<T> {
  let filas: T[] = filasIniciales.map(copiar);
  let siguienteId = filas.reduce((max, f) => Math.max(max, Number(f.id) || 0), 0) + 1;

  const obtener = (id: Id): T => {
    const fila = filas.find((f) => f.id === id);
    if (!fila) throw new ErrorNoEncontrado(entidad, id);
    return fila;
  };

  return {
    todos: () => filas.map(copiar),
    donde: (predicado) => filas.filter(predicado).map(copiar),
    buscar: (id) => {
      const fila = filas.find((f) => f.id === id);
      return fila ? copiar(fila) : null;
    },
    obtener: (id) => copiar(obtener(id)),
    insertar: (datos) => {
      const fila = { ...copiar(datos), id: String(siguienteId++) } as T;
      filas.push(fila);
      return copiar(fila);
    },
    actualizar: (id, cambios) => {
      const actual = obtener(id);
      const nueva = { ...actual, ...copiar(sinIndefinidos(cambios)), id } as T;
      filas = filas.map((f) => (f.id === id ? nueva : f));
      return copiar(nueva);
    },
    eliminar: (id) => {
      obtener(id);
      filas = filas.filter((f) => f.id !== id);
    },
    eliminarDonde: (predicado) => {
      filas = filas.filter((f) => !predicado(f));
    },
  };
}
