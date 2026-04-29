param(
    [switch]$Android,
    [switch]$Web,
    [switch]$Lan,
    [switch]$Tunnel,
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Stop-ExistingExpoProcesses {
    param(
        [string]$ProjectRoot,
        [switch]$IncludeWrappers
    )

    $excludedProcessIds = New-Object System.Collections.Generic.HashSet[int]
    $cursor = Get-CimInstance Win32_Process -Filter "ProcessId = $PID" -ErrorAction SilentlyContinue
    while ($cursor) {
        $null = $excludedProcessIds.Add([int]$cursor.ProcessId)
        if (-not $cursor.ParentProcessId -or $cursor.ParentProcessId -le 0) { break }
        $cursor = Get-CimInstance Win32_Process -Filter "ProcessId = $($cursor.ParentProcessId)" -ErrorAction SilentlyContinue
    }

    $nodeTargets = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -eq 'node.exe' -and
            (
                ($_.CommandLine -like "*$ProjectRoot*" -and $_.CommandLine -like '*expo*start*') -or
                $_.CommandLine -like '*npx-cli.js"* expo start*' -or
                ($IncludeWrappers -and (
                    $_.CommandLine -like '*npm-cli.js"* run qr*' -or
                    $_.CommandLine -like '*npm-cli.js"* run start*' -or
                    $_.CommandLine -like '*npm-cli.js"* run android*' -or
                    $_.CommandLine -like '*npm-cli.js"* run web*'
                ))
            )
        }

    $shellTargets = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            (
                $_.Name -eq 'powershell.exe' -or
                $_.Name -eq 'pwsh.exe' -or
                $_.Name -eq 'cmd.exe'
            ) -and
            (
                $_.CommandLine -like '*start-expo.ps1*' -or
                ($IncludeWrappers -and (
                    $_.CommandLine -like '*npm run qr*' -or
                    $_.CommandLine -like '*npm run start*' -or
                    $_.CommandLine -like '*npm run android*' -or
                    $_.CommandLine -like '*npm run web*'
                ))
            )
        }

    $targets = @($nodeTargets) + @($shellTargets)

    foreach ($target in $targets | Sort-Object ProcessId -Unique | Where-Object { -not $excludedProcessIds.Contains([int]$_.ProcessId) }) {
        Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 150
        if (-not (Get-Process -Id $target.ProcessId -ErrorAction SilentlyContinue)) {
            Write-Host "Detenido proceso Expo anterior: $($target.ProcessId)" -ForegroundColor Yellow
        } else {
            Write-Warning "No se pudo detener el proceso $($target.ProcessId)."
        }
    }
}

function Invoke-ExpoStart {
    param([string[]]$ExpoArgs)

    Write-Host "Ejecutando: npx $($ExpoArgs -join ' ')" -ForegroundColor Cyan
    & npx.cmd @ExpoArgs
    return $LASTEXITCODE
}

function Add-ToPathIfMissing {
    param([string]$PathToAdd)

    if (-not $PathToAdd -or -not (Test-Path $PathToAdd)) { return }
    $current = ($env:Path -split ';') | Where-Object { $_ }
    if ($current -notcontains $PathToAdd) {
        $env:Path = "$PathToAdd;$env:Path"
    }
}

function Resolve-AndroidSdkRoot {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
        'C:\Program Files (x86)\Android\android-sdk',
        'C:\Android\Sdk'
    ) | Where-Object { $_ -and (Test-Path $_) }

    return $candidates | Select-Object -First 1
}

function Get-AdbPath([string]$sdkRoot) {
    $candidate = Join-Path $sdkRoot 'platform-tools\adb.exe'
    if (Test-Path $candidate) { return $candidate }
    return $null
}

function Get-EmulatorPath([string]$sdkRoot) {
    $candidate = Join-Path $sdkRoot 'emulator\emulator.exe'
    if (Test-Path $candidate) { return $candidate }
    return $null
}

function Get-ConnectedDevices([string]$adbPath) {
    if (-not $adbPath) { return @() }
    $output = & $adbPath devices 2>$null
    return $output | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' }
}

function Get-FreeExpoPort {
    param([int]$StartPort = 8081)

    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    $usedPorts = $listeners | ForEach-Object { $_.Port }
    $port = $StartPort
    while ($usedPorts -contains $port) {
        $port++
    }
    return $port
}

function Configure-AndroidPortForwarding {
    param(
        [string]$AdbPath,
        [int]$Port
    )

    if (-not $AdbPath -or -not (Test-Path $AdbPath)) { return }

    try {
        & $AdbPath reverse "tcp:$Port" "tcp:$Port" *> $null
    } catch {
        Write-Warning "No se pudo configurar adb reverse para el puerto $Port."
    }
}

function Ensure-AndroidDevice {
    param(
        [string]$SdkRoot,
        [string]$AdbPath,
        [string]$DefaultAvd = 'MercadoLocal_API_35'
    )

    $devices = Get-ConnectedDevices $AdbPath
    if ($devices.Count -gt 0) {
        Write-Host "Android detectado:" -ForegroundColor Green
        $devices | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
        return
    }

    $emulatorPath = Get-EmulatorPath $SdkRoot
    if (-not $emulatorPath) {
        Write-Warning 'No se encontró emulator.exe en el SDK. Puedes usar Expo Go o instalar el paquete emulator.'
        return
    }

    $avdHome = Join-Path $env:USERPROFILE '.android\avd'
    $avdConfig = Join-Path $avdHome "$DefaultAvd.ini"
    if (-not (Test-Path $avdConfig)) {
        Write-Warning "No existe el AVD $DefaultAvd."
        return
    }

    Write-Host "Iniciando AVD $DefaultAvd..." -ForegroundColor Yellow
    $alreadyRunning = Get-Process emulator -ErrorAction SilentlyContinue
    if (-not $alreadyRunning) {
        Start-Process -FilePath $emulatorPath -ArgumentList "-avd $DefaultAvd" | Out-Null
    }

    for ($i = 0; $i -lt 24; $i++) {
        Start-Sleep -Seconds 5
        $devices = Get-ConnectedDevices $AdbPath
        if ($devices.Count -gt 0) {
            Write-Host "Dispositivo Android listo:" -ForegroundColor Green
            $devices | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
            return
        }
    }

    Write-Warning 'El emulador arrancó, pero adb todavía no reporta un dispositivo listo.'
}

if ($Stop) {
    Stop-ExistingExpoProcesses -ProjectRoot $projectRoot -IncludeWrappers
    exit 0
}

Stop-ExistingExpoProcesses -ProjectRoot $projectRoot

$sdkRoot = Resolve-AndroidSdkRoot
if (-not $sdkRoot) {
    throw 'No se encontró Android SDK. Instálalo o revisa la ruta en LOCALAPPDATA\Android\Sdk.'
}

$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot
Add-ToPathIfMissing (Join-Path $sdkRoot 'platform-tools')
Add-ToPathIfMissing (Join-Path $sdkRoot 'emulator')
Add-ToPathIfMissing (Join-Path $sdkRoot 'cmdline-tools\12.0\bin')

$adbPath = Get-AdbPath $sdkRoot
$port = Get-FreeExpoPort
if ($Android) {
    Ensure-AndroidDevice -SdkRoot $sdkRoot -AdbPath $adbPath
    Configure-AndroidPortForwarding -AdbPath $adbPath -Port $port
}

$args = @('expo', 'start', '--port', [string]$port)
if ($Android) {
    $args += '--host'
    $args += 'lan'
    $args += '--android'
} elseif ($Tunnel) {
    $args += '--tunnel'
} elseif ($Lan) {
    $args += '--host'
    $args += 'lan'
} elseif ($Web) {
    $args += '--web'
}

Write-Host "Usando Android SDK en: $sdkRoot" -ForegroundColor Cyan
Write-Host "Puerto Expo: $port" -ForegroundColor Cyan
$exitCode = Invoke-ExpoStart -ExpoArgs $args

if ($Tunnel -and $exitCode -ne 0) {
    Write-Warning 'El modo tunnel falló. Voy a reintentar con host LAN para que puedas escanear el QR en la misma red Wi-Fi.'
    $fallbackArgs = @('expo', 'start', '--port', [string]$port, '--host', 'lan')
    $exitCode = Invoke-ExpoStart -ExpoArgs $fallbackArgs
}

exit $exitCode
