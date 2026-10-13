import type { Id } from '../../domain/tipos';

/** Claves de React Query. Invalidar un prefijo invalida también sus hijas. */
export const claves = {
  soluciones: ['soluciones'] as const,
  documentos: (solucionId: Id) => ['documentos', solucionId] as const,
  todosLosDocumentos: ['documentos'] as const,
  verificaciones: ['verificaciones'] as const,
  verificacion: (id: Id) => ['verificaciones', id] as const,
  entrevistas: (verificacionId: Id) => ['entrevistas', verificacionId] as const,
  respuestas: (verificacionId: Id) => ['respuestas', verificacionId] as const,
  respuestasEntrevista: (entrevistaId: Id) => ['respuestas-entrevista', entrevistaId] as const,
  puntajes: (verificacionId: Id) => ['puntajes', verificacionId] as const,
  evidencias: (verificacionId: Id) => ['evidencias', verificacionId] as const,
  aprobaciones: (verificacionId: Id) => ['aprobaciones', verificacionId] as const,
  areas: ['catalogo', 'areas'] as const,
  criterios: ['catalogo', 'criterios'] as const,
  preguntas: ['catalogo', 'preguntas'] as const,
  opciones: ['catalogo', 'opciones'] as const,
  usuarioActual: ['directorio', 'usuario-actual'] as const,
  personas: ['directorio', 'personas'] as const,
};

/** Clave de mutación compartida por el autoguardado (indicador "Guardando…"). */
export const CLAVE_AUTOGUARDADO = ['autoguardado'] as const;
