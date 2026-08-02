<#
.SYNOPSIS
  Setup local domain for Open Arsad on Windows.
.DESCRIPTION
  1. Sets a static IPv4 address so the LAN hostname stays stable.
  2. Optionally updates the local machine's hosts file so "open-meteo.local"
     resolves to the static IP from this machine itself.
.NOTES
  Run PowerShell as Administrator.
#>

param(
  [string]$InterfaceName = "Ethernet",
  [string]$StaticIP = "172.25.80.10",
  [string]$Gateway = "172.25.80.1",
  [string]$PrefixLength = 16,
  [string]$Dns = "172.25.80.1",
  [switch]$UpdateHosts
)

function Test-Admin {
  $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
  Write-Host "Please run PowerShell as Administrator." -ForegroundColor Red
  exit 1
}

Write-Host "`n=== Open Arsad Local Domain Setup ===" -ForegroundColor Cyan
Write-Host "Interface   : $InterfaceName"
Write-Host "Static IP   : $StaticIP"
Write-Host "Gateway     : $Gateway"
Write-Host "Prefix      : $PrefixLength"
Write-Host "DNS         : $Dns`n"

$adapter = Get-NetAdapter -Name $InterfaceName -ErrorAction SilentlyContinue
if (-not $adapter) {
  $adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -ExpandProperty Name
  Write-Host "Available adapters: $adapters" -ForegroundColor Yellow
  $InterfaceName = Read-Host "Enter interface name"
  $adapter = Get-NetAdapter -Name $InterfaceName -ErrorAction SilentlyContinue
  if (-not $adapter) {
    Write-Host "Adapter not found." -ForegroundColor Red
    exit 1
  }
}

Write-Host "Setting static IP on $InterfaceName..." -ForegroundColor Yellow
New-NetIPAddress -InterfaceAlias $InterfaceName -IPAddress $StaticIP -PrefixLength $PrefixLength -DefaultGateway $Gateway -ErrorAction SilentlyContinue | Out-Null
Set-DnsClientServerAddress -InterfaceAlias $InterfaceName -ServerAddresses $Dns -ErrorAction SilentlyContinue | Out-Null

$ip = (Get-NetIPAddress -InterfaceAlias $InterfaceName -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
Write-Host "Current IP: $ip`n" -ForegroundColor Green

$localDomain = "open-meteo.local"
Write-Host "Local domain: http://$localDomain`:3000`n"

if ($UpdateHosts) {
  $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
  $entry = "$StaticIP`t$localDomain"
  $content = Get-Content $hostsPath -Raw
  if ($content -notmatch [regex]::Escape($localDomain)) {
    Add-Content -Path $hostsPath -Value "`n# Open Arsad local domain`n$entry"
    Write-Host "Added $entry to $hostsPath" -ForegroundColor Green
  } else {
    Write-Host "Hosts entry for $localDomain already exists." -ForegroundColor Yellow
  }
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host "Server command : node server.js"
Write-Host "Local URL      : http://$localDomain`:3000"
Write-Host "LAN URL        : http://$ip`:3000"
Write-Host "`nStart the server now with: node server.js`n"
