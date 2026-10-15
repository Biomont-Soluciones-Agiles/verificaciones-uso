# Power Automate · Verificación de uso

Definiciones de los cuatro flujos de la app *Verificación de uso*, con el conector **Microsoft Dataverse** (`shared_commondataserviceforapps`) sobre las tablas `vu_*` del entorno `42eff49b-d50d-e366-9c13-fa86677af7e3` (`https://org4d363b5e.crm2.dynamics.com`). La fuente de verdad es [`docs/diseno-verificacion-uso.md`](../../docs/diseno-verificacion-uso.md): §1.3 (reglas), §2.3 (nombres lógicos y valores de opción), §2.4 y §2.5 (estados), §3.3 (flujos), §3.6 (seguridad) y §3.7 (ALM). Los EntitySetName y los nombres de navegación de las búsquedas se contrastan con [`infra/dataverse/schema.json`](../dataverse/schema.json).

> **Nota histórica.** Hasta la migración a Dataverse, estos flujos usaban listas de SharePoint. Esa versión se ha retirado por completo: no quedan variables de sitio o lista, ni condiciones antibucle, ni *Get changes*.

| Flujo | Carpeta | Disparador | Qué hace | Conexiones |
|---|---|---|---|---|
| **F1** Alerta anticipada | [`F1-AlertaAnticipada`](F1-AlertaAnticipada/README.md) | Recurrencia diaria a las 07:00 (Lima) | *List rows* `vu_verificacions` con `vu_estado eq 100000001 and vu_fechaalerta le <hoy> and vu_alertaenviada eq false` → correo al **responsable**, `vu_alertaenviada = true` y `vu_notificacion` | `vu_dataverse`, `vu_office365` |
| **F2** Envío a revisión | [`F2-EnvioRevision`](F2-EnvioRevision/README.md) | Dataverse *Modified* en `vu_verificacion`, columnas de filtro `vu_estado`, filtro de filas `vu_estado eq 100000004`, concurrencia 25 | Revalida RN-07 → aprobación de la aprobadora de la verificación (Approvals: Aprobar/Observar/Rechazar, 14 días) → `vu_aprobacion`, `vu_estado`, `vu_fechaaprobacion`, `vu_proximavu` y avisos | `vu_dataverse`, `vu_approvals`, `vu_office365`, `vu_teams` |
| **F3** Estado de la solución | [`F3-EstadoSolucion`](F3-EstadoSolucion/README.md) | Dataverse *Added or Modified* en `vu_verificacion`, columnas de filtro `vu_estado`, concurrencia 1 | Recalcula `vu_estadovu` y `vu_ultimaverificacionid` de la solución (§2.5). También se dispara con los cambios de F2 | `vu_dataverse` |
| **F4** Vencimiento | [`F4-Vencimiento`](F4-Vencimiento/README.md) | Recurrencia semanal, lunes a las 07:00 (Lima) | `vu_proximavu ≤ hoy + 30` y sin verificación activa → recordatorio al responsable + `vu_notificacion` con `vu_solucionid`; si ya venció, `vu_estadovu = Pendiente` | `vu_dataverse`, `vu_office365` |

> **RN-06 por diseño.** Ningún flujo escucha `vu_entrevista`, `vu_respuesta`, `vu_puntajecriterio` ni `vu_evidencia`, y F2/F3 filtran por la columna `vu_estado`, así que el autoguardado y "Guardar avance" nunca generan avisos. F2 solo **lee** `vu_entrevista` para revalidar RN-07. La primera notificación a la aprobadora es la solicitud de Approvals de F2. F1 solo escribe al responsable. Todo envío queda en `vu_notificacion` con `vu_estadoenvio` Enviada (`100000000`) o Error (`100000001`).

## Formato de los archivos

Cada `definition.json` sigue el formato de un flujo de solución (el `clientdata` de `Workflows/<flujo>.json`):

```json
{ "properties": { "connectionReferences": { … }, "definition": { "$schema": ".../workflowdefinition.json#", … }, "templateName": "" }, "schemaVersion": "1.0.0.0" }
```

- Disparadores Dataverse: `OpenApiConnectionWebhook` con `operationId = SubscribeWebhookTrigger` y los parámetros `subscriptionRequest/message` (3 = Modified, 4 = Added or Modified), `subscriptionRequest/entityname` (nombre lógico **singular**: `vu_verificacion`), `subscriptionRequest/scope` (4 = Organization), `subscriptionRequest/filteringattributes`, `subscriptionRequest/filterexpression` y `subscriptionRequest/runas` (3 = propietario del flujo).
- Acciones Dataverse: `ListRecords` (*List rows*), `GetItem` (*Get a row by ID*), `CreateRecord` (*Add a new row*) y `UpdateOnlyRecord` (*Update a row*). Se usa `UpdateOnlyRecord` en vez de `UpdateRecord` porque este último es *Upsert* y crearía una fila si el GUID no existiera. `entityName` es el **EntitySetName** plural (`vu_verificacions`, `vu_solucions`, `vu_aprobacions`, `vu_notificacions`, `vu_entrevistas`, `systemusers`).
- Columnas: se escriben como `item/<nombre lógico>`. Las opciones se escriben con su **valor numérico** y los Sí/No con `true`/`false`. Las búsquedas se leen como `_<col>_value` y se escriben como `item/<SchemaName>@odata.bind` = `/<EntitySetName>(<guid>)`, por ejemplo `item/vu_VerificacionId@odata.bind: /vu_verificacions(<guid>)`.
- Con *Update a row* solo se envían las columnas que cambian; no hace falta reenviar las obligatorias.
- Las acciones **no** llevan `inputs.authentication`, porque Power Automate lo añade al guardar.
- Los correos de los usuarios se leen con *Get a row by ID* de `systemusers` (`internalemailaddress` y, si está vacío, `domainname`).

## Referencias de conexión

| Nombre lógico | Conector (`api.name`) | Clave en `connectionReferences` / `host.connectionName` | Flujos |
|---|---|---|---|
| `vu_dataverse` | Microsoft Dataverse | `shared_commondataserviceforapps` | F1–F4 |
| `vu_approvals` | Approvals | `shared_approvals` | F2 |
| `vu_office365` | Office 365 Outlook | `shared_office365` | F1, F2, F4 |
| `vu_teams` | Microsoft Teams | `shared_teams` | F2 |

Todas deben apuntar a conexiones de la **cuenta de servicio** (§3.6): un rol *VU Administrador* (o administrador del sistema) en Dataverse, buzón para enviar correo y licencia de Teams. Approvals muestra siempre como remitente al dueño de la conexión.

## Variables de entorno

Ninguna (las variables de sitio y de listas, `vu_SiteUrl` y `vu_Lista*`, se eliminaron). El conector Dataverse usa el entorno actual y las tablas se identifican por su nombre, igual en Dev, Test y Prod. `vu_CuentaServicioEmail` (§3.7) **no se usa** en estos flujos: la condición antibucle ya no hace falta, porque los disparadores filtran por la columna `vu_estado` y ningún flujo se dispara con sus propias escrituras. Puede seguir en la solución para otros usos.

## Cómo importar en la solución `VerificacionUso`

1. En la solución, crea (o reutiliza) las 4 referencias de conexión con los nombres lógicos de la tabla, enlazadas a las conexiones de la cuenta de servicio.
2. Crea cada flujo **dentro de la solución** (*Nuevo → Automatización → Flujo de nube*) con el nombre sugerido en su README y sustituye su definición. Hay dos formas:
   - Exportar la solución no administrada (`pac solution export`), poner el contenido de cada `definition.json` en `Workflows/<flujo>-<guid>.json`, empaquetar y volver a importar (`pac solution import`).
   - Con el plugin de Power Automate: `preflight_flow` y luego `update_flow` sobre el flujo ya creado en la solución, pasando `properties.definition` y las `connectionReferences`.
3. Abre cada flujo en el diseñador, comprueba que las tablas y columnas se resuelven y **guarda**. Al guardar se valida el esquema dinámico de Dataverse y se registra el webhook del disparador. Después **actívalo**.
4. Promoción: exporta la solución como **administrada** e impórtala en Test o Prod, enlazando las referencias de conexión. No hay variables que rellenar.

> Estas definiciones **no** se han creado en ningún entorno: este frente solo entrega los archivos.

## Cómo probar

Requisitos: tablas aprovisionadas con `infra/dataverse/` y datos semilla, la Code App (o el formulario de la tabla) para cambiar estados, y dos usuarios de prueba (responsable y aprobadora).

| Flujo | Caso | Resultado esperado |
|---|---|---|
| F1 | Verificación `Programada` con `vu_fechaalerta` = hoy y `vu_alertaenviada` = No. Ejecuta el flujo a mano | Correo **solo** al responsable, `vu_alertaenviada = Sí`, fila *Alerta anticipada · Correo · Enviada*. Una segunda ejecución no hace nada |
| F1 | Responsable sin buzón | Fila *Error*, `vu_alertaenviada` sigue en No y se reintenta al día siguiente |
| F3 | Crea una verificación en `Borrador` y pásala a `Programada` | `vu_estadovu`: `Pendiente` y luego `Programada`; `vu_ultimaverificacionid` = la verificación |
| F3 | Cambia `vu_objetivo` sin tocar `vu_estado` | No hay ejecución (columna de filtro) |
| F2 | `En revisión` con menos entrevistas `Completa` que `vu_entrevistasprevistas` | Vuelve a `En evaluación`, correo con el motivo, fila *Envío a revisión*. F3 deja `En proceso`. No se crea ninguna aprobación |
| F2 | RN-07 correcta y la aprobadora responde **Observar** | `vu_aprobacion` *Observada* con el comentario, `vu_estado = Observada`, correo y tarjeta de Teams al responsable, 3 filas en `vu_notificacion` |
| F2 | La aprobadora responde **Aprobar** | `En revisión` → `Aprobada`, `vu_fechaaprobacion`, `vu_proximavu = hoy + vu_periodicidadmeses`, F3 deja `Vigente` |
| F2 | Volver a guardar la fila con `vu_estado = En revisión` mientras espera la aprobación | La nueva ejecución termina en *Terminar_sin_cambios* (guarda de idempotencia) |
| F2 | Editar otro campo de una verificación *En revisión* | No hay ejecución |
| F4 | Solución con `vu_proximavu` = hoy + 10 y sin verificación activa | Recordatorio "por vencer (en 10 días)" y fila *Recordatorio de vencimiento* con `vu_solucionid` |
| F4 | `vu_proximavu` = ayer, sin verificación activa | Recordatorio "vencida" y `vu_estadovu = Pendiente` |
| F4 | Solución con una verificación `Programada` | No hace nada |

Para probar los plazos de 14 días sin esperar, cambia temporalmente `limit.timeout` a `PT5M` en desarrollo.

### Verificación estática (sin entorno)

```bash
python -I infra/power-automate/validar_definiciones.py
```

`validar_definiciones.py` lee §2.3 del documento (tablas, columnas, obligatoriedad, búsquedas y valores de opción) y, si existe, `infra/dataverse/schema.json` (EntitySetName, SchemaName de navegación, requiredLevel y valores). Comprueba:

- JSON válido y forma de flujo de solución. Estructura: `runAfter`, referencias a acciones, `items()` dentro de su bucle, variables, paréntesis balanceados, sin `authentication`, `Terminate` fuera de bucles, referencias de conexión con los nombres lógicos acordados y usadas.
- `entityName` = EntitySetName de una tabla de §2.3 (o `systemusers`), y disparador con el nombre lógico singular.
- Que existen las columnas de `$select`, `$filter`, `$orderby`, `filteringattributes`, `filterexpression`, `item/…`, `body()`, `items()` y `triggerOutputs()`; búsquedas leídas como `_x_value` y escritas con `@odata.bind` hacia la tabla destino correcta y con el SchemaName exacto.
- Los valores de opción de los filtros, de `item/…`, de las condiciones `equals(<columna>, N)` y de `varEstadoFinal`.
- Que cada `CreateRecord` envía las columnas obligatorias sin valor predeterminado.
- Que las fechas *solo fecha* no se comparan con cadenas entre comillas ni con horas.
- Los disparadores de §3.3 (mensaje, tabla, columnas de filtro, filtro de filas, concurrencia 25 en F2, zona de Lima en las recurrencias).
- Que no queda ninguna referencia al almacenamiento anterior.

Acepta una carpeta como argumento (`python -I validar_definiciones.py <copia>`) para comprobar una copia alterada sin tocar el repo.

## Decisiones transversales

1. **Fechas solo fecha** (`vu_fechaalerta`, `vu_proximavu`): "hoy" es `convertFromUtc(utcNow(), 'SA Pacific Standard Time', 'yyyy-MM-dd')`. Los filtros OData comparan con `yyyy-MM-dd` sin comillas y las expresiones comparan enteros `yyyyMMdd`.
2. **Avisos**: F1 y F4 registran `Enviada` con `runAfter: Succeeded` y `Error` con `runAfter: Failed/TimedOut`. F2 registra con `runAfter: Succeeded/Failed/TimedOut` y `vu_estadoenvio` calculado, para que un fallo de correo o de Teams no detenga la aprobación.
3. **Sin antibucle ni *Get changes***: el filtro de columna `vu_estado` lo resuelve. F1 y F4 escriben columnas que no disparan nada. F2 escribe `vu_estado` con valores distintos de 100000004, así que no se vuelve a disparar, pero sí dispara F3, como pide §3.3. F3 solo escribe en `vu_solucion`.
4. **Concurrencia**: 25 en F2 (esperas de días; ver su README), 1 en F3 (recálculos cortos y serializados) y 5 en los bucles de F1 y F4.

## Huecos del diseño detectados (decisiones conservadoras, a validar con negocio)

| # | Hueco | Decisión tomada |
|---|---|---|
| 1 | §2.4 no tiene estado *Rechazada*, pero `vu_aprobacion.vu_decision` sí | Rechazar → `vu_decision = Rechazada` y `vu_estado = Observada` (pregunta abierta n.º 7) |
| 2 | ~~Sin aprobadora productiva no se lanzaba el nivel productivo~~ | Resuelto: RN-08 tiene un solo nivel (aprobadora de la verificación) |
| 3 | Qué pasa si nadie responde | 14 días. Pasa a `Observada` (se puede reenviar). `vu_decision` queda `Pendiente` con un comentario de expiración (no existe el valor *Expirada*) |
| 4 | El disparador de Dataverse se activa aunque `vu_estado` no cambie de valor si viene en la actualización | Guarda de idempotencia en F2 (aprobación *Pendiente* de menos de 14 días). Se recomienda que la app solo envíe `vu_estado` cuando cambia |
| 5 | `vu_tiponotificacion` no tiene valor para "devuelta por RN-07" | Se registra como *Envío a revisión* |
| 6 | `vu_notificaralfinalizar` no tiene efecto definido en el servidor (pregunta n.º 6) | F2 lo ignora: las solicitudes de aprobación siempre se notifican |
| 7 | §2.5 define la "última verificación" sin decir cuál es ni qué pasa con un borrador o una cancelación posteriores a una aprobada vigente | Última = la creada más recientemente (`createdon desc`), aplicando la tabla al pie de la letra: un borrador o una cancelación nuevos dejan la solución en *Pendiente* aunque la anterior estuviera vigente. Confirmar si deben ignorarse |
| 8 | §2.5: orden entre "`vu_proximavu` < hoy → Pendiente" y una verificación en curso | La vigencia solo se evalúa cuando la última está *Aprobada*. Si hay una en curso, prevalece su estado. El paso de *Vigente* a *Pendiente* por fecha lo hace F4 (los lunes) |
| 9 | No hay URL de la app ni del registro para los enlaces de correos y aprobaciones | Los avisos citan el código `VU-xxxxx` sin enlace. Si se quiere un enlace, añadir una variable de entorno (p. ej. `vu_UrlApp`) a §3.7 |
| 10 | RN-07 exige `completas = previstas` (igualdad estricta) | Se respeta. F2 cuenta las `vu_entrevista` *Completa* en el servidor (no usa `vu_entrevistascompletas`) |
| 11 | `vu_solucion.vu_periodicidadmeses` es obligatoria, pero puede faltar en datos antiguos | Si viene vacía se usan 6 meses (su valor predeterminado) |
| 12 | `runas` del disparador no está en el diseño | `3` (propietario del flujo = cuenta de servicio). Solo afecta a conexiones de invocador, y aquí todas son de la cuenta de servicio |
