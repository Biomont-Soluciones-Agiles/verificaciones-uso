# Power Automate · Verificación de uso

Definiciones de los cuatro flujos de la app *Verificación de uso* (Biomont), que se apoyan en las listas SharePoint de `https://biomont.sharepoint.com/sites/VerificacionUso`. La fuente de verdad es [`docs/diseno-verificacion-uso.md`](../../docs/diseno-verificacion-uso.md): §1.3 (reglas), §2.3 (nombres internos), §2.4 y §2.5 (estados), §3.3 (flujos) y §3.6 (seguridad).

| Flujo | Carpeta | Disparador | Qué hace | Conexiones |
|---|---|---|---|---|
| **F1** Alerta anticipada | [`F1-AlertaAnticipada`](F1-AlertaAnticipada/README.md) | Recurrencia diaria a las 07:00 (Lima) | `Programada` + `FechaAlerta ≤ hoy` + `AlertaEnviada = No` → correo al **responsable**, `AlertaEnviada = Sí` y bitácora | SharePoint, Outlook |
| **F2** Envío a revisión | [`F2-EnvioRevision`](F2-EnvioRevision/README.md) | *When an item or a file is modified* en `VU_Verificaciones` (Estado = En revisión, editor ≠ cuenta de servicio, concurrencia 1) | Revalida RN-07 → aprobación del piloto → aprobación productiva (Approvals con respuestas Aprobar/Observar/Rechazar) → estados, `FechaAprobacion`, `ProximaVU`, `EstadoVU` y avisos | SharePoint, Approvals, Outlook, Teams |
| **F3** Estado de la solución | [`F3-EstadoSolucion`](F3-EstadoSolucion/README.md) | *When an item is created or modified* en `VU_Verificaciones` (editor ≠ cuenta de servicio) | Recalcula `EstadoVU` y `UltimaVerificacionId` (§2.5) | SharePoint |
| **F4** Vencimiento | [`F4-Vencimiento`](F4-Vencimiento/README.md) | Recurrencia semanal, lunes a las 07:00 (Lima) | `ProximaVU ≤ hoy + 30` y sin verificación activa → recordatorio al responsable de la solución; si ya venció, `EstadoVU = Pendiente` | SharePoint, Outlook |

> **RN-06 por diseño.** Ningún flujo se dispara desde `VU_Entrevistas`, `VU_Respuestas`, `VU_PuntajesCriterio` ni `VU_Evidencias`. El autoguardado y "Guardar avance sin notificar" no pueden generar avisos. F2 solo **lee** `VU_Entrevistas` para revalidar RN-07. La primera notificación a la aprobadora es la solicitud de Approvals que envía F2. F1 solo escribe al responsable. Todo envío queda en `VU_Notificaciones`, con `EstadoEnvio` en `Enviada` o `Error`.

## Formato de los archivos

Cada `definition.json` sigue el formato de un flujo de solución:

```json
{ "properties": { "connectionReferences": { … }, "definition": { "$schema": ".../workflowdefinition.json#", … } }, "schemaVersion": "1.0.0.0" }
```

- Acciones `OpenApiConnection` y `OpenApiConnectionWebhook` (Approvals) con `host.connectionName`, `operationId` y `apiId`.
- Las acciones **no** llevan `inputs.authentication`: Power Automate lo añade al guardar. Si se incluye, la API de flujos rechaza la definición con `WorkflowRunActionInputsInvalidProperty`.
- Las variables de entorno se declaran como parámetros `"<schema> (<schema>)"` y se usan con `@parameters('vu_SiteUrl (vu_SiteUrl)')`.

### Variables de entorno (solución `VerificacionUso`, prefijo de editor `vu`)

| Nombre de esquema | Tipo | Ejemplo / valor por defecto | Usado en |
|---|---|---|---|
| `vu_SiteUrl` | Texto (o *Origen de datos*: sitio SharePoint) | `https://biomont.sharepoint.com/sites/VerificacionUso` | F1–F4 |
| `vu_ListaVerificaciones` | Texto (o *Origen de datos*: lista) | `VU_Verificaciones` | F1–F4 |
| `vu_ListaSoluciones` | Texto (o *Origen de datos*: lista) | `VU_Soluciones` | F2, F3, F4 |
| `vu_ListaEntrevistas` | Texto (o *Origen de datos*: lista) | `VU_Entrevistas` | F2 (solo lectura) |
| `vu_ListaAprobaciones` | Texto (o *Origen de datos*: lista) | `VU_Aprobaciones` | F2 |
| `vu_ListaNotificaciones` | Texto (o *Origen de datos*: lista) | `VU_Notificaciones` | F1, F2, F4 |
| `vu_CuentaServicioEmail` | Texto | `svc-flujos-vu@biomont.com.pe` (ejemplo; **obligatorio**, sin valor por defecto) | F2, F3 (condición antibucle) |

- **Valor de las listas.** El parámetro `table` del conector acepta el **título** o el **GUID** de la lista. `Provision-VerificacionUso.ps1` deja el título igual al nombre interno (`VU_…`), salvo que se ejecute con `-TitulosEnEspanol`. En ese caso hay que usar el GUID (o el título en español). Se recomienda el tipo *Origen de datos*, que guarda el GUID y no depende del título.
- **`vu_CuentaServicioEmail`** debe ser el correo (UPN) de la cuenta dueña de las conexiones. Si queda vacío, F2 sigue sin entrar en bucle (sus propias ediciones no dejan `Estado = En revisión`), pero F3 se ejecutaría también tras las ediciones de F1 y F2.
- Si un valor se cambia directamente en el entorno, y no con una importación, los flujos siguen usando el anterior hasta que se apagan y se vuelven a encender.

### Referencias de conexión

| Nombre lógico | Conector (`api.name`) | Clave en `connectionReferences` / `host.connectionName` | Flujos |
|---|---|---|---|
| `vu_sharepoint` | SharePoint | `shared_sharepointonline` | F1–F4 |
| `vu_approvals` | Approvals | `shared_approvals` | F2 |
| `vu_office365` | Office 365 Outlook | `shared_office365` | F1, F2, F4 |
| `vu_teams` | Microsoft Teams | `shared_teams` | F2 |

Todas deben apuntar a conexiones de la **cuenta de servicio** (§3.2). Esa cuenta necesita *Editar* en el sitio (§3.6), buzón para enviar correo y licencia de Teams. Approvals muestra siempre como remitente al creador del flujo.

## Cómo importar

### A. En la solución de Power Platform `VerificacionUso` (recomendado, ALM)

1. En la solución, crea las 7 variables de entorno de la tabla y las 4 referencias de conexión con esos nombres lógicos, enlazadas a las conexiones de la cuenta de servicio.
2. Crea cada flujo dentro de la solución (*Nuevo → Automatización → Flujo de nube*) y pega la definición. Hay dos maneras:
   - Exportar la solución, colocar el contenido de cada `definition.json` en `Workflows/<flujo>.json` (clientdata) y volver a importarla.
   - Usar la herramienta de la opción B con el flujo ya asociado a la solución.
3. Abre cada flujo en el diseñador, comprueba que los parámetros resuelven y **guarda**. Al guardar se valida el esquema dinámico de SharePoint. Después **actívalo**.
4. Promoción entre entornos: exporta la solución gestionada y, al importarla en Test o Prod, informa los valores de las variables y las conexiones.

### B. Con el plugin de Power Automate (`create_flow`)

1. `resolve_refs` / `pick_or_create_connection` en el entorno destino para `shared_sharepointonline`, `shared_approvals`, `shared_office365` y `shared_teams`, con la cuenta de servicio.
2. `preflight_flow`, pasando `properties.definition` y las `connectionReferences` en el formato del plugin (`{"shared_sharepointonline": {"connectionName": "<conexión>", "source": "Embedded", "id": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"}}`).
3. `create_flow` con el nombre sugerido en el README de cada flujo. En un flujo fuera de solución, los parámetros `vu_*` toman su `defaultValue`: edítalos antes de crear el flujo (sobre todo `vu_CuentaServicioEmail`) o asocia después el flujo a la solución.

> Estas definiciones **no** se han creado en ningún entorno: este frente solo entrega los archivos.

## Cómo probar

Requisitos previos:

- Listas aprovisionadas (`infra/sharepoint/Provision-VerificacionUso.ps1`) con el **historial de versiones activo en `VU_Verificaciones`**, que necesita *Get changes* en F2.
- Datos semilla y dos usuarios de prueba (responsable y aprobadora).

| Flujo | Caso | Resultado esperado |
|---|---|---|
| F1 | Verificación `Programada` con `FechaAlerta` = hoy y `AlertaEnviada` = No. Ejecuta el flujo a mano | Correo **solo** al responsable, `AlertaEnviada = Sí`, fila *Alerta anticipada · Correo · Enviada*. Una segunda ejecución no hace nada |
| F1 | `Responsable` sin buzón | Fila *Error*, `AlertaEnviada` sigue en No y la ejecución termina *Failed* |
| F3 | Crea una verificación en `Borrador` y luego pásala a `Programada` | `EstadoVU`: `Pendiente` (o `Vigente` si la solución tiene `ProximaVU ≥ hoy`), luego `Programada`. `UltimaVerificacionId` = ID |
| F3 | Cambia `Title` sin tocar `Estado` | La ejecución termina sin escribir (no hay cambios) |
| F2 | `En revisión` con menos entrevistas `Completa` que `EntrevistasPrevistas` | Vuelve a `En evaluación`, correo con el motivo, fila *Envío a revisión*, `EstadoVU = En proceso`. No se crea ninguna aprobación |
| F2 | RN-07 OK y la aprobadora del piloto responde **Observar** | `VU_Aprobaciones` en *Observada* con el comentario, `Estado = Observada`, correo y tarjeta de Teams al responsable, 3 filas en la bitácora |
| F2 | Piloto **Aprobar** y productiva **Aprobar** | Estado `Aprobada piloto` → `Aprobada`, `FechaAprobacion`, `ProximaVU = hoy + PeriodicidadMeses`, `EstadoVU = Vigente` |
| F2 | Piloto **Aprobar** sin `AprobadorProductivo` | Se queda en `Aprobada piloto` y `EstadoVU = En revisión` |
| F2 | Editar otro campo de una verificación que ya está *En revisión* | La ejecución termina en *Terminar_sin_cambios* (*Get changes* no detecta cambio de `Estado`) |
| F4 | Solución con `ProximaVU` = hoy + 10 y sin verificación activa | Recordatorio "por vencer (en 10 días)" y fila *Recordatorio de vencimiento* |
| F4 | `ProximaVU` = ayer, sin verificación activa | Recordatorio "vencida" y `EstadoVU = Pendiente` |
| F4 | Solución con una verificación `Programada` | No hace nada |

Para que el plazo de 14 días del nivel piloto se pueda probar sin esperar, cambia temporalmente `limit.timeout` a `PT5M` en un entorno de desarrollo.

### Verificación estática (sin entorno)

```bash
python -I -c "import json,glob;[json.load(open(f,encoding='utf-8')) for f in glob.glob('infra/power-automate/**/*.json',recursive=True)]"
python -I infra/power-automate/validar_definiciones.py
```

`validar_definiciones.py` comprueba:

- Que el JSON es válido.
- La estructura: `runAfter`, referencias a acciones, `items()` dentro de su bucle, variables, parámetros, paréntesis balanceados, ausencia de `authentication` y `Terminate` fuera de bucles.
- Que las **columnas** usadas en `$filter`, `$orderby`, `item/…`, `body()`, `items()`, `triggerOutputs()` y `ColumnHasChanged` existen en §2.3 de su lista, con la subpropiedad que corresponde al tipo.
- Los **valores de elección**.
- Que cada `PostItem` y `PatchItem` envía **todas las columnas obligatorias**.
- `empty()` aplicado a columnas numéricas.
- Si existe `infra/sharepoint/schema/listas.json`, que las columnas usadas coinciden con él en existencia, obligatoriedad y valores de elección.

## Decisiones transversales

1. **`PatchItem` reenvía las columnas obligatorias.** El esquema dinámico de *Create item* y *Update item* exige las columnas *Req.* (si faltan, la API devuelve un error del tipo *requires the property 'item/Title'*). Antes de cada actualización se lee el elemento (`GetItem`) y se reenvían sus valores con el cambio aplicado. Tras las esperas largas de F2 siempre se vuelve a leer.
2. **Fechas "solo fecha".** Los filtros usan `le 'yyyy-MM-ddT23:59:59Z'` y las comparaciones en expresiones usan `int(replace(take(fecha,10),'-',''))`. "Hoy" se calcula en `SA Pacific Standard Time`. Se supone un sitio en UTC−5 (Lima).
3. **Números de SharePoint** (`4` o `4.0`): `int(first(split(string(x), '.')))`. `empty()` nunca se aplica a un número (se usa `empty(string(coalesce(x,'')))`).
4. **Avisos.** En F1 y F4, si un envío falla, la ejecución termina en *Failed* para que sea visible: hay ramas `runAfter: Failed/TimedOut` que registran `Error`. En F2 el registro se hace con `runAfter: Succeeded/Failed/TimedOut` y `EstadoEnvio` calculado, para que un fallo de correo o de Teams no detenga la aprobación.
5. **Sondeo de los disparadores SharePoint cada 5 minutos.** El servicio aplica de todos modos el mínimo de la licencia.

## Huecos del diseño detectados (decisiones conservadoras, a validar con negocio)

| # | Hueco | Decisión tomada |
|---|---|---|
| 1 | El diagrama de §2.4 no tiene estado *Rechazada*, pero `VU_Aprobaciones.Decision` sí | Rechazar → `Decision = Rechazada` y `Estado = Observada` (vuelve al responsable) |
| 2 | §2.4 no tiene la transición *Aprobada piloto → Observada* | Si la aprobadora productiva observa o rechaza → `Observada`. Al reenviar se repiten **los dos** niveles |
| 3 | Sin `AprobadorProductivo` no hay forma de lanzar después la aprobación productiva (pregunta abierta n.º 4) | Se queda en `Aprobada piloto` y `EstadoVU = En revisión`. No existe ningún disparador que la relance: hace falta definirlo |
| 4 | No se define qué ocurre si nadie responde a la aprobación | Timeout de 14 días por nivel (límite de 30 días por ejecución). En el piloto pasa a `Observada` (se puede reenviar). En el productivo se queda en `Aprobada piloto`. En ambos casos `Decision` queda en `Pendiente` con un comentario de expiración (no hay valor *Expirada*) |
| 5 | **Concurrencia 1 en F2** con esperas de días: las demás revisiones quedan en cola (como máximo 11 en espera; después el disparador deja de sondear) | Se mantiene 1, como pide el diseño. **Se recomienda subirla** (por ejemplo a 25): las salvaguardas de F2 (*Get changes* y volver a leer `Estado`) hacen seguras las ejecuciones en paralelo |
| 6 | §3.3 combina *When an item is created or modified* con *Get changes* (`since` = token de ventana), pero esos tokens solo los devuelve *When an item or a file is modified* | F2 usa `GetOnChangedItems`. *En revisión* siempre se alcanza editando |
| 7 | `TipoNotificacion` no tiene valor para "envío rechazado por RN-07" | Se registra como *Envío a revisión* |
| 8 | `VU_Notificaciones.Verificacion` es obligatoria, pero el recordatorio de F4 es de la solución | Decisión de coordinación: la fila se crea con `Verificacion` **vacía**. `VU_Notificaciones.Verificacion` pasará a ser opcional en el esquema durante la integración; `validar_definiciones.py` registra esta excepción en `EXCEPCIONES_REQ` |
| 9 | `NotificarAlFinalizar` no tiene un efecto definido en el servidor | F2 lo ignora: las solicitudes de aprobación siempre se notifican. Propuesta: que la app exija Sí para enviar, o eliminar la columna |
| 10 | Quién escribe `VU_Verificaciones.FechaEnvio` | La escribe F2 al superar RN-07 |
| 11 | §2.5: el orden entre "ProximaVU < hoy → Pendiente" y una verificación en curso | La vigencia solo se evalúa cuando la última verificación está *Aprobada* (o no hay ninguna). Si hay una en curso, prevalece su estado |
| 12 | RN-07 exige `completas = previstas` (igualdad estricta) | Se respeta la igualdad. Si hay más entrevistas completas que previstas, la verificación se devuelve |
| 13 | F2 y F3 se disparan a la vez cuando se envía a revisión | F3 vuelve a leer el estado. Queda una ventana de segundos en la que F3 podría pisar a F2, y se corrige en el siguiente cambio |
