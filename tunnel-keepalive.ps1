# ⚠️ [사용 자제] 이 스크립트는 터널이 죽을 때마다 자동 재발급한다.
#    임시 터널이 자주 죽으면 재발급이 잦아져 Cloudflare 요청 제한(429 Too Many Requests)에
#    걸릴 수 있다(실제 발생함). 그래서 기본 런처(start_fiteating.bat)에서는 제외했다.
#    => 폰 접속 주소가 필요하면 자동 감시 대신 아래를 "필요할 때 1회"만 실행하라:
#         powershell -ExecutionPolicy Bypass -File start-tunnel.ps1   (1회 발급, churn 없음)
#    안정적 고정 주소가 필요하면 Named Tunnel(계정+도메인) 사용을 권장.
#
# (참고) 이 스크립트의 동작: 터널을 띄우고, 죽으면 자동 재발급해 frontend/public/app-link.txt 갱신.
#   - 프론트(npm run dev)가 5173 에 떠 있어야 한다.
#   - 창을 켜둔 채로 둔다 (Ctrl+C 로 종료).

$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot
$linkFile = Join-Path $root "frontend\public\app-link.txt"
$log = Join-Path $env:TEMP "cf_tunnel.log"

function Wait-Frontend {
    for ($i = 0; $i -lt 60; $i++) {
        if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Start-Tunnel {
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    if (Test-Path $log) { Remove-Item $log -Force }
    Start-Process -FilePath "cloudflared" `
        -ArgumentList "tunnel", "--url", "http://localhost:5173" `
        -WindowStyle Hidden -RedirectStandardError $log -RedirectStandardOutput "$env:TEMP\cf_tunnel.out"
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($m) {
            $u = $m.Matches[0].Value
            [System.IO.File]::WriteAllText($linkFile, $u)
            $ts = (Get-Date).ToString("HH:mm:ss")
            Write-Host "[$ts] 새 터널 발급 -> $u" -ForegroundColor Green
            return $u
        }
    }
    Write-Host "주소 발급 실패 (로그: $log)" -ForegroundColor Red
    return $null
}

# 터널이 "실사용 가능"한지 확인.
#  - cloudflared 프로세스가 떠 있고
#  - 주소에 HTTP 로 닿았을 때 530(Argo 터널 끊김/origin unregistered)이 아니어야 한다.
# 530 또는 연결 자체 실패(DNS/연결 불가) = 터널 죽음 -> 재발급.
# 502/504 등은 프론트가 잠깐 죽은 것일 수 있어 살아있다고 보고 불필요한 주소 교체를 막는다.
function Test-Alive($u) {
    if (-not $u) { return $false }
    if (-not (Get-Process cloudflared -ErrorAction SilentlyContinue)) { return $false }
    try {
        Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 12 -MaximumRedirection 2 | Out-Null
        return $true
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code) {
            if ($code -eq 530) { return $false }   # 터널 끊김
            return $true                            # 502/504 등은 프론트 문제로 간주
        }
        return $false                               # 응답 자체 없음(DNS/연결 실패)
    }
}

Write-Host "프론트(5173) 대기 중..." -ForegroundColor Cyan
if (-not (Wait-Frontend)) {
    Write-Host "5173 이 안 떠 있습니다. 먼저 'npm run dev' 를 실행하세요." -ForegroundColor Red
    exit 1
}

$current = Start-Tunnel
$fails = 0
Write-Host "터널 감시 시작 (30초 간격 · Ctrl+C 로 종료)" -ForegroundColor Cyan
while ($true) {
    Start-Sleep -Seconds 30
    if (Test-Alive $current) {
        $fails = 0
    } else {
        $fails++
        $ts = (Get-Date).ToString("HH:mm:ss")
        Write-Host "[$ts] 터널 이상 감지 ($fails/2)" -ForegroundColor Yellow
        if ($fails -ge 2) {
            $new = Start-Tunnel
            if ($new) { $current = $new; $fails = 0 }
        }
    }
}
