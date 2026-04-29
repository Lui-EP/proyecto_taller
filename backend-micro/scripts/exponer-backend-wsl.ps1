$ErrorActionPreference = 'Stop'

function Get-LocalLanIp {
    $candidate = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -match '^192\.168\.' -and
            $_.IPAddress -ne '127.0.0.1' -and
            $_.PrefixOrigin -ne 'WellKnown'
        } |
        Sort-Object InterfaceMetric |
        Select-Object -First 1

    if (-not $candidate) {
        throw 'No pude detectar una IP local tipo 192.168.x.x. Conectate a tu Wi-Fi o pasa la IP manualmente.'
    }

    return $candidate.IPAddress
}

function Ensure-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $isAdmin) {
        throw 'Este script necesita PowerShell como Administrador para crear portproxy y reglas de firewall.'
    }
}

function Set-PortProxy {
    param(
        [string]$ListenAddress,
        [int]$Port
    )

    & netsh interface portproxy delete v4tov4 listenaddress=$ListenAddress listenport=$Port | Out-Null
    & netsh interface portproxy add v4tov4 listenaddress=$ListenAddress listenport=$Port connectaddress=127.0.0.1 connectport=$Port
}

function Ensure-FirewallRule {
    param(
        [string]$RuleName,
        [int]$Port
    )

    $existing = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
    if ($existing) {
        Remove-NetFirewallRule -DisplayName $RuleName | Out-Null
    }

    New-NetFirewallRule `
        -DisplayName $RuleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $Port | Out-Null
}

Ensure-Admin

$lanIp = Get-LocalLanIp

Write-Host "Usando IP local: $lanIp" -ForegroundColor Cyan

Set-PortProxy -ListenAddress $lanIp -Port 8001
Set-PortProxy -ListenAddress $lanIp -Port 8002

Ensure-FirewallRule -RuleName 'MercadoLocal clientes 8001' -Port 8001
Ensure-FirewallRule -RuleName 'MercadoLocal pedidos 8002' -Port 8002

Write-Host ''
Write-Host 'Listo. Windows ya publica los microservicios de WSL hacia tu red local.' -ForegroundColor Green
Write-Host ''
Write-Host 'Pruebas recomendadas:' -ForegroundColor Yellow
Write-Host "1. http://$lanIp`:8001/health"
Write-Host "2. http://$lanIp`:8002/health"
Write-Host ''
Write-Host 'Si reinicias tu Wi-Fi y cambia la IP 192.168.x.x, vuelve a correr este script.' -ForegroundColor DarkYellow
