/**
 * Nombres de las listas (§2) y utilidades OData para el conector SharePoint Online.
 * El sitio y los nombres por entorno se parametrizan en la solución con las variables
 * de entorno `vu_SiteUrl` y nombres de listas (§3.7).
 */
export const LISTAS = {
  areas: 'VU_Areas',
  soluciones: 'VU_Soluciones',
  documentos: 'VU_DocumentosSolucion',
  criterios: 'VU_Criterios',
  preguntas: 'VU_Preguntas',
  opciones: 'VU_OpcionesRespuesta',
  verificaciones: 'VU_Verificaciones',
  entrevistas: 'VU_Entrevistas',
  respuestas: 'VU_Respuestas',
  puntajes: 'VU_PuntajesCriterio',
  aprobaciones: 'VU_Aprobaciones',
  notificaciones: 'VU_Notificaciones',
  evidencias: 'VU_Evidencias',
} as const;

export type NombreLista = (typeof LISTAS)[keyof typeof LISTAS];

/**
 * Filtro por el ID de una columna de búsqueda indexada (🔎 en §2.3).
 * TODO(validar con el conector): el conector acepta `Columna/Id eq N`; si la versión
 * generada no lo admite, usar el campo proyectado `ColumnaId eq N`.
 */
export function filtroPorBusqueda(columna: string, id: number): string {
  if (!Number.isInteger(id)) throw new Error(`ID inválido para filtrar ${columna}: ${id}`);
  return `${columna}/Id eq ${id}`;
}

/** Escapa un literal de texto para `$filter`. */
export function literalOData(texto: string): string {
  return `'${texto.replace(/'/g, "''")}'`;
}

/** Columnas mínimas por consulta (`$select`) para no superar el límite de 12 búsquedas/personas. */
export const SELECT = {
  verificaciones: [
    'ID', 'Title', 'Solucion', 'Responsable', 'FechaObjetivo', 'DiasAnticipacion', 'FechaAlerta',
    'AlertaEnviada', 'EntrevistasPrevistas', 'EntrevistasCompletas', 'Modalidad', 'Objetivo', 'Estado',
    'IndiceAdopcion', 'Resultado', 'SustentoGlobal', 'OportunidadesConsolidadas', 'RecomendacionesConsolidadas',
    'AprobadorPiloto', 'AprobadorProductivo', 'NotificarAlFinalizar', 'FechaEnvio', 'FechaAprobacion',
  ],
  respuestas: [
    'ID', 'Title', 'Entrevista', 'Verificacion', 'Origen', 'Pregunta', 'Criterio', 'Opcion',
    'RespuestaTexto', 'Puntaje', 'Sustento', 'Orden',
  ],
} as const;
