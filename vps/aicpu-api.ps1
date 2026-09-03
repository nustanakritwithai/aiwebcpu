param(
    [int]$Port = 8765,
    [string]$SkillPath = "C:\AI-CPU\web-health-check.ps1"
)

$ErrorActionPreference = "Stop"

function Write-JsonResponse {
    param(
        [Parameter(Mandatory=$true)] $Response,
        [Parameter(Mandatory=$true)] $Payload,
        [int]$StatusCode = 200
    )

    $json = $Payload | ConvertTo-Json -Depth 8
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.ContentEncoding = [System.Text.Encoding]::UTF8
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

function New-ErrorPayload {
    param([string]$Code, [string]$Message)
    return [ordered]@{
        ok = $false
        errorCode = $Code
        error = $Message
    }
}

if (-not (Test-Path -LiteralPath $SkillPath)) {
    throw "WEB_HEALTH_CHECK skill not found: $SkillPath"
}

$prefix = "http://127.0.0.1:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "AI CPU Local API started"
Write-Host "Listen: $prefix"
Write-Host "GET  /health"
Write-Host "POST /skills/web-health-check"
Write-Host "Localhost only. Press Ctrl+C to stop."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $path = $request.Url.AbsolutePath.TrimEnd('/')
        if ([string]::IsNullOrWhiteSpace($path)) { $path = "/" }

        try {
            if ($request.HttpMethod -eq "GET" -and $path -eq "/health") {
                $payload = [ordered]@{
                    ok = $true
                    service = "AI_CPU_API"
                    version = "0.2-local"
                    mode = "localhost-only"
                    skill = "WEB_HEALTH_CHECK"
                }
                Write-JsonResponse -Response $response -Payload $payload -StatusCode 200
                continue
            }

            if ($request.HttpMethod -eq "POST" -and $path -eq "/skills/web-health-check") {
                if ($request.ContentLength64 -gt 8192) {
                    Write-JsonResponse -Response $response -Payload (New-ErrorPayload "BODY_TOO_LARGE" "Request body exceeds 8 KB") -StatusCode 413
                    continue
                }

                $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                if ([string]::IsNullOrWhiteSpace($bodyText)) {
                    Write-JsonResponse -Response $response -Payload (New-ErrorPayload "MISSING_BODY" "JSON body is required") -StatusCode 400
                    continue
                }

                try {
                    $body = $bodyText | ConvertFrom-Json
                }
                catch {
                    Write-JsonResponse -Response $response -Payload (New-ErrorPayload "INVALID_JSON" "Request body must be valid JSON") -StatusCode 400
                    continue
                }

                $targetUrl = [string]$body.url
                if ([string]::IsNullOrWhiteSpace($targetUrl)) {
                    Write-JsonResponse -Response $response -Payload (New-ErrorPayload "MISSING_URL" "url is required") -StatusCode 400
                    continue
                }

                $uri = $null
                if (-not [System.Uri]::TryCreate($targetUrl, [System.UriKind]::Absolute, [ref]$uri)) {
                    Write-JsonResponse -Response $response -Payload (New-ErrorPayload "INVALID_URL" "url must be an absolute URL") -StatusCode 400
                    continue
                }

                if ($uri.Scheme -ne "http" -and $uri.Scheme -ne "https") {
                    Write-JsonResponse -Response $response -Payload (New-ErrorPayload "UNSUPPORTED_SCHEME" "Only http and https URLs are allowed") -StatusCode 400
                    continue
                }

                $raw = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $SkillPath -Url $targetUrl 2>&1 | Out-String
                try {
                    $skillResult = $raw | ConvertFrom-Json
                }
                catch {
                    $payload = [ordered]@{
                        ok = $false
                        errorCode = "SKILL_OUTPUT_INVALID"
                        error = "WEB_HEALTH_CHECK did not return valid JSON"
                        raw = $raw.Trim()
                    }
                    Write-JsonResponse -Response $response -Payload $payload -StatusCode 500
                    continue
                }

                $payload = [ordered]@{
                    ok = $true
                    api = "AI_CPU_API"
                    apiVersion = "0.2-local"
                    result = $skillResult
                }
                Write-JsonResponse -Response $response -Payload $payload -StatusCode 200
                continue
            }

            Write-JsonResponse -Response $response -Payload (New-ErrorPayload "NOT_FOUND" "Endpoint not found") -StatusCode 404
        }
        catch {
            try {
                Write-JsonResponse -Response $response -Payload (New-ErrorPayload "SERVER_ERROR" $_.Exception.Message) -StatusCode 500
            }
            catch {
                try { $response.Abort() } catch {}
            }
        }
    }
}
finally {
    if ($listener.IsListening) { $listener.Stop() }
    $listener.Close()
    Write-Host "AI CPU Local API stopped"
}
