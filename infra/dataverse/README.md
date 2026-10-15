# Dataverse · Verificación de uso

Scripts Node (sin dependencias npm, Node 18+ por el `fetch` nativo) que crean y comprueban el esquema de la app *Verificación de uso* en Dataverse. La fuente de verdad es [`docs/diseno-verificacion-uso.md`](../../docs/diseno-verificacion-uso.md) §2 (modelo) y §3.6 (roles). [`schema.json`](schema.json) es su traducción declarativa y la única entrada de los scripts.

| Archivo | Qué hace |
|---|---|
| `schema.json` | Publicador, solución, 3 opciones globales, 13 tablas, 96 columnas (29 búsquedas con su relación 1:N y cascada), autonumeración, columna de archivo, clave alternativa y 4 roles. |
| `provision.mjs` | Crea todo lo anterior de forma **idempotente** (comprueba antes de crear) y publica. |
| `seed.mjs` + `seed/*.json` | Semilla idempotente de la configuración: áreas, criterios, pregunta y opciones. |
| `importar-apps.mjs` + `tools/apps_xlsx_a_json.py` | Importa el catálogo real de soluciones desde la exportación a Excel de la lista SharePoint "Apps" (el JSON no se versiona). |
| `copiar-catalogo.mjs` | Copia áreas, soluciones, criterios, preguntas activas y sus opciones de desarrollo a otro entorno (QA, Producción) por `vu_name`; idempotente. El responsable se busca por correo en el destino. |
| `verify.mjs` | Compara los metadatos del entorno con `schema.json`; sale con código ≠ 0 si hay diferencias. |
| `lib.mjs` | Token de `az`, cliente Web API v9.2 con reintentos (429/503 respetando `Retry-After`, bloqueo de personalización), etiquetas. |

## Requisitos

- `az login` con un usuario que tenga **Administrador del sistema** (o Personalizador) en el entorno. El token se pide con `az account get-access-token --resource <org>` y se renueva cada 45 min.
- Entorno de desarrollo: `https://org4d363b5e.crm2.dynamics.com` (por defecto; se cambia con `--org` o la variable `DATAVERSE_URL`).

## Qué crea

- **Publicador** `VerificacionUso` (prefijo `vu`, prefijo de opciones `10000`) y **solución** no administrada `VerificacionUso` 1.0.0.0. Todo se crea con el encabezado `MSCRM.SolutionUniqueName: VerificacionUso`; además, `provision.mjs` comprueba los componentes y llama a `AddSolutionComponent` si falta alguno (roles: tipo 20).
- **Opciones globales**: `vu_modalidad`, `vu_estadoverificacion`, `vu_estadovu`.
- **Tablas** (catálogos *OrganizationOwned*; transaccionales *UserOwned*; auditoría en `vu_verificacion`, `vu_puntajecriterio`, `vu_aprobacion`):

| Tabla | EntitySetName (Web API) |
|---|---|
| `vu_area` | `vu_areas` |
| `vu_solucion` | `vu_solucions` |
| `vu_documentosolucion` | `vu_documentosolucions` |
| `vu_criterio` | `vu_criterios` |
| `vu_pregunta` | `vu_preguntas` |
| `vu_opcionrespuesta` | `vu_opcionrespuestas` |
| `vu_verificacion` | `vu_verificacions` |
| `vu_entrevista` | `vu_entrevistas` |
| `vu_respuesta` | `vu_respuestas` |
| `vu_evidencia` | `vu_evidencias` |
| `vu_puntajecriterio` | `vu_puntajecriterios` |
| `vu_aprobacion` | `vu_aprobacions` |
| `vu_notificacion` | `vu_notificacions` |

- **Búsquedas**: la propiedad de navegación es el *SchemaName* de la búsqueda en PascalCase (`vu_SolucionId`, `vu_VerificacionId`, `vu_ProcesoId`, …). Cada columna `Lookup` de `schema.json` trae `navigationProperty`, `odataBind` (p. ej. `"vu_SolucionId@odata.bind": "/vu_solucions(<guid>)"`) y `readProperty` (`_vu_solucionid_value`). Relación 1:N: `vu_<padre>_<hija>_<campo>` sin el prefijo `vu_` en las partes (p. ej. `vu_solucion_verificacion_solucionid`). Cascadas: *Parental* = asignar, eliminar, reparentar, compartir y dejar de compartir en cascada (Merge queda en NoCascade: Dataverse solo admite fusión en cascada en cuenta, contacto, cliente potencial e incidente); *Restrict* = eliminar restringido; *RemoveLink* = eliminar quita el vínculo. Las búsquedas a `systemuser` usan *RemoveLink*.
- **Autonumeración** `VU-{SEQNUM:5}` en `vu_verificacion.vu_name`, con la semilla en 1 (`SetAutoNumberSeed`) mientras la tabla esté vacía, así que el primer código es `VU-00001`.
- **Archivo** `vu_evidencia.vu_archivo` (`FileAttributeMetadata`, 32 768 KB).
- **Clave alternativa** `vu_ak_verificacion_criterio` (`vu_verificacionid`, `vu_criterioid`) en `vu_puntajecriterio`. Su índice se construye en segundo plano (`EntityKeyIndexStatus` pasa de `Pending` a `Active`).
- **Roles** en la unidad de negocio raíz (§3.6): `VU Lector`, `VU Responsable`, `VU Aprobador`, `VU Administrador`, con privilegios `prvCreate/Read/Write/Delete/Append/AppendTo<tabla>` en profundidad Basic/Local/Global (`AddPrivilegesRole`; solo agrega o corrige lo que falta, según `RetrieveRolePrivilegesRole`).

## Ejecutar

```bash
node infra/dataverse/provision.mjs --dry-run                       # muestra qué crearía; no escribe
node infra/dataverse/provision.mjs --org https://org4d363b5e.crm2.dynamics.com
node infra/dataverse/provision.mjs                                 # 2.ª vez: "creados 0"
```

La primera ejecución tarda unos 15–20 minutos (cada tabla y cada relación es una operación de metadatos). Si se corta, basta con volver a ejecutarla. `--verbose` lista también lo que ya existía.

### Semilla

```bash
node infra/dataverse/seed.mjs            # 7 áreas, 4 criterios, 1 pregunta + 5 opciones
```

- Busca cada fila por `vu_name` + padre y solo crea lo que falta; no sobrescribe filas existentes.
- No crea soluciones ni verificaciones: el catálogo de soluciones (y sus VU históricas aprobadas) lo carga `importar-apps.mjs`.

### Catálogo de soluciones

```bash
python -I infra/dataverse/tools/apps_xlsx_a_json.py <Libro.xlsx> apps.json
node infra/dataverse/importar-apps.mjs --file apps.json [--dry-run]
```

Idempotente: busca cada solución por `vu_name` y la actualiza si ya existe.

### Copiar el catálogo a QA y Producción

```bash
node infra/dataverse/copiar-catalogo.mjs --destino https://orgd0a1ee14.crm2.dynamics.com --dry-run   # QA
node infra/dataverse/copiar-catalogo.mjs --destino https://org78cc7e9b.crm2.dynamics.com             # Producción
```

El destino necesita la solución `VerificacionUso` importada (compruébalo con `verify.mjs --org <destino>`). No copia verificaciones, así que `vu_ultimaverificacionid` queda vacía.

### Verificación

```bash
node infra/dataverse/verify.mjs          # código 0 = sin diferencias; --verbose muestra cada comprobación
```

Comprueba publicador, solución, opciones (valores y etiquetas), tablas (propiedad, auditoría, EntitySetName, nombres visibles), columnas (tipo, requerido, longitudes, mínimos/máximos, precisión, formato, valores predeterminados, autonumeración, tamaño del archivo), relaciones y cascadas, navegación, clave alternativa (y su índice activo), privilegios de cada rol y pertenencia a la solución.

## Exportar la solución

Con Power Platform CLI:

```bash
pac auth create --environment https://org4d363b5e.crm2.dynamics.com
pac solution export --name VerificacionUso --path ./VerificacionUso_managed.zip --managed
pac solution export --name VerificacionUso --path ./VerificacionUso.zip            # no administrada (control de código)
pac solution unpack --zipfile ./VerificacionUso.zip --folder ./solution/VerificacionUso
```

Con la Web API: `POST /api/data/v9.2/ExportSolution` con `{"SolutionName":"VerificacionUso","Managed":true}`. La respuesta trae `ExportSolutionFile` en base64 (decodificarlo a `.zip`). Test y Prod reciben la solución **administrada**; estos scripts solo se ejecutan en desarrollo.

## Limitaciones y decisiones

- **Valores predeterminados de enteros**: Dataverse no admite valor predeterminado en columnas *Integer*. `vu_solucion.vu_periodicidadmeses` (6) y `vu_verificacion.vu_entrevistascompletas` (0) los pone la app o la semilla; en `schema.json` aparecen como `defaultValue` informativo, y `provision.mjs`/`verify.mjs` no los aplican.
- **Obligatorio = ApplicationRequired**: lo hacen cumplir los formularios y la app, no la Web API. En particular, `vu_evidencia.vu_archivo` se sube **después** de crear la fila (API de columnas de archivo), y `vu_verificacion.vu_name` lo genera la autonumeración.
- **Semilla de autonumeración**: es un dato del entorno, no viaja en la solución. En cada entorno nuevo hay que ejecutar `SetAutoNumberSeed` (o `provision.mjs`, que lo hace si la tabla está vacía) si se quiere empezar en `VU-00001`; si no, Dataverse empieza en 1000 (`VU-01000`).
- **Auditoría**: queda activada en las tres tablas, pero solo registra si la auditoría de la organización está encendida (Configuración > Auditoría). Hoy está apagada en el entorno de desarrollo y estos scripts no tocan la configuración global.
- **Roles**: solo incluyen los privilegios de las tablas `vu_*`. Para usar la Code App, cada usuario también necesita un rol con los privilegios básicos del sistema (p. ej. *Basic User*). `VU Responsable` lleva además `AppendTo` (organización) en los catálogos: sin él no puede enlazar una verificación a su solución, ni una respuesta a su criterio, pregunta u opción.
- **Longitudes no fijadas en §2.3**: las URL (`vu_enlace`, `vu_urlgrabacion`) usan 1000 caracteres; `vu_usuariosobjetivo` va de 0 a 2 147 483 647; `vu_puntajecriterio.vu_peso` va de 0 a 100 con 2 decimales.
- **Atributo primario**: al crear la tabla, Dataverse dejó `vu_name` en 850 caracteres y sin requerir (salvo en `vu_verificacion`, que tiene autonumeración). `provision.mjs` lo corrige con un `PUT` del atributo (longitud de §2.3 y *ApplicationRequired*) y lo vuelve a comprobar en cada ejecución.
- Los **roles** no entran en la solución con el encabezado `MSCRM.SolutionUniqueName`, así que se agregan con `AddSolutionComponent` (tipo 20).
- `provision.mjs` no modifica componentes que ya existan con otra definición, porque solo crea lo que falta. Las diferencias las detecta `verify.mjs`, y se corrigen a mano o borrando el componente (solo los `vu_*`).
