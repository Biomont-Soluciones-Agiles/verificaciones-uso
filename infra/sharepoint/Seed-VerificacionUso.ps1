#Requires -Version 7.2
#Requires -Modules PnP.PowerShell

<#
.SYNOPSIS
    Carga los datos semilla de "Verificación de uso" (áreas, criterios, preguntas con opciones y
    soluciones con documentos) de forma idempotente.

.DESCRIPTION
    Lee los archivos seed/*.json y crea en SharePoint solo los elementos que faltan:
      - VU_Areas            clave: Title (AreaPadre se resuelve por Title en una segunda pasada)
      - VU_Criterios        clave: Title
      - VU_Preguntas        clave: Title (Criterio por Title)
      - VU_OpcionesRespuesta clave: Title + Pregunta
      - VU_Soluciones       clave: Title (Proceso por Title)
      - VU_DocumentosSolucion clave: Title + Solucion
    Los elementos que ya existen no se modifican (solo se completa AreaPadre si está vacía).
    Requiere haber ejecutado antes Provision-VerificacionUso.ps1.

    Campos de persona y enlaces: el JSON no contiene correos ni URL reales. Si responsableEmail está
    vacío se usa -ResponsablePorDefecto y, si tampoco se indica, la columna se omite (con una
    advertencia). Lo mismo ocurre con Enlace de los documentos.

.PARAMETER SiteUrl
    URL del sitio. Predeterminado: https://biomont.sharepoint.com/sites/VerificacionUso

.PARAMETER ClientId
    Id. de la aplicación de Entra ID para Connect-PnPOnline -Interactive. Obligatorio.

.PARAMETER SeedPath
    Carpeta con los JSON de semilla. Predeterminado: <carpeta del script>/seed

.PARAMETER ResponsablePorDefecto
    Correo que se asigna como Responsable de las soluciones cuyo responsableEmail está vacío.

.EXAMPLE
    ./Seed-VerificacionUso.ps1 -ClientId $appId

.EXAMPLE
    ./Seed-VerificacionUso.ps1 -ClientId $appId -ResponsablePorDefecto responsable@contoso.com
#>
[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string]$SiteUrl = 'https://biomont.sharepoint.com/sites/VerificacionUso',

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ClientId,

    [string]$SeedPath,

    [string]$ResponsablePorDefecto
)

$ErrorActionPreference = 'Stop'

$script:SesgoMinutos = $null
$script:Resumen = [ordered]@{
    Creados      = 0
    Existentes   = 0
    Actualizados = 0
    Advertencias = 0
}

#region Utilidades

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

function Write-VUAviso {
    param([Parameter(Mandatory = $true)][string]$Mensaje)
    $script:Resumen.Advertencias++
    Write-Warning $Mensaje
}

function Get-VUProp {
    param($Objeto, [Parameter(Mandatory = $true)][string]$Nombre, $PorDefecto = $null)
    if ($null -eq $Objeto) { return $PorDefecto }
    $propiedad = $Objeto.PSObject.Properties[$Nombre]
    if ($null -eq $propiedad -or $null -eq $propiedad.Value) { return $PorDefecto }
    return $propiedad.Value
}

function Test-VUVacio {
    param([AllowNull()]$Valor)
    if ($null -eq $Valor) { return $true }
    if ($Valor -is [string] -and [string]::IsNullOrWhiteSpace($Valor)) { return $true }
    return $false
}

function Add-VUValor {
    # Agrega el valor al hashtable solo si no está vacío.
    param([Parameter(Mandatory = $true)][hashtable]$Valores, [Parameter(Mandatory = $true)][string]$Campo, [AllowNull()]$Valor)
    if (-not (Test-VUVacio $Valor)) { $Valores[$Campo] = $Valor }
}

function Read-VUSemilla {
    param([Parameter(Mandatory = $true)][string]$Archivo)
    $ruta = Join-Path -Path $SeedPath -ChildPath $Archivo
    if (-not (Test-Path -LiteralPath $ruta)) { throw ('No existe el archivo de semilla "{0}".' -f $ruta) }
    try {
        return (Get-Content -LiteralPath $ruta -Raw -Encoding UTF8 | ConvertFrom-Json)
    }
    catch {
        throw ('El archivo "{0}" no es un JSON válido: {1}' -f $ruta, $_.Exception.Message)
    }
}

function Get-VUListaSemilla {
    param([Parameter(Mandatory = $true)][string]$Nombre)
    try {
        $lista = Get-PnPList -Identity ('Lists/{0}' -f $Nombre) -ErrorAction Stop
    }
    catch {
        $lista = $null
    }
    if ($null -eq $lista) { throw ('No existe la lista {0}. Ejecuta antes Provision-VerificacionUso.ps1.' -f $Nombre) }
    return $lista
}

function Get-VUElementos {
    param([Parameter(Mandatory = $true)]$Lista, [Parameter(Mandatory = $true)][string[]]$Campos)
    return @(Get-PnPListItem -List $Lista -PageSize 500 -Fields $Campos -ErrorAction Stop)
}

function Find-VUElemento {
    # Busca por Title y, opcionalmente, por el ID de una columna de búsqueda (clave compuesta).
    param(
        [AllowNull()][object[]]$Elementos,
        [Parameter(Mandatory = $true)][string]$Titulo,
        [string]$CampoPadre,
        [int]$IdPadre = 0
    )
    foreach ($elemento in @($Elementos)) {
        if ([string]$elemento['Title'] -ne $Titulo) { continue }
        if (-not [string]::IsNullOrEmpty($CampoPadre)) {
            $valor = $elemento[$CampoPadre]
            if ($null -eq $valor -or [int]$valor.LookupId -ne $IdPadre) { continue }
        }
        return $elemento
    }
    return $null
}

function Get-VUMapaIds {
    # Title -> ID de todos los elementos de una lista.
    param([Parameter(Mandatory = $true)]$Lista)
    $mapa = @{}
    foreach ($elemento in @(Get-VUElementos -Lista $Lista -Campos @('Title'))) {
        $titulo = [string]$elemento['Title']
        if ($mapa.ContainsKey($titulo)) {
            Write-VUAviso ('Hay más de un elemento con Title "{0}" en {1}; se usa el ID {2}.' -f $titulo, $Lista.Title, $mapa[$titulo])
            continue
        }
        $mapa[$titulo] = [int]$elemento.Id
    }
    return $mapa
}

function Resolve-VUId {
    param([Parameter(Mandatory = $true)][hashtable]$Mapa, [Parameter(Mandatory = $true)][string]$Titulo, [Parameter(Mandatory = $true)][string]$Lista)
    if (-not $Mapa.ContainsKey($Titulo)) { throw ('No se encontró "{0}" en {1} para resolver la búsqueda.' -f $Titulo, $Lista) }
    return [int]$Mapa[$Titulo]
}

function New-VUElemento {
    param([Parameter(Mandatory = $true)]$Lista, [Parameter(Mandatory = $true)][hashtable]$Valores, [Parameter(Mandatory = $true)][string]$Etiqueta)
    try {
        $elemento = Add-PnPListItem -List $Lista -Values $Valores -ErrorAction Stop
    }
    catch {
        throw ('No se pudo crear {0}: {1}' -f $Etiqueta, $_.Exception.Message)
    }
    $script:Resumen.Creados++
    Write-VUCambio ('{0} (ID {1})' -f $Etiqueta, $elemento.Id)
    return $elemento
}

function ConvertTo-VUFechaSitio {
    # Convierte 'yyyy-MM-dd' (medianoche en la zona horaria del sitio) a UTC para columnas de solo fecha.
    param([Parameter(Mandatory = $true)][string]$Iso)
    $fecha = [datetime]::ParseExact($Iso, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
    if ($null -eq $script:SesgoMinutos) {
        try {
            $web = Get-PnPWeb -Includes RegionalSettings.TimeZone -ErrorAction Stop
            $informacion = Get-PnPProperty -ClientObject $web.RegionalSettings.TimeZone -Property Information -ErrorAction Stop
            # UTC = hora local + Bias (+ StandardBias). Se ignora el horario de verano: como mucho
            # desplaza una hora y la fecha no cambia.
            $script:SesgoMinutos = [int]$informacion.Bias + [int]$informacion.StandardBias
        }
        catch {
            Write-VUAviso ('No se pudo leer la zona horaria del sitio; las fechas se envían con la zona del equipo. {0}' -f $_.Exception.Message)
            $script:SesgoMinutos = [int]::MinValue
        }
    }
    if ($script:SesgoMinutos -eq [int]::MinValue) { return [datetime]::SpecifyKind($fecha, [System.DateTimeKind]::Local) }
    return [datetime]::SpecifyKind($fecha.AddMinutes($script:SesgoMinutos), [System.DateTimeKind]::Utc)
}

#endregion

#region Programa principal

try {
    if ([string]::IsNullOrWhiteSpace($SeedPath)) { $SeedPath = Join-Path -Path $PSScriptRoot -ChildPath 'seed' }

    Write-VUPaso ('Leyendo la semilla de {0}' -f $SeedPath)
    $semillaAreas = Read-VUSemilla -Archivo 'areas.json'
    $semillaCriterios = Read-VUSemilla -Archivo 'criterios.json'
    $semillaPreguntas = Read-VUSemilla -Archivo 'preguntas.json'
    $semillaSoluciones = Read-VUSemilla -Archivo 'soluciones.json'
    Write-VUOk 'areas.json, criterios.json, preguntas.json y soluciones.json leídos.'

    Write-VUPaso ('Conectando al sitio {0}' -f $SiteUrl)
    try {
        Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId -ErrorAction Stop
    }
    catch {
        throw ('No se pudo conectar a "{0}": {1}' -f $SiteUrl, $_.Exception.Message)
    }
    $listaAreas = Get-VUListaSemilla -Nombre 'VU_Areas'
    $listaCriterios = Get-VUListaSemilla -Nombre 'VU_Criterios'
    $listaPreguntas = Get-VUListaSemilla -Nombre 'VU_Preguntas'
    $listaOpciones = Get-VUListaSemilla -Nombre 'VU_OpcionesRespuesta'
    $listaSoluciones = Get-VUListaSemilla -Nombre 'VU_Soluciones'
    $listaDocumentos = Get-VUListaSemilla -Nombre 'VU_DocumentosSolucion'
    Write-VUOk 'Listas encontradas.'

    # 1. Áreas (primera pasada sin AreaPadre).
    Write-VUPaso 'VU_Areas'
    $existentes = @(Get-VUElementos -Lista $listaAreas -Campos @('Title', 'AreaPadre'))
    foreach ($area in @($semillaAreas.elementos)) {
        $titulo = [string]$area.Title
        if ($null -ne (Find-VUElemento -Elementos $existentes -Titulo $titulo)) {
            $script:Resumen.Existentes++
            Write-VUOk ('{0} ya existe.' -f $titulo)
            continue
        }
        $valores = @{ Title = $titulo }
        Add-VUValor $valores 'TipoArea' ([string](Get-VUProp $area 'TipoArea'))
        $valores['Activo'] = [bool](Get-VUProp $area 'Activo' $true)
        $null = New-VUElemento -Lista $listaAreas -Valores $valores -Etiqueta ('Área "{0}"' -f $titulo)
    }

    # Segunda pasada: AreaPadre por Title (solo si está vacía).
    $idsAreas = Get-VUMapaIds -Lista $listaAreas
    $existentes = @(Get-VUElementos -Lista $listaAreas -Campos @('Title', 'AreaPadre'))
    foreach ($area in @($semillaAreas.elementos)) {
        $padre = [string](Get-VUProp $area 'AreaPadre' '')
        if ([string]::IsNullOrWhiteSpace($padre)) { continue }
        $titulo = [string]$area.Title
        $idPadre = Resolve-VUId -Mapa $idsAreas -Titulo $padre -Lista 'VU_Areas'
        $elemento = Find-VUElemento -Elementos $existentes -Titulo $titulo
        $actual = $elemento['AreaPadre']
        if ($null -eq $actual) {
            Set-PnPListItem -List $listaAreas -Identity $elemento.Id -Values @{ AreaPadre = $idPadre } -ErrorAction Stop | Out-Null
            $script:Resumen.Actualizados++
            Write-VUCambio ('{0}: Área padre = {1}.' -f $titulo, $padre)
        }
        elseif ([int]$actual.LookupId -ne $idPadre) {
            Write-VUAviso ('{0} ya tiene otra área padre ("{1}"); no se modifica.' -f $titulo, $actual.LookupValue)
        }
        else {
            Write-VUOk ('{0}: Área padre correcta.' -f $titulo)
        }
    }

    # 2. Criterios.
    Write-VUPaso 'VU_Criterios'
    $existentes = @(Get-VUElementos -Lista $listaCriterios -Campos @('Title'))
    $sumaPesos = 0
    foreach ($criterio in @($semillaCriterios.elementos)) {
        $titulo = [string]$criterio.Title
        if ([bool](Get-VUProp $criterio 'Activo' $true)) { $sumaPesos += [double]$criterio.Peso }
        if ($null -ne (Find-VUElemento -Elementos $existentes -Titulo $titulo)) {
            $script:Resumen.Existentes++
            Write-VUOk ('{0} ya existe.' -f $titulo)
            continue
        }
        $valores = @{
            Title  = $titulo
            Peso   = [double]$criterio.Peso
            Orden  = [double]$criterio.Orden
            Activo = [bool](Get-VUProp $criterio 'Activo' $true)
        }
        $null = New-VUElemento -Lista $listaCriterios -Valores $valores -Etiqueta ('Criterio "{0}"' -f $titulo)
    }
    if ($sumaPesos -ne 100) { Write-VUAviso ('Los pesos de los criterios activos de la semilla suman {0}, no 100.' -f $sumaPesos) }

    # 3. Preguntas y opciones.
    Write-VUPaso 'VU_Preguntas y VU_OpcionesRespuesta'
    $idsCriterios = Get-VUMapaIds -Lista $listaCriterios
    $existentes = @(Get-VUElementos -Lista $listaPreguntas -Campos @('Title'))
    $opcionesExistentes = @(Get-VUElementos -Lista $listaOpciones -Campos @('Title', 'Pregunta'))
    foreach ($pregunta in @($semillaPreguntas.elementos)) {
        $titulo = [string]$pregunta.Title
        $elemento = Find-VUElemento -Elementos $existentes -Titulo $titulo
        if ($null -ne $elemento) {
            $script:Resumen.Existentes++
            Write-VUOk ('Pregunta "{0}" ya existe.' -f $titulo)
            $idPregunta = [int]$elemento.Id
        }
        else {
            $valores = @{
                Title         = $titulo
                Criterio      = Resolve-VUId -Mapa $idsCriterios -Titulo ([string]$pregunta.Criterio) -Lista 'VU_Criterios'
                TipoRespuesta = [string]$pregunta.TipoRespuesta
                Orden         = [double]$pregunta.Orden
                Activo        = [bool](Get-VUProp $pregunta 'Activo' $true)
            }
            $nuevo = New-VUElemento -Lista $listaPreguntas -Valores $valores -Etiqueta ('Pregunta "{0}"' -f $titulo)
            $idPregunta = [int]$nuevo.Id
        }

        foreach ($opcion in @(Get-VUProp $pregunta 'opciones' @())) {
            $tituloOpcion = [string]$opcion.Title
            if ($null -ne (Find-VUElemento -Elementos $opcionesExistentes -Titulo $tituloOpcion -CampoPadre 'Pregunta' -IdPadre $idPregunta)) {
                $script:Resumen.Existentes++
                Write-VUOk ('  Opción "{0}" ya existe.' -f $tituloOpcion)
                continue
            }
            $valores = @{
                Title           = $tituloOpcion
                Pregunta        = $idPregunta
                PuntajeSugerido = [double]$opcion.PuntajeSugerido
                Orden           = [double]$opcion.Orden
            }
            $null = New-VUElemento -Lista $listaOpciones -Valores $valores -Etiqueta ('  Opción "{0}"' -f $tituloOpcion)
        }
    }

    # 4. Soluciones y documentos.
    Write-VUPaso 'VU_Soluciones y VU_DocumentosSolucion'
    $idsAreas = Get-VUMapaIds -Lista $listaAreas
    $existentes = @(Get-VUElementos -Lista $listaSoluciones -Campos @('Title'))
    $documentosExistentes = @(Get-VUElementos -Lista $listaDocumentos -Campos @('Title', 'Solucion'))
    foreach ($solucion in @($semillaSoluciones.elementos)) {
        $titulo = [string]$solucion.Title
        $elemento = Find-VUElemento -Elementos $existentes -Titulo $titulo
        if ($null -ne $elemento) {
            $script:Resumen.Existentes++
            Write-VUOk ('Solución "{0}" ya existe.' -f $titulo)
            $idSolucion = [int]$elemento.Id
        }
        else {
            $valores = @{
                Title             = $titulo
                Proceso           = Resolve-VUId -Mapa $idsAreas -Titulo ([string]$solucion.Proceso) -Lista 'VU_Areas'
                PeriodicidadMeses = [double](Get-VUProp $solucion 'PeriodicidadMeses' 6)
                EstadoVU          = [string](Get-VUProp $solucion 'EstadoVU' 'Pendiente')
            }
            Add-VUValor $valores 'Descripcion' (Get-VUProp $solucion 'Descripcion')
            Add-VUValor $valores 'TipoSolucion' (Get-VUProp $solucion 'TipoSolucion')
            $usuarios = Get-VUProp $solucion 'UsuariosObjetivo'
            if ($null -ne $usuarios) { $valores['UsuariosObjetivo'] = [double]$usuarios }
            foreach ($campoFecha in @('FechaActualizacion', 'ProximaVU')) {
                $fecha = [string](Get-VUProp $solucion $campoFecha '')
                if (-not [string]::IsNullOrWhiteSpace($fecha)) { $valores[$campoFecha] = ConvertTo-VUFechaSitio -Iso $fecha }
            }

            $correo = [string](Get-VUProp $solucion 'responsableEmail' '')
            if ([string]::IsNullOrWhiteSpace($correo)) { $correo = [string]$ResponsablePorDefecto }
            if ([string]::IsNullOrWhiteSpace($correo)) {
                Write-VUAviso ('Solución "{0}": sin responsableEmail ni -ResponsablePorDefecto; Responsable (obligatoria) queda vacía. Responsable en el prototipo: {1}.' -f $titulo, (Get-VUProp $solucion 'responsableNombre' '—'))
            }
            else {
                $valores['Responsable'] = $correo
            }

            $nuevo = New-VUElemento -Lista $listaSoluciones -Valores $valores -Etiqueta ('Solución "{0}"' -f $titulo)
            $idSolucion = [int]$nuevo.Id
        }

        foreach ($documento in @(Get-VUProp $solucion 'documentos' @())) {
            $tituloDocumento = [string]$documento.Title
            if ($null -ne (Find-VUElemento -Elementos $documentosExistentes -Titulo $tituloDocumento -CampoPadre 'Solucion' -IdPadre $idSolucion)) {
                $script:Resumen.Existentes++
                Write-VUOk ('  Documento "{0}" ya existe.' -f $tituloDocumento)
                continue
            }
            $valores = @{
                Title         = $tituloDocumento
                Solucion      = $idSolucion
                TipoDocumento = [string]$documento.TipoDocumento
                Vigente       = [bool](Get-VUProp $documento 'Vigente' $true)
            }
            Add-VUValor $valores 'Formato' (Get-VUProp $documento 'Formato')
            Add-VUValor $valores 'Version' (Get-VUProp $documento 'Version')
            $enlace = [string](Get-VUProp $documento 'Enlace' '')
            if ([string]::IsNullOrWhiteSpace($enlace)) {
                Write-VUAviso ('Documento "{0}" de "{1}": sin Enlace en la semilla; la columna (obligatoria) queda vacía.' -f $tituloDocumento, $titulo)
            }
            else {
                # Formato de PnP para hipervínculos: "URL, descripción".
                $valores['Enlace'] = '{0}, {1}' -f $enlace, $tituloDocumento
            }
            $null = New-VUElemento -Lista $listaDocumentos -Valores $valores -Etiqueta ('  Documento "{0}"' -f $tituloDocumento)
        }
    }

    Write-VUPaso 'Resumen'
    foreach ($entrada in $script:Resumen.GetEnumerator()) {
        Write-Host ('    {0,-14} {1}' -f $entrada.Key, $entrada.Value)
    }
    Write-Host ''
    Write-Host 'Semilla cargada.' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host ('ERROR: {0}' -f $_.Exception.Message) -ForegroundColor Red
    if ($null -ne $_.InvocationInfo) { Write-Host $_.InvocationInfo.PositionMessage -ForegroundColor DarkRed }
    Write-Host 'El script es idempotente: corrige la causa y vuelve a ejecutarlo.' -ForegroundColor Red
    exit 1
}

#endregion
