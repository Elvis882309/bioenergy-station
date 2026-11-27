param([string]$Python, [int]$Port=8861)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
if (!$Python) {
    $Python=@((Join-Path $root '.venv/Scripts/python.exe'),(Join-Path ([Environment]::GetFolderPath('Desktop')) 'PyADM1ODE-demo/app/PyADM1ODE/.venv/Scripts/python.exe')) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (!$Python) { $Python=(Get-Command python).Source }
}
if ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains $Port) { throw "Port $Port already in use." }
$saved=@{}
foreach($name in 'STATIONMASTER_BASE_URL','STATIONMASTER_MODEL','STATIONMASTER_API_KEY') { $saved[$name]=[Environment]::GetEnvironmentVariable($name) }
try {
    $env:STATIONMASTER_BASE_URL='https://api.deepseek.com'
    $env:STATIONMASTER_MODEL='deepseek-flash'
    $env:STATIONMASTER_API_KEY=$env:DEEPSEEK_API_KEY
    if (!$env:STATIONMASTER_API_KEY) {
        $secure=Read-Host 'DeepSeek API key (hidden)' -AsSecureString
        $env:STATIONMASTER_API_KEY=[Net.NetworkCredential]::new('',$secure).Password
        $secure.Dispose()
    }
    if (!$env:STATIONMASTER_API_KEY) { throw 'DeepSeek API key is empty.' }
    $service=Start-Process -WindowStyle Hidden -FilePath $Python -WorkingDirectory $root -ArgumentList @('webdemo/app.py','--host','127.0.0.1','--port',"$Port") -PassThru
    $url="http://127.0.0.1:$Port/static/station/index.html"
    $deadline=(Get-Date).AddSeconds(60)
    do {
        if ($service.HasExited) { throw "Station startup failed (exit $($service.ExitCode))." }
        try {
            if ((Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2).StatusCode -eq 200) {
                Write-Host "Station ready: $url"
                Start-Process $url
                return
            }
        } catch {}
        Start-Sleep -Milliseconds 400
    } while ((Get-Date) -lt $deadline)
    throw "Station startup timed out. Try $url again after a moment."
} finally {
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
}
