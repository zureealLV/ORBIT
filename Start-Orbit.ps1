param([switch]$NoBrowser, [switch]$Lan)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$url = 'http://127.0.0.1:4173'
function Get-OrbitHealth {
    try { return Invoke-RestMethod "$url/api/health" -TimeoutSec 2 } catch { return $null }
}
function Show-OrbitUrls($health) {
    Write-Host "Computer: $url"
    foreach ($lanUrl in $health.lanUrls) { Write-Host "Phone (same network): $lanUrl" }
}
$health = Get-OrbitHealth
if ($health -and $health.name -eq 'orbit-osu-reader') {
    if ($Lan -and $health.accessMode -ne 'lan') { throw 'ORBIT is running in local-only mode. Stop that instance before starting LAN mode.' }
    Write-Host "ORBIT is already running."
    Show-OrbitUrls $health
    if (-not $NoBrowser) { Start-Process $url }
    exit 0
}
$node = (Get-Command node -ErrorAction Stop).Source
$version = [version]((& $node -p 'process.versions.node').Trim())
if ($version -lt [version]'22.12.0') { throw 'Node.js 22.12+ is required.' }
if (-not (Test-Path -LiteralPath 'node_modules/fflate') -or -not (Test-Path -LiteralPath 'node_modules/@noble/hashes')) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
}
if (-not (Test-Path -LiteralPath 'dist/index.html')) {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
}
$cache = Join-Path $PSScriptRoot '.cache'
New-Item -ItemType Directory -Path $cache -Force | Out-Null
$serverArguments = @('server/index.mjs', '--production')
if ($Lan) { $serverArguments += '--lan' }
$process = Start-Process -FilePath $node -ArgumentList $serverArguments -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $cache 'orbit.stdout.log') -RedirectStandardError (Join-Path $cache 'orbit.stderr.log') -PassThru
for ($i=0; $i -lt 30; $i++) {
    $health = Get-OrbitHealth
    if ($health -and $health.name -eq 'orbit-osu-reader') {
        $process.Id | Set-Content -LiteralPath (Join-Path $cache 'orbit.pid')
        Write-Host "ORBIT is ready."
        Show-OrbitUrls $health
        if (-not $NoBrowser) { Start-Process $url }
        exit 0
    }
    if ($process.HasExited) { break }
    Start-Sleep -Milliseconds 250
}
throw "Server did not start. Check .cache/orbit.stderr.log; port 4173 may be in use."
