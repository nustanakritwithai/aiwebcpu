param(
    [Parameter(Mandatory=$true)]
    [string]$Url
)

$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$result = [ordered]@{
    skill       = "WEB_HEALTH_CHECK"
    url         = $Url
    ranCPU      = $true
    httpStatus  = $null
    latencyMs   = $null
    resultState = "UNKNOWN"
    verified    = $false
    error       = $null
}

try {
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.Method = "GET"
    $request.AllowAutoRedirect = $false
    $request.Timeout = 10000
    $request.ReadWriteTimeout = 10000
    $request.UserAgent = "AI-CPU-WEB-HEALTH-CHECK/0.2"

    $response = $request.GetResponse()
    $status = [int]$response.StatusCode
    $sw.Stop()

    $result.httpStatus = $status
    $result.latencyMs = $sw.ElapsedMilliseconds

    if ($status -ge 200 -and $status -lt 300) {
        $result.resultState = "WEB_ONLINE"
        $result.verified = $true
    }
    elseif ($status -ge 300 -and $status -lt 400) {
        $result.resultState = "WEB_REDIRECT"
        $result.verified = $true
    }
    elseif ($status -ge 400 -and $status -lt 500) {
        $result.resultState = "WEB_CLIENT_ERROR"
    }
    elseif ($status -ge 500) {
        $result.resultState = "WEB_SERVER_ERROR"
    }

    $response.Close()
}
catch [System.Net.WebException] {
    $sw.Stop()
    $result.latencyMs = $sw.ElapsedMilliseconds

    if ($_.Exception.Response) {
        $status = [int]$_.Exception.Response.StatusCode
        $result.httpStatus = $status

        if ($status -ge 400 -and $status -lt 500) {
            $result.resultState = "WEB_CLIENT_ERROR"
        }
        elseif ($status -ge 500) {
            $result.resultState = "WEB_SERVER_ERROR"
        }
    }
    else {
        switch ($_.Exception.Status.ToString()) {
            "Timeout"               { $result.resultState = "WEB_TIMEOUT" }
            "NameResolutionFailure" { $result.resultState = "WEB_DNS_ERROR" }
            "TrustFailure"          { $result.resultState = "WEB_TLS_ERROR" }
            "SecureChannelFailure"  { $result.resultState = "WEB_TLS_ERROR" }
            default                  { $result.resultState = "WEB_NETWORK_ERROR" }
        }
    }

    $result.error = $_.Exception.Message
}
catch {
    $sw.Stop()
    $result.latencyMs = $sw.ElapsedMilliseconds
    $result.resultState = "WEB_ERROR"
    $result.error = $_.Exception.Message
}

$result | ConvertTo-Json
