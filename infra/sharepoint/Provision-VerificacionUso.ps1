#Requires -Version 7.2
#Requires -Modules PnP.PowerShell

<#
.SYNOPSIS
    Aprovisiona de forma idempotente el sitio de SharePoint Online de "Verificación de uso":
    12 listas, la biblioteca VU_Evidencias, columnas, índices, relaciones, grupos y permisos.

.DESCRIPTION
    Lee la definición declarativa de schema/listas.json (fuente: docs/diseno-verificacion-uso.md,
    §2 y §3.6) y deja el sitio en ese estado. Se puede ejecutar tantas veces como se quiera: cada
    objeto se crea solo si falta y, si ya existe, se corrige lo que difiere (nombre visible,
    obligatoriedad, opciones, valor predeterminado, índice, comportamiento de relación, validación,
    vista predeterminada y permisos). El script nunca elimina listas, columnas ni elementos.

    Pasos:
      0. (Opcional, -CreateSite) Crea el sitio de comunicación si no existe.
      1. Listas y biblioteca: URL = nombre interno, descripción, versionado y fuera de la navegación.
      2. Columnas por XML con el nombre interno ASCII como DisplayName; después se aplica el nombre
         visible en español. Índices (🔎), relaciones (cascada / restringir, con índice) y la
         validación de DiasAnticipacion (7, 15 o 30).
      3. Vista predeterminada con todas las columnas.
      4. Grupos "VU *" con su permiso en el sitio y, opcionalmente, la cuenta de servicio.
      5. Permisos por lista según §3.6 (rompe la herencia en las transaccionales y en
         Aprobaciones/Notificaciones).

.PARAMETER SiteUrl
    URL del sitio. Predeterminado: https://biomont.sharepoint.com/sites/VerificacionUso

.PARAMETER ClientId
    Id. de la aplicación de Entra ID registrada para el inicio de sesión interactivo de PnP
    (Register-PnPEntraIDAppForInteractiveLogin). Obligatorio.

.PARAMETER CreateSite
    Crea el sitio de comunicación con New-PnPSite si no existe. Se conecta a la raíz del tenant
    (https://<tenant>.sharepoint.com) y requiere ser administrador de SharePoint o tener habilitada
    la creación de sitios por autoservicio.

.PARAMETER Owner
    Correo del propietario. Se usa como administrador de la colección al crear el sitio
    (-CreateSite) y se agrega como miembro del grupo "VU Administradores".

.PARAMETER SiteTitle
    Título del sitio cuando se crea. Predeterminado: "Verificación de uso".

.PARAMETER Lcid
    Idioma del sitio cuando se crea. Predeterminado: 3082 (español).

.PARAMETER CuentaServicio
    Correo de la cuenta de servicio de los flujos de Power Automate. Recibe "Editar" en el sitio y
    en cada lista con permisos únicos (§3.6). Si se omite, se muestra una advertencia.

.PARAMETER TitulosEnEspanol
    Aplica el título visible en español de cada lista (propiedad "title" del esquema). Sin este
    modificador el título de cada lista es igual a su nombre interno (VU_*), que es el nombre que
    usan el diseño, el conector de SharePoint y los flujos.

.PARAMETER OmitirPermisos
    No crea grupos ni modifica permisos (útil en entornos de desarrollo).

.PARAMETER SchemaPath
    Ruta del esquema. Predeterminado: <carpeta del script>/schema/listas.json

.EXAMPLE
    ./Provision-VerificacionUso.ps1 -ClientId 00000000-0000-0000-0000-000000000000

.EXAMPLE
    ./Provision-VerificacionUso.ps1 -ClientId $appId -CreateSite -Owner admin@contoso.com -CuentaServicio flujos@contoso.com

.NOTES
    Requiere PowerShell 7.2 o superior (se recomienda 7.4+) y el módulo PnP.PowerShell.
#>
[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string]$SiteUrl = 'https://biomont.sharepoint.com/sites/VerificacionUso',

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ClientId,

    [switch]$CreateSite,

    [string]$Owner,

    [ValidateNotNullOrEmpty()]
    [string]$SiteTitle = 'Verificación de uso',

    [ValidateRange(1, 65535)]
    [int]$Lcid = 3082,

    [string]$CuentaServicio,

    [switch]$TitulosEnEspanol,

    [switch]$OmitirPermisos,

    [string]$SchemaPath
)

$ErrorActionPreference = 'Stop'

$script:Esquema = $null
$script:RolesPorTipo = $null
$script:Resumen = [ordered]@{
    ListasCreadas          = 0
    ListasAjustadas        = 0
    ColumnasCreadas        = 0
    ColumnasAjustadas      = 0
    IndicesCreados         = 0
    RelacionesConfiguradas = 0
    ValidacionesCreadas    = 0
    VistasAjustadas        = 0
    GruposCreados          = 0
    PermisosAjustados      = 0
}

#region Utilidades de salida y lectura

function Write-VUPaso {
    param([Parameter(Mandatory = $true)][string]$Mensaje)
    Write-Host ''
    Write-Host ('==> {0}' -f $Mensaje) -ForegroundColor Cyan
}

function Write-VUOk {
    param([Parameter(Mandatory = $true)][string]$Mensaje)
    Write-Host ('    [=] {0}' -f $Mensaje) -ForegroundColor DarkGray
}

function Write-VUCambio {
    param([Parameter(Mandatory = $true)][string]$Mensaje)
    Write-Host ('    [+] {0}' -f $Mensaje) -ForegroundColor Green
}

function Write-VUAjuste {
    param([Parameter(Mandatory = $true)][string]$Mensaje)
    Write-Host ('    [~] {0}' -f $Mensaje) -ForegroundColor Yellow
}

function Write-VUInfo {
    param([Parameter(Mandatory = $true)][string]$Mensaje)
    Write-Host ('    {0}' -f $Mensaje)
}

function Get-VUProp {
    # Lee una propiedad opcional de un objeto del JSON; devuelve $PorDefecto si falta o es null.
    param($Objeto, [Parameter(Mandatory = $true)][string]$Nombre, $PorDefecto = $null)
    if ($null -eq $Objeto) { return $PorDefecto }
    if ($Objeto -is [System.Collections.IDictionary]) {
        if ($Objeto.Contains($Nombre) -and $null -ne $Objeto[$Nombre]) { return $Objeto[$Nombre] }
        return $PorDefecto
    }
    $propiedad = $Objeto.PSObject.Properties[$Nombre]
    if ($null -eq $propiedad -or $null -eq $propiedad.Value) { return $PorDefecto }
    return $propiedad.Value
}

function Get-VUPropiedadCliente {
    # Lee una propiedad de un objeto CSOM y la carga si todavía no está inicializada.
    param([Parameter(Mandatory = $true)]$Objeto, [Parameter(Mandatory = $true)][string]$Propiedad)
    try {
        return $Objeto.$Propiedad
    }
    catch {
        return (Get-PnPProperty -ClientObject $Objeto -Property $Propiedad)
    }
}

function ConvertTo-VUXml {
    param([AllowNull()]$Valor)
    if ($null -eq $Valor) { return '' }
    return [System.Security.SecurityElement]::Escape([string]$Valor)
}

function Format-VUNumero {
    param([Parameter(Mandatory = $true)]$Valor)
    return ([double]$Valor).ToString([System.Globalization.CultureInfo]::InvariantCulture)
}

#endregion

#region Validación del esquema (sin conexión)

function Test-VUEsquema {
    param([Parameter(Mandatory = $true)]$Esquema)

    $tiposValidos = @('Text', 'Note', 'Number', 'Boolean', 'DateTime', 'Choice', 'User', 'URL', 'Lookup')
    $errores = New-Object System.Collections.Generic.List[string]
    $perfiles = Get-VUProp (Get-VUProp $Esquema 'security') 'profiles'
    $listasVistas = @{}

    if ($null -eq $perfiles) { $errores.Add('Falta security.profiles.') }

    foreach ($lista in @($Esquema.lists)) {
        $nombre = [string]$lista.name
        if ($nombre -notmatch '^[A-Za-z0-9_]+$') { $errores.Add(('Lista "{0}": el nombre interno debe ser ASCII, sin espacios.' -f $nombre)) }
        if (@('GenericList', 'DocumentLibrary') -notcontains [string]$lista.template) { $errores.Add(('Lista "{0}": plantilla no soportada "{1}".' -f $nombre, $lista.template)) }
        if ($null -ne $perfiles -and $null -eq $perfiles.PSObject.Properties[[string]$lista.permissionProfile]) {
            $errores.Add(('Lista "{0}": perfil de permisos desconocido "{1}".' -f $nombre, $lista.permissionProfile))
        }

        $columnasVistas = @{}
        foreach ($columna in @($lista.columns)) {
            $interno = [string]$columna.internalName
            $etiqueta = '{0}.{1}' -f $nombre, $interno
            if ($interno -cnotmatch '^[A-Za-z][A-Za-z0-9_]{0,31}$') { $errores.Add(('{0}: el nombre interno debe ser ASCII y de 32 caracteres como máximo.' -f $etiqueta)) }
            if ($columnasVistas.ContainsKey($interno)) { $errores.Add(('{0}: columna duplicada.' -f $etiqueta)) }
            $columnasVistas[$interno] = $true
            if ([string]::IsNullOrWhiteSpace([string](Get-VUProp $columna 'displayName'))) { $errores.Add(('{0}: falta displayName.' -f $etiqueta)) }

            $tipo = [string]$columna.type
            if ($tiposValidos -notcontains $tipo) { $errores.Add(('{0}: tipo no soportado "{1}".' -f $etiqueta, $tipo)); continue }
            if ($tipo -eq 'Choice' -and @(Get-VUProp $columna 'choices' @()).Count -eq 0) { $errores.Add(('{0}: la elección no tiene opciones.' -f $etiqueta)) }
            if ($tipo -eq 'DateTime' -and @('DateOnly', 'DateTime') -notcontains [string]$columna.format) { $errores.Add(('{0}: format debe ser DateOnly o DateTime.' -f $etiqueta)) }
            if ($tipo -eq 'Lookup') {
                $destino = [string]$columna.lookupList
                if ($destino -ne $nombre -and -not $listasVistas.ContainsKey($destino)) {
                    $errores.Add(('{0}: la lista destino "{1}" debe declararse antes (orden de dependencia).' -f $etiqueta, $destino))
                }
                $relacion = [string](Get-VUProp $columna 'relationshipBehavior' 'None')
                if (@('None', 'Cascade', 'Restrict') -notcontains $relacion) { $errores.Add(('{0}: relationshipBehavior no válido "{1}".' -f $etiqueta, $relacion)) }
                if ($relacion -ne 'None' -and -not [bool](Get-VUProp $columna 'indexed' $false)) {
                    $errores.Add(('{0}: una relación {1} exige indexed = true.' -f $etiqueta, $relacion))
                }
            }
        }
        $listasVistas[$nombre] = $true
    }

    if ($errores.Count -gt 0) {
        throw ("El esquema tiene errores:`n - " + ($errores -join "`n - "))
    }
}

#endregion

#region Conexión y sitio

function Connect-VUSitio {
    param([Parameter(Mandatory = $true)][string]$Url)
    Write-VUInfo ('Conectando a {0} (inicio de sesión interactivo)...' -f $Url)
    try {
        Connect-PnPOnline -Url $Url -Interactive -ClientId $ClientId -ErrorAction Stop
    }
    catch {
        throw ('No se pudo conectar a "{0}". Revisa el ClientId y los permisos de la app de Entra ID. Detalle: {1}' -f $Url, $_.Exception.Message)
    }
}

function Get-VUEstadoSitio {
    # 0 = no existe, 1 = aprovisionándose, 2 = listo, 3 = error, 4 = la URL ya está en uso.
    param([Parameter(Mandatory = $true)][string]$Url)
    $ruta = "/_api/SPSiteManager/status?url='{0}'" -f [System.Uri]::EscapeDataString($Url)
    $respuesta = Invoke-PnPSPRestMethod -Method Get -Url $ruta -ErrorAction Stop
    $estado = Get-VUProp $respuesta 'SiteStatus'
    if ($null -eq $estado) {
        $estado = Get-VUProp (Get-VUProp (Get-VUProp $respuesta 'd') 'Status') 'SiteStatus'
    }
    if ($null -eq $estado) { throw 'Respuesta inesperada de /_api/SPSiteManager/status.' }
    return [int]$estado
}

function Initialize-VUSitio {
    Write-VUPaso ('Paso 0. Sitio de comunicación {0}' -f $SiteUrl)
    $raiz = ([System.Uri]$SiteUrl).GetLeftPart([System.UriPartial]::Authority)
    Connect-VUSitio -Url $raiz

    $estado = Get-VUEstadoSitio -Url $SiteUrl
    if ($estado -eq 2) {
        Write-VUOk 'El sitio ya existe.'
        return
    }
    if ($estado -eq 0) {
        $parametros = @{
            Type        = 'CommunicationSite'
            Title       = $SiteTitle
            Url         = $SiteUrl
            Lcid        = [uint32]$Lcid
            Wait        = $true
            ErrorAction = 'Stop'
        }
        if (-not [string]::IsNullOrWhiteSpace($Owner)) { $parametros['Owner'] = $Owner }
        try {
            $null = New-PnPSite @parametros
        }
        catch {
            throw ('No se pudo crear el sitio "{0}". Se requiere ser administrador de SharePoint (o tener habilitada la creación de sitios por autoservicio). Detalle: {1}' -f $SiteUrl, $_.Exception.Message)
        }
        Write-VUCambio ('Sitio de comunicación creado (LCID {0}).' -f $Lcid)
        return
    }
    if ($estado -eq 1) {
        Write-VUInfo 'El sitio se está aprovisionando; esperando a que termine...'
        $intentos = 0
        while ($estado -eq 1 -and $intentos -lt 30) {
            Start-Sleep -Seconds 10
            $estado = Get-VUEstadoSitio -Url $SiteUrl
            $intentos++
        }
        if ($estado -eq 2) {
            Write-VUOk 'El sitio terminó de aprovisionarse.'
            return
        }
    }
    throw ('SPSiteManager devolvió el estado {0} para "{1}" (1 = aún en aprovisionamiento, 3 = error, 4 = la URL ya está en uso, por ejemplo por un sitio en la papelera de reciclaje).' -f $estado, $SiteUrl)
}

#endregion

#region Listas

function Get-VUUrlRelativaLista {
    param([Parameter(Mandatory = $true)]$Definicion)
    if ([string]$Definicion.template -eq 'DocumentLibrary') { return [string]$Definicion.name }
    return ('Lists/{0}' -f $Definicion.name)
}

function Get-VULista {
    # Busca la lista por su URL (no por título), así el título visible puede cambiar sin afectar.
    param([Parameter(Mandatory = $true)]$Definicion)
    $url = Get-VUUrlRelativaLista -Definicion $Definicion
    try {
        $lista = Get-PnPList -Identity $url -ErrorAction Stop
    }
    catch {
        $lista = $null
    }
    return $lista
}

function Initialize-VULista {
    param([Parameter(Mandatory = $true)]$Definicion)

    $nombre = [string]$Definicion.name
    $tituloDeseado = $nombre
    if ($TitulosEnEspanol) { $tituloDeseado = [string]$Definicion.title }

    $lista = Get-VULista -Definicion $Definicion
    if ($null -eq $lista) {
        $url = Get-VUUrlRelativaLista -Definicion $Definicion
        try {
            $null = New-PnPList -Title $tituloDeseado -Url $url -Template ([string]$Definicion.template) -ErrorAction Stop
        }
        catch {
            throw ('No se pudo crear la lista {0}: {1}' -f $nombre, $_.Exception.Message)
        }
        $lista = Get-VULista -Definicion $Definicion
        if ($null -eq $lista) { throw ('La lista {0} se creó, pero no se encuentra en la URL "{1}".' -f $nombre, $url) }
        $script:Resumen.ListasCreadas++
        Write-VUCambio ('{0} creada ({1}, título "{2}").' -f $nombre, $Definicion.template, $tituloDeseado)
    }
    else {
        Write-VUOk ('{0} ya existe (título "{1}").' -f $nombre, $lista.Title)
        if ($TitulosEnEspanol -and [string]$lista.Title -cne $tituloDeseado) {
            Set-PnPList -Identity $lista -Title $tituloDeseado -ErrorAction Stop | Out-Null
            $script:Resumen.ListasAjustadas++
            Write-VUAjuste ('{0}: título cambiado a "{1}".' -f $nombre, $tituloDeseado)
        }
    }

    $descripcion = [string](Get-VUProp $Definicion 'description' '')
    $descripcionActual = [string](Get-PnPProperty -ClientObject $lista -Property Description)
    if ($descripcionActual -cne $descripcion) {
        Set-PnPList -Identity $lista -Description $descripcion -ErrorAction Stop | Out-Null
        $script:Resumen.ListasAjustadas++
        Write-VUAjuste ('{0}: descripción actualizada.' -f $nombre)
    }

    if ([bool](Get-VUProp $Definicion 'enableVersioning' $false)) {
        $versionado = [bool](Get-PnPProperty -ClientObject $lista -Property EnableVersioning)
        if (-not $versionado) {
            Set-PnPList -Identity $lista -EnableVersioning $true -ErrorAction Stop | Out-Null
            $script:Resumen.ListasAjustadas++
            Write-VUAjuste ('{0}: historial de versiones activado.' -f $nombre)
        }
        else {
            Write-VUOk ('{0}: historial de versiones activo.' -f $nombre)
        }
    }

    $enNavegacion = [bool](Get-PnPProperty -ClientObject $lista -Property OnQuickLaunch)
    $navegacionDeseada = [bool](Get-VUProp $Definicion 'onQuickLaunch' $false)
    if ($enNavegacion -ne $navegacionDeseada) {
        $lista.OnQuickLaunch = $navegacionDeseada
        $lista.Update()
        Invoke-PnPQuery -ErrorAction Stop
        $script:Resumen.ListasAjustadas++
        Write-VUAjuste ('{0}: OnQuickLaunch = {1}.' -f $nombre, $navegacionDeseada)
    }

    return $lista
}

#endregion

#region Columnas

function Get-VUCamposLista {
    # Diccionario InternalName -> campo, con comparación exacta (no por título, que puede coincidir
    # con columnas nativas como "Version" u "Orden").
    param([Parameter(Mandatory = $true)]$Lista)
    $mapa = [System.Collections.Generic.Dictionary[string, object]]::new([System.StringComparer]::Ordinal)
    foreach ($campo in @(Get-PnPField -List $Lista -ErrorAction Stop)) {
        if (-not $mapa.ContainsKey([string]$campo.InternalName)) { $mapa[[string]$campo.InternalName] = $campo }
    }
    return , $mapa
}

function Get-VUValorPredeterminado {
    param([Parameter(Mandatory = $true)]$Columna)
    $valor = Get-VUProp $Columna 'default'
    if ($null -eq $valor) { return $null }
    $tipo = [string]$Columna.type
    if ($tipo -eq 'Boolean') {
        if ([bool]$valor) { return '1' }
        return '0'
    }
    if ($tipo -eq 'Number') { return (Format-VUNumero $valor) }
    return [string]$valor
}

function Get-VUOpcionesCampo {
    param([Parameter(Mandatory = $true)]$Campo)
    $xml = [xml][string](Get-VUPropiedadCliente -Objeto $Campo -Propiedad 'SchemaXml')
    $resultado = New-Object System.Collections.Generic.List[string]
    foreach ($nodo in @($xml.SelectNodes('/Field/CHOICES/CHOICE'))) { $resultado.Add([string]$nodo.InnerText) }
    return , $resultado.ToArray()
}

function Get-VUComportamientoRelacion {
    param([Parameter(Mandatory = $true)]$Campo)
    $xml = [xml][string](Get-VUPropiedadCliente -Objeto $Campo -Propiedad 'SchemaXml')
    $valor = $xml.DocumentElement.GetAttribute('RelationshipDeleteBehavior')
    if ([string]::IsNullOrEmpty($valor)) { return 'None' }
    return $valor
}

function New-VUXmlCampo {
    # Genera el XML del campo con DisplayName = Name, para que SharePoint use el nombre interno ASCII.
    param(
        [Parameter(Mandatory = $true)]$Columna,
        [Parameter(Mandatory = $true)][hashtable]$ListasPorNombre
    )

    $interno = [string]$Columna.internalName
    $tipo = [string]$Columna.type
    $atributos = [ordered]@{
        ID          = '{' + [guid]::NewGuid().ToString() + '}'
        Type        = $tipo
        Name        = $interno
        StaticName  = $interno
        DisplayName = $interno
        Required    = 'FALSE'
    }
    if ([bool](Get-VUProp $Columna 'required' $false)) { $atributos['Required'] = 'TRUE' }
    $descripcion = Get-VUProp $Columna 'description'
    if ($null -ne $descripcion) { $atributos['Description'] = [string]$descripcion }

    $interior = New-Object System.Text.StringBuilder
    $predeterminado = Get-VUValorPredeterminado -Columna $Columna
    if ($null -ne $predeterminado) { [void]$interior.AppendFormat('<Default>{0}</Default>', (ConvertTo-VUXml $predeterminado)) }

    switch ($tipo) {
        'Text' {
            $atributos['MaxLength'] = '255'
        }
        'Note' {
            $atributos['NumLines'] = '6'
            $atributos['RichText'] = 'FALSE'
            $atributos['RichTextMode'] = 'Compatible'
            $atributos['AppendOnly'] = 'FALSE'
            if ([bool](Get-VUProp $Columna 'richText' $false)) {
                $atributos['RichText'] = 'TRUE'
                $atributos['RichTextMode'] = 'FullHtml'
            }
        }
        'Number' {
            $atributos['Percentage'] = 'FALSE'
            foreach ($par in @(@('min', 'Min'), @('max', 'Max'), @('decimals', 'Decimals'))) {
                $valor = Get-VUProp $Columna $par[0]
                if ($null -ne $valor) { $atributos[$par[1]] = Format-VUNumero $valor }
            }
        }
        'Boolean' {
            # Sin atributos adicionales; el valor predeterminado va en <Default>.
        }
        'DateTime' {
            $atributos['Format'] = [string]$Columna.format
            $atributos['FriendlyDisplayFormat'] = 'Disabled'
        }
        'Choice' {
            $atributos['Format'] = 'Dropdown'
            $atributos['FillInChoice'] = 'FALSE'
            [void]$interior.Append('<CHOICES>')
            foreach ($opcion in @($Columna.choices)) { [void]$interior.AppendFormat('<CHOICE>{0}</CHOICE>', (ConvertTo-VUXml $opcion)) }
            [void]$interior.Append('</CHOICES>')
        }
        'User' {
            $atributos['UserSelectionMode'] = 'PeopleOnly'
            $atributos['UserSelectionScope'] = '0'
            $atributos['Mult'] = 'FALSE'
        }
        'URL' {
            $atributos['Format'] = 'Hyperlink'
        }
        'Lookup' {
            $destino = $ListasPorNombre[[string]$Columna.lookupList]
            if ($null -eq $destino) { throw ('No se encontró la lista destino {0} de la búsqueda {1}.' -f $Columna.lookupList, $interno) }
            $atributos['List'] = '{' + $destino.Id.ToString() + '}'
            $atributos['ShowField'] = [string](Get-VUProp $Columna 'lookupField' 'Title')
            $atributos['Mult'] = 'FALSE'
            if ([bool](Get-VUProp $Columna 'indexed' $false)) { $atributos['Indexed'] = 'TRUE' }
            # RelationshipDeleteBehavior se aplica después (Set-VURelacion), cuando el índice ya existe.
        }
        default {
            throw ('Tipo de columna no soportado: {0}' -f $tipo)
        }
    }

    # La validación de columna no va en el XML: Set-VUValidacion la aplica después del cambio de
    # nombre visible, con la misma sintaxis que usa la interfaz de SharePoint ([Nombre visible]).

    $partes = foreach ($entrada in $atributos.GetEnumerator()) { '{0}="{1}"' -f $entrada.Key, (ConvertTo-VUXml $entrada.Value) }
    return ('<Field {0}>{1}</Field>' -f ($partes -join ' '), $interior.ToString())
}

function Set-VUPropiedadesCampo {
    # Set-PnPField informa los fallos como advertencias; aquí se verifica el resultado y se lanza error.
    param(
        [Parameter(Mandatory = $true)]$Lista,
        [Parameter(Mandatory = $true)]$Campo,
        [Parameter(Mandatory = $true)][hashtable]$Valores,
        [Parameter(Mandatory = $true)][string]$Etiqueta
    )
    $avisos = $null
    try {
        Set-PnPField -List $Lista -Identity $Campo.Id -Values $Valores -ErrorAction Stop -WarningVariable avisos -WarningAction SilentlyContinue | Out-Null
    }
    catch {
        throw ('No se pudo actualizar {0} ({1}): {2}' -f $Etiqueta, (@($Valores.Keys) -join ', '), $_.Exception.Message)
    }
    $campoActualizado = Get-PnPField -List $Lista -Identity $Campo.Id -ErrorAction Stop

    $pendientes = New-Object System.Collections.Generic.List[string]
    foreach ($clave in @($Valores.Keys)) {
        if ($clave -eq 'ValidationFormula') {
            # SharePoint puede normalizar la fórmula; basta con que no quede vacía.
            if ([string]::IsNullOrWhiteSpace([string](Get-VUPropiedadCliente -Objeto $campoActualizado -Propiedad 'ValidationFormula'))) { $pendientes.Add($clave) }
        }
        elseif ($clave -eq 'Choices') {
            $actual = @(Get-VUOpcionesCampo -Campo $campoActualizado) -join "`n"
            if ($actual -cne (@($Valores[$clave]) -join "`n")) { $pendientes.Add($clave) }
        }
        else {
            $actual = Get-VUPropiedadCliente -Objeto $campoActualizado -Propiedad $clave
            if ([string]$actual -cne [string]$Valores[$clave]) { $pendientes.Add($clave) }
        }
    }
    if ($pendientes.Count -gt 0) {
        $detalle = ''
        if ($avisos) { $detalle = ' Advertencias de Set-PnPField: ' + ((@($avisos) | ForEach-Object { [string]$_ }) -join ' | ') }
        throw ('No se aplicaron las propiedades {0} en {1}.{2}' -f ($pendientes -join ', '), $Etiqueta, $detalle)
    }
    return $campoActualizado
}

function Initialize-VUCampo {
    param(
        [Parameter(Mandatory = $true)]$Lista,
        [Parameter(Mandatory = $true)][string]$NombreLista,
        [Parameter(Mandatory = $true)]$Columna,
        [Parameter(Mandatory = $true)]$Campos,
        [Parameter(Mandatory = $true)][hashtable]$ListasPorNombre
    )

    $interno = [string]$Columna.internalName
    $etiqueta = '{0}.{1}' -f $NombreLista, $interno
    $campo = $null
    if ($Campos.ContainsKey($interno)) { $campo = $Campos[$interno] }

    if ($null -eq $campo) {
        $xml = New-VUXmlCampo -Columna $Columna -ListasPorNombre $ListasPorNombre
        Write-Verbose ('XML de {0}: {1}' -f $etiqueta, $xml)
        try {
            $campo = Add-PnPFieldFromXml -List $Lista -FieldXml $xml -ErrorAction Stop
        }
        catch {
            throw ('No se pudo crear la columna {0}: {1}' -f $etiqueta, $_.Exception.Message)
        }
        if ([string]$campo.InternalName -cne $interno) {
            throw ('SharePoint creó la columna {0} con el nombre interno "{1}". Elimínala y revisa si hay una colisión de nombres.' -f $etiqueta, $campo.InternalName)
        }
        $Campos[$interno] = $campo
        $script:Resumen.ColumnasCreadas++
        Write-VUCambio ('{0} ({1}) creada.' -f $etiqueta, $Columna.type)
    }
    elseif ($interno -ne 'Title' -and ([bool]$campo.FromBaseType -or [bool]$campo.ReadOnlyField)) {
        throw ('El nombre interno {0} coincide con una columna nativa de SharePoint y no se puede usar.' -f $etiqueta)
    }

    # Reconciliar propiedades simples (nombre visible, obligatoriedad, descripción, predeterminado, opciones).
    $cambios = @{}
    $tituloDeseado = [string]$Columna.displayName
    if ([string]$campo.Title -cne $tituloDeseado) { $cambios['Title'] = $tituloDeseado }

    $requeridoDeseado = [bool](Get-VUProp $Columna 'required' $false)
    if ([bool]$campo.Required -ne $requeridoDeseado) { $cambios['Required'] = $requeridoDeseado }

    $descripcion = Get-VUProp $Columna 'description'
    if ($null -ne $descripcion -and [string](Get-VUPropiedadCliente -Objeto $campo -Propiedad 'Description') -cne [string]$descripcion) {
        $cambios['Description'] = [string]$descripcion
    }

    $predeterminado = Get-VUValorPredeterminado -Columna $Columna
    if ($null -ne $predeterminado -and [string](Get-VUPropiedadCliente -Objeto $campo -Propiedad 'DefaultValue') -cne $predeterminado) {
        $cambios['DefaultValue'] = $predeterminado
    }

    if ([string]$Columna.type -eq 'Choice') {
        $opcionesActuales = @(Get-VUOpcionesCampo -Campo $campo) -join "`n"
        [string[]]$opcionesDeseadas = @($Columna.choices)
        if ($opcionesActuales -cne ($opcionesDeseadas -join "`n")) { $cambios['Choices'] = $opcionesDeseadas }
    }

    if ($cambios.Count -gt 0) {
        $campo = Set-VUPropiedadesCampo -Lista $Lista -Campo $campo -Valores $cambios -Etiqueta $etiqueta
        $Campos[$interno] = $campo
        $script:Resumen.ColumnasAjustadas++
        if ($cambios.ContainsKey('Title')) {
            Write-VUAjuste ('{0}: nombre visible "{1}".' -f $etiqueta, $tituloDeseado)
            $cambios.Remove('Title')
        }
        if ($cambios.Count -gt 0) { Write-VUAjuste ('{0}: {1} actualizados.' -f $etiqueta, ((@($cambios.Keys) | Sort-Object) -join ', ')) }
    }
    else {
        Write-VUOk ('{0} ("{1}") sin cambios.' -f $etiqueta, $tituloDeseado)
    }

    return $campo
}

function Set-VUIndice {
    param(
        [Parameter(Mandatory = $true)]$Lista,
        [Parameter(Mandatory = $true)]$Campo,
        [Parameter(Mandatory = $true)][string]$Etiqueta
    )
    if ([bool]$Campo.Indexed) { return $Campo }
    $campoActualizado = Set-VUPropiedadesCampo -Lista $Lista -Campo $Campo -Valores @{ Indexed = $true } -Etiqueta $Etiqueta
    $script:Resumen.IndicesCreados++
    Write-VUCambio ('{0}: índice creado.' -f $Etiqueta)
    return $campoActualizado
}

function Get-VUCampoBusqueda {
    # Devuelve el campo como Microsoft.SharePoint.Client.FieldLookup (CastTo por reflexión, compatible con cualquier versión de PowerShell).
    param([Parameter(Mandatory = $true)]$Campo)
    $base = $Campo.PSObject.BaseObject
    if ($base -is [Microsoft.SharePoint.Client.FieldLookup]) { return $base }
    $contexto = (Get-PnPContext).PSObject.BaseObject
    $metodo = [Microsoft.SharePoint.Client.ClientRuntimeContext].GetMethod('CastTo').MakeGenericMethod([Microsoft.SharePoint.Client.FieldLookup])
    $argumentos = New-Object 'object[]' 1
    $argumentos[0] = $base
    return $metodo.Invoke($contexto, $argumentos)
}

function Set-VURelacion {
    param(
        [Parameter(Mandatory = $true)]$Lista,
        [Parameter(Mandatory = $true)]$Campo,
        [Parameter(Mandatory = $true)][ValidateSet('None', 'Cascade', 'Restrict')][string]$Comportamiento,
        [Parameter(Mandatory = $true)][string]$Etiqueta
    )
    $actual = Get-VUComportamientoRelacion -Campo $Campo
    if ($actual -eq $Comportamiento) {
        if ($Comportamiento -ne 'None') { Write-VUOk ('{0}: relación {1} ya configurada.' -f $Etiqueta, $Comportamiento) }
        return $Campo
    }

    try {
        $busqueda = Get-VUCampoBusqueda -Campo $Campo
        if ($Comportamiento -ne 'None' -and -not [bool]$Campo.Indexed) {
            # Exigir la relación requiere que la búsqueda esté indexada antes.
            $busqueda.Indexed = $true
            $busqueda.Update()
            Invoke-PnPQuery -ErrorAction Stop
        }
        $busqueda.RelationshipDeleteBehavior = [Microsoft.SharePoint.Client.RelationshipDeleteBehaviorType]$Comportamiento
        $busqueda.Update()
        Invoke-PnPQuery -ErrorAction Stop
    }
    catch {
        throw ('No se pudo configurar la relación {0} en {1}: {2}' -f $Comportamiento, $Etiqueta, $_.Exception.Message)
    }

    $campoActualizado = Get-PnPField -List $Lista -Identity $Campo.Id -ErrorAction Stop
    $resultado = Get-VUComportamientoRelacion -Campo $campoActualizado
    if ($resultado -ne $Comportamiento) {
        throw ('{0}: se esperaba la relación {1}, pero SharePoint devuelve {2}.' -f $Etiqueta, $Comportamiento, $resultado)
    }
    $script:Resumen.RelacionesConfiguradas++
    Write-VUCambio ('{0}: relación {1} (antes {2}).' -f $Etiqueta, $Comportamiento, $actual)
    return $campoActualizado
}

function Set-VUValidacion {
    param(
        [Parameter(Mandatory = $true)]$Lista,
        [Parameter(Mandatory = $true)]$Campo,
        [Parameter(Mandatory = $true)]$Columna,
        [Parameter(Mandatory = $true)][string]$Etiqueta
    )
    $validacion = Get-VUProp $Columna 'validation'
    if ($null -eq $validacion) { return $Campo }

    $formulaActual = [string](Get-VUPropiedadCliente -Objeto $Campo -Propiedad 'ValidationFormula')
    if (-not [string]::IsNullOrWhiteSpace($formulaActual)) {
        Write-VUOk ('{0}: validación presente ({1}).' -f $Etiqueta, $formulaActual)
        return $Campo
    }
    # Las fórmulas de validación de columna se escriben con el nombre visible actual de la columna.
    $formula = ([string]$validacion.formula).Replace(('[{0}]' -f $Columna.internalName), ('[{0}]' -f $Campo.Title))
    $valores = @{ ValidationFormula = $formula; ValidationMessage = [string]$validacion.message }
    $campoActualizado = Set-VUPropiedadesCampo -Lista $Lista -Campo $Campo -Valores $valores -Etiqueta $Etiqueta
    $script:Resumen.ValidacionesCreadas++
    Write-VUCambio ('{0}: validación {1}' -f $Etiqueta, $formula)
    return $campoActualizado
}

#endregion

#region Vistas

function Set-VUVistaPredeterminada {
    param(
        [Parameter(Mandatory = $true)]$Lista,
        [Parameter(Mandatory = $true)]$Definicion
    )
    $nombre = [string]$Definicion.name
    $vista = @(Get-PnPView -List $Lista -ErrorAction Stop) | Where-Object { $_.DefaultView } | Select-Object -First 1
    if ($null -eq $vista) {
        Write-Warning ('{0}: no tiene vista predeterminada; se omite.' -f $nombre)
        return
    }

    $deseados = New-Object System.Collections.Generic.List[string]
    if ([string]$Definicion.template -eq 'DocumentLibrary') {
        $deseados.Add('DocIcon')
        $deseados.Add('LinkFilename')
    }
    else {
        $deseados.Add('LinkTitle')
    }
    foreach ($columna in @($Definicion.columns)) {
        if ([string]$columna.internalName -ne 'Title') { $deseados.Add([string]$columna.internalName) }
    }
    $deseados.Add('Modified')
    $deseados.Add('Editor')

    $actuales = @(Get-PnPProperty -ClientObject $vista -Property ViewFields)
    if (($actuales -join '|') -ceq ($deseados -join '|')) {
        Write-VUOk ('{0}: vista "{1}" al día.' -f $nombre, $vista.Title)
        return
    }
    Set-PnPView -List $Lista -Identity $vista.Id -Fields $deseados.ToArray() -ErrorAction Stop | Out-Null
    $script:Resumen.VistasAjustadas++
    Write-VUAjuste ('{0}: vista "{1}" con {2} columnas.' -f $nombre, $vista.Title, $deseados.Count)
}

#endregion

#region Seguridad

function Get-VUNombreRol {
    # Traduce Read/Contribute/Edit/FullControl al nombre localizado del nivel de permiso del sitio.
    param([Parameter(Mandatory = $true)][string]$Rol)
    $tipo = Get-VUProp $script:Esquema.security.roleTypeKinds $Rol
    if ($null -eq $tipo) { throw ('Rol "{0}" no definido en security.roleTypeKinds.' -f $Rol) }
    if ($null -eq $script:RolesPorTipo) {
        $script:RolesPorTipo = @{}
        foreach ($definicion in @(Get-PnPRoleDefinition -ErrorAction Stop)) {
            $clave = [string]$definicion.RoleTypeKind
            if (-not $script:RolesPorTipo.ContainsKey($clave)) { $script:RolesPorTipo[$clave] = [string]$definicion.Name }
        }
    }
    $nombre = $script:RolesPorTipo[[string]$tipo]
    if ([string]::IsNullOrEmpty($nombre)) { throw ('El sitio no tiene un nivel de permiso de tipo {0} (rol {1}).' -f $tipo, $Rol) }
    return $nombre
}

function Test-VURolVisible {
    param($Rol)
    try {
        return (-not [bool]$Rol.Hidden)
    }
    catch {
        return $true
    }
}

function Get-VURolesPrincipal {
    # Roles visibles (sin "Acceso limitado") de un usuario o grupo en un objeto protegible (web o lista).
    param(
        [Parameter(Mandatory = $true)]$Protegible,
        [Parameter(Mandatory = $true)][int]$PrincipalId
    )
    try {
        $asignacion = $Protegible.RoleAssignments.GetByPrincipalId($PrincipalId)
        $roles = Get-PnPProperty -ClientObject $asignacion -Property RoleDefinitionBindings -ErrorAction Stop
        return @(@($roles) | Where-Object { Test-VURolVisible $_ } | ForEach-Object { [string]$_.Name })
    }
    catch {
        return @()
    }
}

function Get-VUGrupo {
    param([Parameter(Mandatory = $true)][string]$Nombre)
    try {
        return (Get-PnPGroup -Identity $Nombre -ErrorAction Stop)
    }
    catch {
        return $null
    }
}

function Get-VUGrupoAsociado {
    param([Parameter(Mandatory = $true)][ValidateSet('Owner', 'Member', 'Visitor')][string]$Tipo)
    try {
        if ($Tipo -eq 'Owner') { return (Get-PnPGroup -AssociatedOwnerGroup -ErrorAction Stop) }
        if ($Tipo -eq 'Member') { return (Get-PnPGroup -AssociatedMemberGroup -ErrorAction Stop) }
        return (Get-PnPGroup -AssociatedVisitorGroup -ErrorAction Stop)
    }
    catch {
        Write-Warning ('No se pudo obtener el grupo asociado {0} del sitio: {1}' -f $Tipo, $_.Exception.Message)
        return $null
    }
}

function Initialize-VUGrupo {
    param(
        [Parameter(Mandatory = $true)]$DefinicionGrupo,
        [Parameter(Mandatory = $true)]$Web
    )
    $nombre = [string]$DefinicionGrupo.name
    $grupo = Get-VUGrupo -Nombre $nombre
    if ($null -eq $grupo) {
        try {
            $grupo = New-PnPGroup -Title $nombre -Description ([string]$DefinicionGrupo.description) -ErrorAction Stop
        }
        catch {
            throw ('No se pudo crear el grupo "{0}": {1}' -f $nombre, $_.Exception.Message)
        }
        $script:Resumen.GruposCreados++
        Write-VUCambio ('Grupo "{0}" creado.' -f $nombre)
    }
    else {
        Write-VUOk ('Grupo "{0}" ya existe.' -f $nombre)
    }

    $rol = Get-VUNombreRol -Rol ([string]$DefinicionGrupo.siteRole)
    $actuales = @(Get-VURolesPrincipal -Protegible $Web -PrincipalId $grupo.Id)
    if ($actuales -notcontains $rol) {
        Set-PnPGroupPermissions -Identity $nombre -AddRole $rol -ErrorAction Stop | Out-Null
        $script:Resumen.PermisosAjustados++
        Write-VUCambio ('Sitio: "{0}" = {1}.' -f $nombre, $rol)
    }
    else {
        Write-VUOk ('Sitio: "{0}" ya tiene {1}.' -f $nombre, $rol)
    }
    $extras = @($actuales | Where-Object { $_ -ne $rol })
    if ($extras.Count -gt 0) {
        Write-Warning ('El grupo "{0}" tiene además en el sitio: {1}. No se quitan automáticamente; revísalo.' -f $nombre, ($extras -join ', '))
    }
    return $grupo
}

function Add-VUMiembroGrupo {
    param(
        [Parameter(Mandatory = $true)][string]$Grupo,
        [Parameter(Mandatory = $true)][string]$Correo
    )
    $miembros = @(Get-PnPGroupMember -Group $Grupo -ErrorAction Stop)
    $existe = $miembros | Where-Object {
        ([string]$_.Email -eq $Correo) -or ([string]$_.LoginName -like ('*|' + $Correo))
    }
    if ($existe) {
        Write-VUOk ('{0} ya es miembro de "{1}".' -f $Correo, $Grupo)
        return
    }
    Add-PnPGroupMember -LoginName $Correo -Group $Grupo -ErrorAction Stop | Out-Null
    $script:Resumen.PermisosAjustados++
    Write-VUCambio ('{0} agregado a "{1}".' -f $Correo, $Grupo)
}

function Set-VURolGrupoLista {
    # Deja al grupo con exactamente el rol indicado en la lista ('' = sin acceso).
    param(
        [Parameter(Mandatory = $true)]$Lista,
        [Parameter(Mandatory = $true)][string]$NombreLista,
        [Parameter(Mandatory = $true)]$Grupo,
        [AllowEmptyString()][string]$RolDeseado
    )
    $actuales = @(Get-VURolesPrincipal -Protegible $Lista -PrincipalId $Grupo.Id)

    if ([string]::IsNullOrEmpty($RolDeseado)) {
        if ($actuales.Count -eq 0) {
            Write-VUOk ('{0}: "{1}" sin acceso.' -f $NombreLista, $Grupo.Title)
            return
        }
        $asignacion = $Lista.RoleAssignments.GetByPrincipalId($Grupo.Id)
        $asignacion.DeleteObject()
        Invoke-PnPQuery -ErrorAction Stop
        $script:Resumen.PermisosAjustados++
        Write-VUAjuste ('{0}: se quitó el acceso de "{1}" ({2}).' -f $NombreLista, $Grupo.Title, ($actuales -join ', '))
        return
    }

    $cambio = $false
    if ($actuales -notcontains $RolDeseado) {
        Set-PnPListPermission -Identity $Lista -Group $Grupo.Title -AddRole $RolDeseado -ErrorAction Stop | Out-Null
        $cambio = $true
        Write-VUCambio ('{0}: "{1}" = {2}.' -f $NombreLista, $Grupo.Title, $RolDeseado)
    }
    foreach ($otro in $actuales) {
        if ($otro -ne $RolDeseado) {
            Set-PnPListPermission -Identity $Lista -Group $Grupo.Title -RemoveRole $otro -ErrorAction Stop | Out-Null
            $cambio = $true
            Write-VUAjuste ('{0}: se quitó {1} a "{2}".' -f $NombreLista, $otro, $Grupo.Title)
        }
    }
    if ($cambio) { $script:Resumen.PermisosAjustados++ }
    else { Write-VUOk ('{0}: "{1}" ya tiene {2}.' -f $NombreLista, $Grupo.Title, $RolDeseado) }
}

function Set-VUPermisosLista {
    param(
        [Parameter(Mandatory = $true)]$Lista,
        [Parameter(Mandatory = $true)]$Definicion,
        [Parameter(Mandatory = $true)][hashtable]$Grupos,
        $GrupoPropietarios,
        $GrupoMiembros,
        $GrupoVisitantes,
        $UsuarioServicio
    )
    $nombre = [string]$Definicion.name
    $nombrePerfil = [string]$Definicion.permissionProfile
    $perfil = $script:Esquema.security.profiles.PSObject.Properties[$nombrePerfil].Value
    $unica = [bool](Get-PnPProperty -ClientObject $Lista -Property HasUniqueRoleAssignments)

    if (-not [bool]$perfil.breakInheritance) {
        if ($unica) {
            Write-Warning ('{0} tiene permisos únicos, pero el perfil {1} indica herencia. No se restablece automáticamente (Set-PnPList -Identity {0} -ResetRoleInheritance).' -f $nombre, $nombrePerfil)
        }
        else {
            Write-VUOk ('{0}: hereda los permisos del sitio (perfil {1}).' -f $nombre, $nombrePerfil)
        }
        return
    }

    if (-not $unica) {
        # Se copian las asignaciones para no perder el acceso de los propietarios durante el proceso.
        Set-PnPList -Identity $Lista -BreakRoleInheritance -CopyRoleAssignments -ErrorAction Stop | Out-Null
        $script:Resumen.PermisosAjustados++
        Write-VUCambio ('{0}: herencia rota (perfil {1}).' -f $nombre, $nombrePerfil)
    }
    else {
        Write-VUOk ('{0}: ya tiene permisos únicos (perfil {1}).' -f $nombre, $nombrePerfil)
    }

    # Grupos predeterminados del sitio: Propietarios conserva Control total; Miembros y Visitantes
    # no aparecen en la matriz de §3.6, así que no tienen acceso a estas listas.
    if ($null -ne $GrupoPropietarios) {
        Set-VURolGrupoLista -Lista $Lista -NombreLista $nombre -Grupo $GrupoPropietarios -RolDeseado (Get-VUNombreRol -Rol 'FullControl')
    }
    foreach ($grupoPredeterminado in @($GrupoMiembros, $GrupoVisitantes)) {
        if ($null -ne $grupoPredeterminado) {
            Set-VURolGrupoLista -Lista $Lista -NombreLista $nombre -Grupo $grupoPredeterminado -RolDeseado ''
        }
    }

    foreach ($asignacion in @($perfil.roles)) {
        $grupo = $Grupos[[string]$asignacion.group]
        if ($null -eq $grupo) { throw ('El perfil {0} usa el grupo "{1}", que no está en security.groups.' -f $nombrePerfil, $asignacion.group) }
        $rol = ''
        if ($null -ne $asignacion.role) { $rol = Get-VUNombreRol -Rol ([string]$asignacion.role) }
        Set-VURolGrupoLista -Lista $Lista -NombreLista $nombre -Grupo $grupo -RolDeseado $rol
    }

    if ($null -ne $UsuarioServicio) {
        $rolServicio = Get-VUNombreRol -Rol ([string]$script:Esquema.security.serviceAccountRole)
        $actuales = @(Get-VURolesPrincipal -Protegible $Lista -PrincipalId $UsuarioServicio.Id)
        if ($actuales -notcontains $rolServicio) {
            Set-PnPListPermission -Identity $Lista -User $CuentaServicio -AddRole $rolServicio -ErrorAction Stop | Out-Null
            $script:Resumen.PermisosAjustados++
            Write-VUCambio ('{0}: cuenta de servicio = {1}.' -f $nombre, $rolServicio)
        }
        else {
            Write-VUOk ('{0}: la cuenta de servicio ya tiene {1}.' -f $nombre, $rolServicio)
        }
    }
}

#endregion

#region Programa principal

try {
    if ([string]::IsNullOrWhiteSpace($SchemaPath)) {
        $SchemaPath = Join-Path -Path $PSScriptRoot -ChildPath 'schema/listas.json'
    }

    Write-VUPaso ('Leyendo el esquema {0}' -f $SchemaPath)
    if (-not (Test-Path -LiteralPath $SchemaPath)) { throw ('No existe el archivo de esquema "{0}".' -f $SchemaPath) }
    $script:Esquema = Get-Content -LiteralPath $SchemaPath -Raw -Encoding UTF8 | ConvertFrom-Json
    Test-VUEsquema -Esquema $script:Esquema
    $definiciones = @($script:Esquema.lists)
    Write-VUOk ('Esquema válido: {0} listas/bibliotecas.' -f $definiciones.Count)

    if ($CreateSite) { Initialize-VUSitio }

    Write-VUPaso ('Conectando al sitio {0}' -f $SiteUrl)
    Connect-VUSitio -Url $SiteUrl
    $web = Get-PnPWeb -ErrorAction Stop
    Write-VUOk ('Conectado a "{0}" ({1}).' -f $web.Title, $web.Url)

    Write-VUPaso 'Paso 1. Listas y biblioteca'
    $listasPorNombre = @{}
    foreach ($definicion in $definiciones) {
        $listasPorNombre[[string]$definicion.name] = Initialize-VULista -Definicion $definicion
    }

    Write-VUPaso 'Paso 2. Columnas, índices, relaciones y validaciones'
    foreach ($definicion in $definiciones) {
        $nombre = [string]$definicion.name
        $lista = $listasPorNombre[$nombre]
        Write-VUInfo ('-- {0}' -f $nombre)
        $campos = Get-VUCamposLista -Lista $lista
        foreach ($columna in @($definicion.columns)) {
            $etiqueta = '{0}.{1}' -f $nombre, $columna.internalName
            $campo = Initialize-VUCampo -Lista $lista -NombreLista $nombre -Columna $columna -Campos $campos -ListasPorNombre $listasPorNombre
            if ([string]$columna.type -eq 'Lookup') {
                $campo = Set-VURelacion -Lista $lista -Campo $campo -Comportamiento ([string](Get-VUProp $columna 'relationshipBehavior' 'None')) -Etiqueta $etiqueta
            }
            if ([bool](Get-VUProp $columna 'indexed' $false)) {
                $campo = Set-VUIndice -Lista $lista -Campo $campo -Etiqueta $etiqueta
            }
            $campo = Set-VUValidacion -Lista $lista -Campo $campo -Columna $columna -Etiqueta $etiqueta
            $campos[[string]$columna.internalName] = $campo
        }
    }

    Write-VUPaso 'Paso 3. Vistas predeterminadas'
    foreach ($definicion in $definiciones) {
        Set-VUVistaPredeterminada -Lista $listasPorNombre[[string]$definicion.name] -Definicion $definicion
    }

    if ($OmitirPermisos) {
        Write-VUPaso 'Pasos 4 y 5. Grupos y permisos: omitidos (-OmitirPermisos).'
    }
    else {
        Write-VUPaso 'Paso 4. Grupos de SharePoint y permisos del sitio (§3.6)'
        $grupos = @{}
        foreach ($definicionGrupo in @($script:Esquema.security.groups)) {
            $grupos[[string]$definicionGrupo.name] = Initialize-VUGrupo -DefinicionGrupo $definicionGrupo -Web $web
        }
        if (-not [string]::IsNullOrWhiteSpace($Owner)) {
            Add-VUMiembroGrupo -Grupo 'VU Administradores' -Correo $Owner
        }

        $usuarioServicio = $null
        if (-not [string]::IsNullOrWhiteSpace($CuentaServicio)) {
            try {
                $usuarioServicio = New-PnPUser -LoginName $CuentaServicio -ErrorAction Stop
            }
            catch {
                throw ('No se pudo resolver la cuenta de servicio "{0}": {1}' -f $CuentaServicio, $_.Exception.Message)
            }
            $rolServicio = Get-VUNombreRol -Rol ([string]$script:Esquema.security.serviceAccountRole)
            $actuales = @(Get-VURolesPrincipal -Protegible $web -PrincipalId $usuarioServicio.Id)
            if ($actuales -notcontains $rolServicio) {
                Set-PnPWebPermission -User $CuentaServicio -AddRole $rolServicio -ErrorAction Stop | Out-Null
                $script:Resumen.PermisosAjustados++
                Write-VUCambio ('Sitio: cuenta de servicio {0} = {1}.' -f $CuentaServicio, $rolServicio)
            }
            else {
                Write-VUOk ('Sitio: la cuenta de servicio ya tiene {0}.' -f $rolServicio)
            }
        }
        else {
            Write-Warning 'No se indicó -CuentaServicio: la cuenta de los flujos no recibirá "Editar" (§3.6). Vuelve a ejecutar con -CuentaServicio cuando exista.'
        }

        $propietarios = Get-VUGrupoAsociado -Tipo 'Owner'
        $miembros = Get-VUGrupoAsociado -Tipo 'Member'
        $visitantes = Get-VUGrupoAsociado -Tipo 'Visitor'

        Write-VUPaso 'Paso 5. Permisos por lista (§3.6)'
        foreach ($definicion in $definiciones) {
            Set-VUPermisosLista -Lista $listasPorNombre[[string]$definicion.name] -Definicion $definicion -Grupos $grupos `
                -GrupoPropietarios $propietarios -GrupoMiembros $miembros -GrupoVisitantes $visitantes -UsuarioServicio $usuarioServicio
        }
    }

    Write-VUPaso 'Resumen'
    foreach ($entrada in $script:Resumen.GetEnumerator()) {
        Write-VUInfo ('{0,-24} {1}' -f $entrada.Key, $entrada.Value)
    }
    Write-Host ''
    Write-Host 'Aprovisionamiento terminado. Siguiente paso: ./Seed-VerificacionUso.ps1' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host ('ERROR: {0}' -f $_.Exception.Message) -ForegroundColor Red
    if ($null -ne $_.InvocationInfo) { Write-Host $_.InvocationInfo.PositionMessage -ForegroundColor DarkRed }
    Write-Host 'El script es idempotente: corrige la causa y vuelve a ejecutarlo.' -ForegroundColor Red
    exit 1
}

#endregion
