# Aprovisionamiento de SharePoint: Verificación de uso

Scripts **PnP PowerShell** idempotentes que crean la base de datos de la app *Verificación de uso* en SharePoint Online: 12 listas, la biblioteca `VU_Evidencias`, columnas con nombres internos ASCII, índices, relaciones, grupos, permisos y datos semilla.

La fuente de verdad es [`docs/diseno-verificacion-uso.md`](../../docs/diseno-verificacion-uso.md) (§2 y §3.6). Este repositorio la traduce a [`schema/listas.json`](schema/listas.json); los scripts solo leen ese JSON.

## Contenido

| Archivo | Para qué sirve |
|---|---|
| `schema/listas.json` | Definición declarativa: listas (en orden de dependencia), columnas, índices, relaciones, versionado, grupos y perfiles de permisos |
| `Provision-VerificacionUso.ps1` | Crea o ajusta el sitio (opcional), las listas, las columnas, las vistas, los grupos y los permisos |
| `Seed-VerificacionUso.ps1` | Carga los datos semilla sin duplicar (clave: `Title`) |
| `seed/areas.json` | Procesos y áreas del prototipo (Operaciones, Producción, Comercial, Comercio exterior, Despacho, Logística, Almacén) |
| `seed/criterios.json` | Frecuencia 30, Cobertura 25, Sustitución 30, Satisfacción 15 |
| `seed/preguntas.json` | «¿Con qué frecuencia utiliza la solución?» con sus 5 opciones y puntajes |
| `seed/soluciones.json` | Las 4 soluciones del prototipo con sus 4 documentos (manual, instructivo, video, carpeta) |
| `tools/verificar_esquema.py` | Compara `schema/listas.json` con las tablas de §2.3 del diseño (sin conexión a SharePoint) |

## Qué crea

| Lista (URL) | Tipo | Versionado | Permisos (§3.6) |
|---|---|---|---|
| `VU_Areas` | Lista | – | Hereda del sitio (catálogo) |
| `VU_Soluciones` | Lista | – | Hereda del sitio (catálogo) |
| `VU_DocumentosSolucion` | Lista | – | Hereda del sitio (catálogo) |
| `VU_Criterios` | Lista | – | Hereda del sitio (catálogo) |
| `VU_Preguntas` | Lista | – | Hereda del sitio (catálogo) |
| `VU_OpcionesRespuesta` | Lista | – | Hereda del sitio (catálogo) |
| `VU_Verificaciones` | Lista | **Sí** | Únicos (transaccional) |
| `VU_Entrevistas` | Lista | – | Únicos (transaccional) |
| `VU_Respuestas` | Lista | – | Únicos (transaccional) |
| `VU_PuntajesCriterio` | Lista | **Sí** | Únicos (transaccional) |
| `VU_Aprobaciones` | Lista | **Sí** | Únicos (aprobaciones/notificaciones) |
| `VU_Notificaciones` | Lista | – | Únicos (aprobaciones/notificaciones) |
| `VU_Evidencias` | Biblioteca | (predeterminado) | Únicos (transaccional) |

Además:

- **Columnas**: se crean por XML con `DisplayName = nombre interno` (ASCII, sin tildes) y después se les pone el nombre visible en español. Así el nombre interno que usan los servicios TS generados y Power Automate es siempre el del diseño (`FechaAlerta`, `DiasAnticipacion`, …).
- **Índices**: todas las columnas 🔎 del diseño y todas las búsquedas con relación exigida.
- **Relaciones**: eliminación en cascada en las listas hijas y restringir eliminación hacia los catálogos (ver la tabla de decisiones al final).
- **Validación**: `VU_Verificaciones.DiasAnticipacion` solo admite 7, 15 o 30 (`=OR([Días de anticipación]=7,…)`).
- **Navegación**: ninguna lista aparece en la navegación del sitio (`OnQuickLaunch = $false`).
- **Vista predeterminada** de cada lista con todas sus columnas.
- **Grupos de SharePoint**: `VU Lectores` (Leer en el sitio), `VU Responsables` (Leer), `VU Aprobadores` (Leer), `VU Administradores` (Control total).
- **Permisos por lista** (transaccionales, aprobaciones y notificaciones): se rompe la herencia copiando las asignaciones y luego se deja exactamente la matriz de §3.6:

| Grupo | Catálogos | Transaccionales | Aprobaciones / Notificaciones |
|---|---|---|---|
| VU Lectores | Leer | – | – |
| VU Responsables | Leer | Colaborar | Leer |
| VU Aprobadores | Leer | Leer | Leer |
| VU Administradores | Control total | Control total | Control total |
| Cuenta de servicio (`-CuentaServicio`) | Editar | Editar | Editar |
| Propietarios del sitio (grupo predeterminado) | Control total | Control total | Control total |
| Miembros y Visitantes del sitio (grupos predeterminados) | hereda | – | – |

Los niveles de permiso se buscan por tipo (`Reader`, `Contributor`, `Editor`, `Administrator`), así que funcionan aunque el sitio esté en español («Lectura», «Colaborar», «Edición», «Control total»).

## Prerrequisitos

1. **PowerShell 7.4 o superior** (los scripts exigen 7.2 como mínimo; PnP.PowerShell 3.x requiere 7.4.6+). En Windows: `winget install Microsoft.PowerShell`. Ejecuta los scripts con `pwsh`, no con Windows PowerShell 5.1.
2. **Módulo PnP.PowerShell**:
   ```powershell
   Install-Module PnP.PowerShell -Scope CurrentUser
   ```
3. **Aplicación de Entra ID para el inicio de sesión interactivo** (una vez por tenant; la registra alguien con permiso para registrar aplicaciones y dar consentimiento):
   ```powershell
   Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP VerificacionUso" -Tenant biomont.onmicrosoft.com
   ```
   Guarda el **ClientId** que devuelve. Con los permisos predeterminados (`AllSites.FullControl` delegado, entre otros) basta. Si se quiere limitar: `-SharePointDelegatePermissions AllSites.FullControl`.
4. **Permisos de la cuenta que ejecuta**:
   - Para `-CreateSite`: administrador de SharePoint (o creación de sitios por autoservicio habilitada). El script se conecta a la raíz del tenant (`https://biomont.sharepoint.com`), comprueba con `/_api/SPSiteManager/status` si el sitio existe y, si no, lo crea con `New-PnPSite -Type CommunicationSite -Lcid 3082`.
   - Para el resto: propietario (Control total) del sitio.
5. **Correos reales** para `-Owner`, `-CuentaServicio` y `-ResponsablePorDefecto`. Los JSON no contienen correos ni enlaces reales.

## Orden de ejecución

```powershell
cd infra/sharepoint
$appId = '<ClientId de la app de Entra>'

# 0) Comprobar el esquema contra el diseño (opcional, sin conexión)
python tools/verificar_esquema.py

# 1) Sitio (solo la primera vez; requiere administrador de SharePoint)
./Provision-VerificacionUso.ps1 -ClientId $appId -CreateSite -Owner <propietario@dominio> -CuentaServicio <cuenta.flujos@dominio>

#    o, si el sitio ya existe:
./Provision-VerificacionUso.ps1 -ClientId $appId -CuentaServicio <cuenta.flujos@dominio>

# 2) Datos semilla
./Seed-VerificacionUso.ps1 -ClientId $appId -ResponsablePorDefecto <responsable@dominio>
```

Otros ejemplos:

```powershell
# Otro entorno (Dev/Test) sin tocar grupos ni permisos
./Provision-VerificacionUso.ps1 -SiteUrl https://biomont.sharepoint.com/sites/VerificacionUso-Dev -ClientId $appId -OmitirPermisos

# Aplicar los títulos visibles en español de las listas («Verificaciones de uso», …)
./Provision-VerificacionUso.ps1 -ClientId $appId -TitulosEnEspanol

# Ver el XML de cada columna que se crea
./Provision-VerificacionUso.ps1 -ClientId $appId -Verbose
```

Ambos scripts se pueden ejecutar tantas veces como se quiera: lo que ya existe se deja igual o se corrige, y nada se elimina. La salida marca `[+]` lo creado, `[~]` lo ajustado y `[=]` lo que ya estaba bien.

### Parámetros de `Provision-VerificacionUso.ps1`

| Parámetro | Predeterminado | Descripción |
|---|---|---|
| `-SiteUrl` | `https://biomont.sharepoint.com/sites/VerificacionUso` | Sitio destino |
| `-ClientId` | (obligatorio) | App de Entra para `Connect-PnPOnline -Interactive` |
| `-CreateSite` | – | Crea el sitio de comunicación si no existe (requiere administrador) |
| `-Owner` | – | Propietario del sitio nuevo; además se agrega a `VU Administradores` |
| `-SiteTitle` | `Verificación de uso` | Título del sitio nuevo |
| `-Lcid` | `3082` (español) | Idioma del sitio nuevo |
| `-CuentaServicio` | – | Cuenta de los flujos: «Editar» en el sitio y en las listas con permisos únicos |
| `-TitulosEnEspanol` | – | Usa `title` del esquema como título visible de cada lista (por defecto el título es `VU_*`) |
| `-OmitirPermisos` | – | No crea grupos ni cambia permisos |
| `-SchemaPath` | `schema/listas.json` | Ruta del esquema |

## Cómo verificar

1. **Esquema frente al diseño** (sin conexión): `python tools/verificar_esquema.py` → debe terminar con «Sin diferencias».
2. **Listas y columnas**:
   ```powershell
   Connect-PnPOnline -Url https://biomont.sharepoint.com/sites/VerificacionUso -Interactive -ClientId $appId
   Get-PnPList | Where-Object { $_.RootFolder.ServerRelativeUrl -match '/VU_' } | Select-Object Title, @{n='Url';e={$_.RootFolder.ServerRelativeUrl}}, OnQuickLaunch
   Get-PnPField -List Lists/VU_Verificaciones | Where-Object { -not $_.FromBaseType } | Select-Object InternalName, Title, TypeAsString, Required, Indexed
   ```
3. **Relaciones** (deben decir `Cascade` o `Restrict` donde corresponde):
   ```powershell
   ([xml](Get-PnPField -List Lists/VU_Entrevistas -Identity Verificacion).SchemaXml).Field.RelationshipDeleteBehavior
   ```
   En la interfaz: *Configuración de la lista → columna → Exigir comportamiento de relación*.
4. **Índices**: *Configuración de la lista → Columnas indizadas*.
5. **Validación**: crear una verificación con `DiasAnticipacion = 10` debe fallar con «Los días de anticipación deben ser 7, 15 o 30».
6. **Permisos**: *Configuración de la lista → Permisos de esta lista* en `VU_Verificaciones` (Responsables = Colaborar) y `VU_Aprobaciones` (Responsables = Leer); `VU Lectores` no debe aparecer.
7. **Semilla**: 7 áreas, 4 criterios (suma 100), 1 pregunta con 5 opciones, 4 soluciones con 4 documentos cada una. Una segunda ejecución debe crear 0 elementos.

## Limitaciones y consideraciones

- **Umbral de 5 000 elementos**: toda consulta de la app o de los flujos debe filtrar primero por una columna indexada (🔎). `VU_Respuestas` es la única lista que pasará el umbral; filtra siempre por `Verificacion` o `Entrevista`. Crear un índice en una lista que ya supera 5 000 elementos puede fallar: por eso los índices se crean desde el principio.
- **Máximo 20 índices por lista**: la que más tiene es `VU_Respuestas` (5).
- **Relación exigida = búsqueda indexada**: SharePoint solo permite *Eliminación en cascada* o *Restringir eliminación* en búsquedas de un solo valor e indexadas. El script crea el índice antes de exigir la relación y lo comprueba leyendo el `SchemaXml`.
- **La biblioteca no tiene cascada**: las búsquedas de `VU_Evidencias` no exigen relación (`None`), así que borrar una verificación no borra sus archivos; la carpeta `/{VU-xxxxx}/` la debe borrar la app o un flujo. Con `Restrict` se bloquearía el borrado en cascada de verificaciones y entrevistas.
- **Restringir eliminación** en los catálogos significa que no se puede borrar un área, criterio, pregunta u opción ya usada: se desactiva con `Activo = No`.
- **Columnas obligatorias**: SharePoint las exige en los formularios y en el conector de Power Apps/Power Automate, pero la API de CSOM/PnP no las valida al crear elementos; por eso la semilla puede dejar vacías `Responsable` y `Enlace` si no se dan correos ni URL (lo avisa con una advertencia). Complétalas antes de usar la app.
- **Notificaciones sin verificación**: `VU_Notificaciones.Verificacion` es obligatoria según el diseño, pero el recordatorio de vencimiento del flujo F4 se refiere a soluciones sin verificación activa. Se respetó el diseño; F4 tendrá que enlazar la última verificación o el diseño tendrá que relajar esa columna. Las columnas Sí/No marcadas como obligatorias en el diseño se crean así y con valor predeterminado.
- **Columnas obligatorias en la biblioteca**: `Verificacion`, `Entrevista` y `TipoEvidencia` son obligatorias; si se sube un archivo sin esos metadatos (por ejemplo, con *Crear archivo* del conector) SharePoint lo puede dejar desprotegido hasta completarlos. La app debe crear el archivo y actualizar sus propiedades en el mismo paso lógico (y, si hiciera falta, protegerlo).
- **Títulos de lista**: por defecto el título es el nombre interno (`VU_Verificaciones`), que es el que esperan el diseño, `pac code add-data-source` y las variables de entorno de los flujos. `-TitulosEnEspanol` cambia solo el título visible; la URL no cambia.
- **Nombres visibles**: se evitaron los que coinciden con columnas nativas (por eso `Version` se muestra como «Versión del documento»). Las columnas se buscan siempre por nombre interno exacto.
- **Zona horaria**: crea el sitio con la zona horaria de Lima (*Configuración regional*); las columnas de solo fecha (`FechaAlerta`, `ProximaVU`, …) y el filtro del flujo F1 dependen de ella. La semilla convierte las fechas con la zona horaria del sitio.
- **Permisos**: el script no quita permisos de nivel de sitio ni restablece la herencia de una lista que debería heredar (solo avisa). En las listas con permisos únicos sí deja a los grupos `VU *` con el rol exacto de la matriz y quita a Miembros y Visitantes; los principales que se hayan agregado a mano se conservan.
- **Lo que no hace**: no elimina columnas ni listas que sobren, no cambia el tipo de una columna existente, no crea los flujos ni la Code App, y no rompe permisos por elemento.

## Decisiones tomadas donde el diseño no es explícito

| Tema | Decisión | Motivo |
|---|---|---|
| Relación de búsquedas sin anotar hacia catálogos (`VU_Entrevistas.Area`, `VU_Respuestas.Pregunta/Criterio/Opcion`, `VU_PuntajesCriterio.Criterio`) | `Restrict` (+ índice) | Regla general de §2.1: «restringir eliminación en los catálogos»; protege el histórico |
| `VU_Areas.AreaPadre` (autorreferencia) | `None` | El diseño no la anota y exigir relación sobre la misma lista es arriesgado |
| `VU_Respuestas.Verificacion` (desnormalizada) | `None` (indexada) | `Restrict` impediría borrar verificaciones; las respuestas ya se borran en cascada vía `Entrevista` |
| Búsquedas de `VU_Evidencias` | `None` | §2.3: «las búsquedas de la biblioteca no tienen cascada» |
| Rangos numéricos no explícitos | Puntajes 1–10, índice 0–100, pesos 0–100, contadores ≥ 0 sin decimales | RN-03 y notas del diseño |
| `DiasAnticipacion` | Mín. 7, máx. 30 y fórmula `OR(=7,=15,=30)` | §2.3 |
| `Resultado` | «Adopción plena», «Adopción parcial», «Adopción baja» | El diseño abrevia «plena / parcial / baja» |
| Valores predeterminados | `Estado` = Borrador / Pendiente, `Decision` = Pendiente, `EstadoVU` = Pendiente, `PeriodicidadMeses` = 6, `EntrevistasCompletas` = 0, `Activo`/`Vigente` = Sí, `AlertaEnviada`/`NotificarAlFinalizar` = No | Estados iniciales de §2.4/§2.5 y prototipo |
| Semilla: `EstadoVU` | «Pendiente» en las 4 soluciones | No se crean verificaciones; por §2.5 sin verificación el estado es Pendiente (el valor del prototipo queda en `estadoPrototipo`) |
| Semilla: áreas padre | Solo Despacho → Operaciones | Es el único ejemplo del diseño |
| Semilla: `TipoSolucion` | Solo «Plan de entregas» = Power App | Es la única descripción que lo dice |
