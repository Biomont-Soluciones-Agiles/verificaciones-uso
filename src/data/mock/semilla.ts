import type {
  Aprobacion,
  Area,
  Criterio,
  Documento,
  Entrevista,
  Evidencia,
  OpcionRespuesta,
  Persona,
  Pregunta,
  PuntajeCriterio,
  Respuesta,
  Solucion,
  Verificacion,
} from '../../domain/tipos';

/**
 * Datos de ejemplo tomados del prototipo (`docs/referencia/prototipo-original.html`)
 * y de los datos semilla del diseño (§2.6). Los correos usan el dominio reservado
 * `.example` para que nunca se confundan con cuentas reales.
 */

function persona(nombre: string, usuario: string): Persona {
  return { nombre, email: `${usuario}@biomont.example` };
}

export const PERSONAS = {
  alexandra: persona('Alexandra Durand', 'alexandra.durand'),
  denis: persona('Denis Alayo Mergildo', 'denis.alayo'),
  maria: persona('María Torres', 'maria.torres'),
  jorge: persona('Jorge Salas', 'jorge.salas'),
  lucia: persona('Lucía Campos', 'lucia.campos'),
  pedro: persona('Pedro Núñez', 'pedro.nunez'),
  carlos: persona('Carlos Ramos', 'carlos.ramos'),
  andrea: persona('Andrea León', 'andrea.leon'),
  rosa: persona('Rosa Vega', 'rosa.vega'),
} as const;

export interface Semilla {
  usuarioActual: Persona;
  personas: Persona[];
  areas: Area[];
  soluciones: Solucion[];
  documentos: Documento[];
  criterios: Criterio[];
  preguntas: Pregunta[];
  opciones: OpcionRespuesta[];
  verificaciones: Verificacion[];
  entrevistas: Entrevista[];
  respuestas: Respuesta[];
  puntajes: PuntajeCriterio[];
  evidencias: Evidencia[];
  aprobaciones: Aprobacion[];
}

const SITIO = 'https://biomont.sharepoint.com/sites/VerificacionUso';

function documentosDe(solucionId: string, primerId: number, carpeta: string): Documento[] {
  return [
    {
      id: String(primerId),
      titulo: 'Manual de usuario',
      solucionId,
      tipo: 'Manual',
      formato: 'PDF',
      enlace: `${SITIO}/Documentos/${carpeta}/manual-usuario.pdf`,
      version: 'versión vigente',
      vigente: true,
    },
    {
      id: String(primerId + 1),
      titulo: 'Instructivo operativo',
      solucionId,
      tipo: 'Instructivo',
      formato: 'PDF',
      enlace: `${SITIO}/Documentos/${carpeta}/instructivo-operativo.pdf`,
      version: 'pasos del proceso',
      vigente: true,
    },
    {
      id: String(primerId + 2),
      titulo: 'Video demostrativo',
      solucionId,
      tipo: 'Video',
      formato: 'Teams',
      enlace: `${SITIO}/Videos/${carpeta}/capacitacion.mp4`,
      version: 'capacitación',
      vigente: true,
    },
    {
      id: String(primerId + 3),
      titulo: 'Documentación funcional',
      solucionId,
      tipo: 'Carpeta',
      formato: 'SharePoint',
      enlace: `${SITIO}/Documentos/${carpeta}`,
      version: null,
      vigente: true,
    },
  ];
}

export function crearSemilla(): Semilla {
  const P = PERSONAS;

  const areas: Area[] = [
    { id: '1', titulo: 'Operaciones', tipo: 'Proceso', areaPadreId: null, activo: true },
    { id: '2', titulo: 'Producción', tipo: 'Proceso', areaPadreId: null, activo: true },
    { id: '3', titulo: 'Comercial', tipo: 'Proceso', areaPadreId: null, activo: true },
    { id: '4', titulo: 'Comercio exterior', tipo: 'Proceso', areaPadreId: null, activo: true },
    { id: '5', titulo: 'Despacho', tipo: 'Área', areaPadreId: '1', activo: true },
    { id: '6', titulo: 'Logística', tipo: 'Área', areaPadreId: '1', activo: true },
    { id: '7', titulo: 'Almacén', tipo: 'Área', areaPadreId: '1', activo: true },
  ];

  const soluciones: Solucion[] = [
    {
      id: '1',
      titulo: 'Plan de entregas',
      descripcion: 'Power App para programar, consultar y confirmar entregas.',
      tipoSolucion: 'Power App',
      procesoId: '1',
      procesoNombre: 'Operaciones',
      responsable: P.maria,
      usuariosObjetivo: 18,
      fechaActualizacion: '2026-07-08',
      periodicidadMeses: 6,
      proximaVU: '2026-08-15',
      // Derivado (§2.5) de VU-00001 "En levantamiento".
      estadoVU: 'En proceso',
      ultimaVerificacionId: '1',
    },
    {
      id: '2',
      titulo: 'Programa de producción semanal',
      descripcion: 'Solución para organizar y comunicar el programa semanal de fabricación.',
      tipoSolucion: 'Power App',
      procesoId: '2',
      procesoNombre: 'Producción',
      responsable: P.carlos,
      usuariosObjetivo: 12,
      fechaActualizacion: '2026-07-02',
      periodicidadMeses: 6,
      proximaVU: '2026-12-23',
      estadoVU: 'Vigente',
      ultimaVerificacionId: null,
    },
    {
      id: '3',
      titulo: 'Planes de trabajo',
      descripcion: 'Aplicación para registrar y dar seguimiento a los planes de trabajo comercial.',
      tipoSolucion: 'Power App',
      procesoId: '3',
      procesoNombre: 'Comercial',
      responsable: P.andrea,
      usuariosObjetivo: 24,
      fechaActualizacion: '2026-06-18',
      periodicidadMeses: 6,
      proximaVU: '2027-02-06',
      estadoVU: 'Vigente',
      ultimaVerificacionId: null,
    },
    {
      id: '4',
      titulo: 'Seguimiento de exportaciones',
      descripcion: 'Aplicación para controlar hitos y documentos de las exportaciones.',
      tipoSolucion: 'Power App',
      procesoId: '4',
      procesoNombre: 'Comercio exterior',
      responsable: P.rosa,
      usuariosObjetivo: 9,
      fechaActualizacion: '2026-06-30',
      periodicidadMeses: 6,
      proximaVU: null,
      estadoVU: 'Pendiente',
      ultimaVerificacionId: null,
    },
  ];

  const documentos: Documento[] = [
    ...documentosDe('1', 1, 'plan-entregas'),
    ...documentosDe('2', 5, 'programa-produccion'),
    ...documentosDe('3', 9, 'planes-trabajo'),
    ...documentosDe('4', 13, 'seguimiento-exportaciones'),
  ];

  const criterios: Criterio[] = [
    { id: '1', titulo: 'Frecuencia', peso: 30, orden: 1, activo: true },
    { id: '2', titulo: 'Cobertura', peso: 25, orden: 2, activo: true },
    { id: '3', titulo: 'Sustitución', peso: 30, orden: 3, activo: true },
    { id: '4', titulo: 'Satisfacción', peso: 15, orden: 4, activo: true },
  ];

  const preguntas: Pregunta[] = [
    {
      id: '1',
      titulo: '¿Con qué frecuencia utiliza la solución?',
      criterioId: '1',
      tipoRespuesta: 'Selección',
      orden: 1,
      obligatoria: true,
      activo: true,
    },
  ];

  const opciones: OpcionRespuesta[] = [
    { id: '1', titulo: 'Diariamente', preguntaId: '1', puntajeSugerido: 9, orden: 1 },
    { id: '2', titulo: 'Varias veces por semana', preguntaId: '1', puntajeSugerido: 8, orden: 2 },
    { id: '3', titulo: 'Semanalmente', preguntaId: '1', puntajeSugerido: 6, orden: 3 },
    { id: '4', titulo: 'Ocasionalmente', preguntaId: '1', puntajeSugerido: 4, orden: 4 },
    { id: '5', titulo: 'No la utiliza', preguntaId: '1', puntajeSugerido: 1, orden: 5 },
  ];

  const verificaciones: Verificacion[] = [
    {
      id: '1',
      codigo: 'VU-00001',
      solucionId: '1',
      solucionNombre: 'Plan de entregas',
      responsable: P.alexandra,
      fechaObjetivo: '2026-08-15',
      diasAnticipacion: 15,
      fechaAlerta: '2026-07-31',
      alertaEnviada: true,
      entrevistasPrevistas: 4,
      entrevistasCompletas: 2,
      modalidad: 'Teams',
      objetivo:
        'Validar frecuencia, cobertura, sustitución del proceso anterior y satisfacción de los usuarios.',
      estado: 'En levantamiento',
      indiceAdopcion: 72,
      resultado: 'Adopción parcial',
      sustentoGlobal:
        'La solución se usa con frecuencia y tiene buena aceptación. La cobertura y sustitución aún son parciales por dependencia de pocos usuarios y un apoyo manual.',
      oportunidadesConsolidadas: '',
      recomendacionesConsolidadas: '',
      aprobadorPiloto: P.alexandra,
      aprobadorProductivo: P.denis,
      notificarAlFinalizar: false,
      fechaEnvio: null,
      fechaAprobacion: null,
    },
  ];

  const grabacion = (n: number) => `${SITIO}/Grabaciones/VU-00001/grabacion-entrevista-${n}.mp4`;

  const entrevistas: Entrevista[] = [
    {
      id: '1',
      verificacionId: '1',
      numero: 1,
      titulo: 'Entrevista 1 – María Torres',
      entrevistado: P.maria,
      entrevistadoNombre: 'María Torres',
      areaId: '1',
      areaNombre: 'Operaciones',
      fechaHora: '2026-08-10T15:00:00.000Z',
      modalidad: 'Teams',
      estado: 'Completa',
      urlGrabacion: grabacion(1),
      oportunidadesMejora: 'Ampliar el conocimiento operativo a usuarios reemplazantes.',
      recomendaciones: 'Capacitar a dos usuarios adicionales.',
      fechaCompletada: '2026-08-10T16:10:00.000Z',
    },
    {
      id: '2',
      verificacionId: '1',
      numero: 2,
      titulo: 'Entrevista 2 – Jorge Salas',
      entrevistado: P.jorge,
      entrevistadoNombre: 'Jorge Salas',
      areaId: '5',
      areaNombre: 'Despacho',
      fechaHora: '2026-08-11T15:00:00.000Z',
      modalidad: 'Teams',
      estado: 'Completa',
      urlGrabacion: grabacion(2),
      oportunidadesMejora:
        'Eliminar la hoja auxiliar usada cuando falta el responsable habitual.\nRevisar permisos y cobertura por rol.',
      recomendaciones: 'Publicar una guía rápida y programar una revisión de seguimiento en 60 días.',
      fechaCompletada: '2026-08-11T16:05:00.000Z',
    },
    {
      id: '3',
      verificacionId: '1',
      numero: 3,
      titulo: 'Entrevista 3 – Lucía Campos',
      entrevistado: P.lucia,
      entrevistadoNombre: 'Lucía Campos',
      areaId: '6',
      areaNombre: 'Logística',
      fechaHora: '2026-08-12T15:00:00.000Z',
      modalidad: 'Teams',
      estado: 'En curso',
      urlGrabacion: 'https://biomont.sharepoint.com/grabacion-entrevista-3',
      oportunidadesMejora: 'Incluir una guía rápida para usuarios reemplazantes y eliminar la hoja auxiliar.',
      recomendaciones: 'Capacitar a dos usuarios adicionales y revisar permisos por rol.',
      fechaCompletada: null,
    },
    {
      id: '4',
      verificacionId: '1',
      numero: 4,
      titulo: 'Entrevista 4 – Pedro Núñez',
      entrevistado: P.pedro,
      entrevistadoNombre: 'Pedro Núñez',
      areaId: '7',
      areaNombre: 'Almacén',
      fechaHora: null,
      modalidad: null,
      estado: 'Pendiente',
      urlGrabacion: null,
      oportunidadesMejora: '',
      recomendaciones: '',
      fechaCompletada: null,
    },
  ];

  const PREGUNTA_FRECUENCIA = '¿Con qué frecuencia utiliza la solución?';
  const r = (
    id: number,
    entrevistaId: number,
    datos: Partial<Respuesta> & Pick<Respuesta, 'origen' | 'criterioId' | 'orden'>,
  ): Respuesta => ({
    id: String(id),
    titulo: PREGUNTA_FRECUENCIA,
    entrevistaId: String(entrevistaId),
    verificacionId: '1',
    preguntaId: null,
    opcionId: null,
    respuestaTexto: '',
    puntaje: null,
    sustento: '',
    ...datos,
  });

  const respuestas: Respuesta[] = [
    // Entrevista 1 · María Torres (completa)
    r(1, 1, {
      origen: 'Definida',
      preguntaId: '1',
      criterioId: '1',
      opcionId: '2',
      respuestaTexto: 'Varias veces por semana',
      puntaje: 8,
      sustento: 'Registra y confirma entregas varias veces por semana.',
      orden: 1,
    }),
    r(2, 1, {
      origen: 'Surgida en reunión',
      titulo: '¿Quién la reemplaza cuando no está disponible?',
      criterioId: '2',
      respuestaTexto: 'Un compañero de despacho, aunque necesita apoyo para completar el plan.',
      puntaje: 6,
      sustento: 'La cobertura depende de pocas personas.',
      orden: 2,
    }),
    r(3, 1, {
      origen: 'Surgida en reunión',
      titulo: '¿Sigue usando algún registro fuera de la aplicación?',
      criterioId: '3',
      respuestaTexto: 'Una planilla para casos urgentes.',
      puntaje: 7,
      sustento: 'Sustitución parcial del proceso anterior.',
      orden: 3,
    }),
    r(4, 1, {
      origen: 'Surgida en reunión',
      titulo: '¿Qué tan satisfecha está con la solución?',
      criterioId: '4',
      respuestaTexto: 'Muy satisfecha; ahorra tiempo de coordinación.',
      puntaje: 8,
      orden: 4,
    }),
    // Entrevista 2 · Jorge Salas (completa)
    r(5, 2, {
      origen: 'Definida',
      preguntaId: '1',
      criterioId: '1',
      opcionId: '2',
      respuestaTexto: 'Varias veces por semana',
      puntaje: 8,
      sustento: 'Consulta el plan antes de cada despacho.',
      orden: 1,
    }),
    r(6, 2, {
      origen: 'Surgida en reunión',
      titulo: '¿Todo el equipo de despacho usa la aplicación?',
      criterioId: '2',
      respuestaTexto: 'Solo el turno de mañana; el turno de tarde recibe el plan impreso.',
      puntaje: 6,
      sustento: 'Cobertura parcial por turnos.',
      orden: 2,
    }),
    r(7, 2, {
      origen: 'Surgida en reunión',
      titulo: '¿Se dejó de usar la hoja de cálculo anterior?',
      criterioId: '3',
      respuestaTexto: 'Se usa como respaldo cuando falta el responsable habitual.',
      puntaje: 7,
      sustento: 'Aún existe un apoyo manual.',
      orden: 3,
    }),
    r(8, 2, {
      origen: 'Surgida en reunión',
      titulo: '¿Recomendaría la solución a otras áreas?',
      criterioId: '4',
      respuestaTexto: 'Sí, simplificó la coordinación con transporte.',
      puntaje: 8,
      orden: 4,
    }),
    // Entrevista 3 · Lucía Campos (en curso)
    r(9, 3, {
      origen: 'Definida',
      preguntaId: '1',
      criterioId: '1',
      opcionId: '1',
      respuestaTexto: 'Diariamente',
      puntaje: 9,
      sustento: 'Consulta y actualiza el plan al inicio y al cierre de cada jornada.',
      orden: 1,
    }),
    r(10, 3, {
      origen: 'Surgida en reunión',
      titulo: '¿Qué ocurre cuando el responsable habitual no está disponible?',
      criterioId: '2',
      respuestaTexto: 'Solo dos personas conocen el flujo completo; el reemplazo consulta una hoja auxiliar.',
      puntaje: 5,
      sustento: 'La cobertura depende de conocimiento concentrado y aún existe un apoyo fuera de la aplicación.',
      orden: 2,
    }),
  ];

  const puntajes: PuntajeCriterio[] = criterios.map((c, i) => {
    const valor = [8, 6, 7, 8][i];
    return {
      id: String(i + 1),
      titulo: c.titulo,
      verificacionId: '1',
      criterioId: c.id,
      peso: c.peso,
      puntajeSugerido: valor,
      puntajeFinal: valor,
      sustentoAjuste: '',
    };
  });

  const ev = (id: number, entrevistaId: number, nombreArchivo: string, respuestaId: number | null = null): Evidencia => ({
    id: String(id),
    nombreArchivo,
    url: null,
    verificacionId: '1',
    entrevistaId: String(entrevistaId),
    respuestaId: respuestaId === null ? null : String(respuestaId),
    tipo: 'Captura',
  });

  const evidencias: Evidencia[] = [
    ev(1, 1, 'plan-semanal.png'),
    ev(2, 1, 'confirmacion-entrega.png'),
    ev(3, 1, 'reporte-incidencias.png'),
    ev(4, 2, 'pantalla-despacho.png'),
    ev(5, 2, 'hoja-respaldo.png'),
    ev(6, 3, 'hoja-auxiliar.png', 10),
    ev(7, 3, 'flujo-reemplazo.png'),
  ];

  return {
    usuarioActual: P.alexandra,
    personas: Object.values(P),
    areas,
    soluciones,
    documentos,
    criterios,
    preguntas,
    opciones,
    verificaciones,
    entrevistas,
    respuestas,
    puntajes,
    evidencias,
    aprobaciones: [],
  };
}
