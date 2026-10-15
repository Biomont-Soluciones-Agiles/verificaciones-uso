# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Responsable de la verificación** (equipo de Proyectos Ágiles / Sistema Integrado de Gestión de Laboratorios Biomont): programa la verificación de uso de una solución digital interna, coordina y registra las entrevistas con sus usuarios, puntúa los 4 criterios con sustento y la envía a aprobación. Necesita el rol de seguridad *VU Responsable*.
- **Aprobadora de la verificación** (una sola): recibe la solicitud por Approvals en Teams u Outlook y responde Aprobar, Observar o Rechazar; puede abrir la app para revisar las entrevistas (solo lectura).
- **Administrador**: mantiene los catálogos (soluciones, áreas, criterios y sus pesos, preguntas).
- Los entrevistados no usan la app; el responsable registra sus respuestas.

## Product Purpose

Gestionar el ciclo de **Verificación de Uso (VU)** de las soluciones digitales internas de Biomont (Power Apps, flujos, reportes): programar, entrevistar, evaluar con un índice de adopción, consolidar hallazgos y aprobar en dos niveles. El éxito significa, a la vez:

- que ninguna solución tenga su verificación vencida (alertas anticipadas y recordatorios de vencimiento);
- que el índice y los hallazgos sirvan como evidencia para decidir sobre cada solución (mejorar, retirar o escalar);
- que el Excel de verificaciones deje de usarse y todo quede trazable en un sistema;
- que cada verificación quede aprobada formalmente en dos niveles, con constancia.

## Positioning

Reemplaza un Excel por un proceso con reglas: la fórmula del índice, el umbral de resultado, la obligación de sustentar los ajustes manuales y las aprobaciones quedan fijados en el sistema, no en la disciplina de quien llena la hoja. Mientras el levantamiento no esté completo no se notifica a nadie (RN-06).

## Operating Context

- Se usa en **escritorio y en móvil**: en la oficina, a menudo durante una llamada de Teams mientras se entrevista, y también en planta o en campo desde el celular.
- Flujo por etapas de cada verificación: Programación → Entrevistas → Evaluación → Revisión (consolidado y envío) → aprobación. Cada etapa exige completar la anterior.
- Avisos fuera de la app: correos de alerta anticipada y de vencimiento, solicitudes de Approvals y tarjetas de Teams (Power Automate).
- Las verificaciones se repiten periódicamente (por defecto cada 6 meses por solución).

## Capabilities and Constraints

- **Plataforma**: Power Apps Code App (React 19, TypeScript, Fluent UI v9) dentro del host de Power Apps; datos en Dataverse (tablas `vu_*`); flujos F1–F4 en Power Automate. La política de seguridad de contenido (CSP) del host limita recursos externos (fuentes, scripts).
- **Idioma**: toda la interfaz, el código y los documentos están en español (Perú, `es-PE`).
- **Reglas de negocio** (RN-01…RN-10 en `docs/diseno-verificacion-uso.md`): índice de adopción = Σ(puntaje × peso) / 10 en %, redondeado a entero como el prototipo; resultado Adopción plena ≥ 75 %, parcial 50–74 %, baja < 50 %; 4 criterios (Frecuencia, Cobertura, Sustitución, Satisfacción) con pesos que suman 100; 11 preguntas de puntaje 1–10, dos de ellas opcionales ("si corresponde").
- **Seguridad**: roles de Dataverse *VU Lector*, *VU Responsable*, *VU Aprobador*, *VU Administrador*, más *Basic User*.
- **Abierto**: la app aún no adapta la interfaz al rol (todos ven Administración); la propiedad de la verificación no se transfiere al responsable elegido; los flujos usan por ahora la cuenta del desarrollador y deben pasar a una cuenta de servicio.

## Brand Commitments

- Es una herramienta interna de **Laboratorios Biomont**. El usuario pidió explícitamente que la interfaz siga los colores e interfaz del sitio corporativo https://biomont.com.pe/.

## Evidence on Hand

- Prototipo original: `docs/referencia/prototipo-original.html` (pantallas, flujo y fórmula del índice).
- Excel de verificaciones del área ("Verificación de uso - Planes de trabajo.xlsx", OneDrive de Proyectos Ágiles), con la hoja "Criterios (validar)": fuente de las 11 preguntas y de los umbrales del resultado.
- Catálogo real de 16 soluciones importado desde la lista SharePoint "Apps", con 3 verificaciones históricas aprobadas.
- No hay testimonios, métricas de uso de la app ni casos documentados: no inventarlos.

## Product Principles

1. **Nada se notifica antes de tiempo**: guardar avance nunca dispara avisos; solo los cambios de estado los disparan.
2. **Cada número tiene sustento**: un puntaje ajustado a mano exige justificación, y el índice se calcula, no se escribe.
3. **El proceso es más confiable que la hoja**: reglas, estados y aprobaciones viven en el sistema, no en la memoria de quien lo usa.
4. **Funciona donde ocurre la entrevista**: en una llamada de escritorio o en el celular en planta.
