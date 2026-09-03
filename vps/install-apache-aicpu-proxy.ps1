param(
    [string]$ApacheRoot = "C:\xampp\apache"
)

$ErrorActionPreference = "Stop"

$httpd = Join-Path $ApacheRoot "bin\httpd.exe"
$sslConf = Join-Path $ApacheRoot "conf\extra\httpd-ssl.conf"
$proxyConf = Join-Path $ApacheRoot "conf\extra\aicpu-proxy.conf"

if (-not (Test-Path -LiteralPath $httpd)) { throw "Apache httpd.exe not found: $httpd" }
if (-not (Test-Path -LiteralPath $sslConf)) { throw "SSL config not found: $sslConf" }

$modules = (& $httpd -M 2>&1 | Out-String)
foreach ($required in @("proxy_module", "proxy_http_module", "ssl_module")) {
    if ($modules -notmatch [regex]::Escape($required)) {
        throw "Required Apache module is not loaded: $required"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "$sslConf.aicpu-backup-$timestamp"
Copy-Item -LiteralPath $sslConf -Destination $backup -Force

$proxyText = @'
# AI CPU V0.2 reverse proxy
# Public HTTPS path -> localhost-only AI CPU API
ProxyPass        "/aicpu-api/" "http://127.0.0.1:8765/" retry=0 timeout=20
ProxyPassReverse "/aicpu-api/" "http://127.0.0.1:8765/"

<Location "/aicpu-api/">
    Require all granted
</Location>
'@
[System.IO.File]::WriteAllText($proxyConf, $proxyText, [System.Text.Encoding]::ASCII)

$includeLine = 'Include "conf/extra/aicpu-proxy.conf"'
$lines = [System.Collections.Generic.List[string]](Get-Content -LiteralPath $sslConf)

if (-not ($lines -contains $includeLine)) {
    $start = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*<VirtualHost\s+\*:443>\s*$') {
            $start = $i
            break
        }
    }
    if ($start -lt 0) {
        Copy-Item -LiteralPath $backup -Destination $sslConf -Force
        throw "Could not find <VirtualHost *:443> in $sslConf"
    }

    $end = -1
    for ($i = $start + 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*</VirtualHost>\s*$') {
            $end = $i
            break
        }
    }
    if ($end -lt 0) {
        Copy-Item -LiteralPath $backup -Destination $sslConf -Force
        throw "Could not find closing </VirtualHost> for :443"
    }

    $lines.Insert($end, "    $includeLine")
    $lines.Insert($end, "    # AI CPU reverse proxy include")
    [System.IO.File]::WriteAllLines($sslConf, $lines, [System.Text.Encoding]::ASCII)
}

& $httpd -t
if ($LASTEXITCODE -ne 0) {
    Copy-Item -LiteralPath $backup -Destination $sslConf -Force
    throw "Apache config test failed. Original SSL config restored from $backup"
}

Write-Host "AI CPU Apache proxy config installed safely."
Write-Host "Backup: $backup"
Write-Host "Proxy include: $proxyConf"
Write-Host "Apache config test: PASS"
Write-Host "NEXT: restart Apache manually, then test https://157.85.96.139/aicpu-api/health"
