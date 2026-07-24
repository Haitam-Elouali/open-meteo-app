<#
.SYNOPSIS
  Update Windows hosts file for Open Arsad local domain.
.DESCRIPTION
  Adds or updates the hosts file entry so "open-meteo.local" resolves to the
  server's static LAN IP.
.NOTES
  - Run PowerShell as Administrator.
  - This must be run on each client machine that needs the local domain.
#>

param(
  [string]$StaticIP = "172.25.80.10",
  [string]$LocalDomain = "open-meteo.local"
)

function Test-Admin {
  $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
  Write-Host "Please run PowerShell as Administrator." -ForegroundColor Red
  exit 1
}

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$entry = "$StaticIP`t$LocalDomain"
$content = Get-Content $hostsPath -Raw
$backup = "$hostsPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

if ($content -notmatch [regex]::Escape($LocalDomain)) {
  Copy-Item $hostsPath $backup
  Add-Content -Path $hostsPath -Value "`n# Open Arsad local domain`n$entry"
  Write-Host "Added $entry to $hostsPath" -ForegroundColor Green
} else {
  $updated = $content -replace "(?m)^\d+\.\d+\.\d+\.\d+\s+$([regex]::Escape($LocalDomain))", $entry
  if ($updated -ne $content) {
    Copy-Item $hostsPath $backup
    Set-Content -Path $hostsPath -Value $updated
    Write-Host "Updated hosts entry for $LocalDomain to $StaticIP" -ForegroundColor Green
  } else {
    Write-Host "Hosts entry for $LocalDomain already points to $StaticIP" -ForegroundColor Yellow
  }
}

Write-Host "Backup saved to: $backup"
Write-Host "`nTest with: ping $LocalDomain"
Write-Host "Then open: http://$LocalDomain`:3000`n"
