/** Error de reglas de negocio con la lista de motivos para mostrar al usuario. */
export class ErrorValidacion extends Error {
  readonly errores: string[];

  constructor(errores: string[]) {
    super(errores.join(' '));
    this.name = 'ErrorValidacion';
    this.errores = errores;
  }
}

export class ErrorNoEncontrado extends Error {
  constructor(entidad: string, id: number) {
    super(`No se encontró ${entidad} con ID ${id}.`);
    this.name = 'ErrorNoEncontrado';
  }
}

/** Texto legible de cualquier error (para avisos). */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorValidacion) return error.errores.join(' ');
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}
