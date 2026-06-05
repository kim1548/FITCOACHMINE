# FITCOACH 셋업 점검 — 클론 후 루트에서 실행해 필요한 것들이 깔렸는지 확인한다.
#   powershell -ExecutionPolicy Bypass -File check-setup.ps1
$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot
$script:ok = 0; $script:warn = 0; $script:fail = 0

function R($label, $status, $detail) {
    $mark  = switch ($status) { "ok" { "[ OK ]" } "warn" { "[WARN]" } default { "[FAIL]" } }
    $color = switch ($status) { "ok" { "Green" }  "warn" { "Yellow" } default { "Red" } }
    Write-Host ("{0} {1}" -f $mark, $label) -ForegroundColor $color
    if ($detail) { Write-Host ("        $detail") -ForegroundColor DarkGray }
    if ($status -eq "ok") { $script:ok++ } elseif ($status -eq "warn") { $script:warn++ } else { $script:fail++ }
}
function Has($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "`n=== 1) 필수 도구 ===" -ForegroundColor Cyan

if (Has git) { R "Git" "ok" (git --version) } else { R "Git 미설치" "fail" "https://git-scm.com" }

if (Has python) {
    $pv = (python --version) 2>&1
    $m = [regex]::Match($pv, '(\d+)\.(\d+)')
    $maj = [int]$m.Groups[1].Value; $min = [int]$m.Groups[2].Value
    if ($maj -eq 3 -and $min -ge 11 -and $min -le 13) { R "Python (메인 백엔드)" "ok" "$pv" }
    elseif ($maj -eq 3 -and $min -eq 14) { R "Python (메인 백엔드)" "warn" "$pv — torch 2.11 휠이 3.14엔 없을 수 있음. 3.12 권장" }
    else { R "Python (메인 백엔드)" "warn" "$pv — 3.12 권장(3.11~3.13)" }
} else { R "Python 미설치" "fail" "3.12 설치: https://www.python.org/downloads (PATH 추가)" }

$py310 = (py -3.10 --version) 2>&1
if ($LASTEXITCODE -eq 0 -and "$py310" -match "3\.10") { R "Python 3.10 (영상 사이드카용)" "ok" "$py310" }
else { R "Python 3.10 (영상 사이드카용)" "fail" "py -3.10 없음 → Python 3.10 설치 (mediapipe/sklearn 휠)" }

if (Has node) {
    $nv = (node --version); $nmaj = [int]([regex]::Match($nv, 'v(\d+)').Groups[1].Value)
    if ($nmaj -ge 18) { R "Node.js" "ok" $nv } else { R "Node.js" "warn" "$nv — v18+ 권장" }
} else { R "Node.js 미설치" "fail" "https://nodejs.org (LTS)" }

if (Has ollama) {
    R "Ollama" "ok" ((ollama --version) 2>&1 | Select-Object -First 1)
    if (((ollama list) 2>&1) -match "gemma3:4b") { R "Ollama 모델 gemma3:4b" "ok" "" }
    else { R "Ollama 모델 gemma3:4b 없음" "fail" "ollama pull gemma3:4b" }
} else { R "Ollama 미설치" "fail" "https://ollama.com/download → 설치 후 'ollama pull gemma3:4b'" }

Write-Host "`n=== 2) 프로젝트 자산 (클론에 포함되어야 함) ===" -ForegroundColor Cyan
function FileChk($rel, $label) { if (Test-Path (Join-Path $root $rel)) { R $label "ok" $rel } else { R "$label 없음" "fail" $rel } }
FileChk "yolov8n.pt" "YOLO 가중치(루트)"
FileChk "backend\app\models\food\efficientnetb0.pt" "음식 분류 모델"
FileChk "backend\app\models\exercise\squat.pkl" "운동 모델(.pkl)"
FileChk "backend\models\best_big_bounding.pt" "사이드카 크롭 모델"
FileChk "backend\app\data\food_info.csv" "음식 데이터셋"
FileChk "backend\test.db" "SQLite DB"

Write-Host "`n=== 3) 설치된 의존성 ===" -ForegroundColor Cyan
$dep = (python -c "import fastapi, sqlalchemy, torch, ultralytics; print(torch.__version__)") 2>&1
if ($LASTEXITCODE -eq 0) { R "메인 백엔드 의존성(fastapi/torch/ultralytics)" "ok" "torch $dep" }
else { R "메인 백엔드 의존성 미설치/불완전" "fail" "backend 에서: pip install -r requirements.txt" }

$venv310py = Join-Path $root ".venv310\Scripts\python.exe"
if (Test-Path $venv310py) {
    $sdep = (& $venv310py -c "import mediapipe, sklearn, cv2, torch; print(sklearn.__version__)") 2>&1
    if ($LASTEXITCODE -eq 0) { R "사이드카 .venv310 의존성(mediapipe/sklearn/torch)" "ok" "sklearn $sdep" }
    else { R "사이드카 .venv310 의존성 불완전" "fail" ".venv310 에 requirements-models.txt 설치 필요" }
} else { R ".venv310 (사이드카 가상환경) 없음" "fail" "py -3.10 -m venv .venv310 후 설치" }

if (Test-Path (Join-Path $root "frontend\node_modules")) { R "프론트 node_modules" "ok" "" }
else { R "프론트 node_modules 없음" "fail" "frontend 에서: npm install" }

Write-Host "`n=== 4) 실행 중 서비스 (선택 — 실행 단계 확인용) ===" -ForegroundColor Cyan
function PortChk($port, $label) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { R "$label (:$port)" "ok" "LISTEN" }
    else { R "$label (:$port) 미실행" "warn" "아직 안 띄움 — 실행 단계에서 시작" }
}
PortChk 11434 "Ollama"
PortChk 8001 "메인 백엔드"
PortChk 8003 "영상 사이드카"
PortChk 5173 "프론트(Vite)"

Write-Host "`n=== 요약 ===" -ForegroundColor Cyan
Write-Host ("OK {0}  /  WARN {1}  /  FAIL {2}" -f $script:ok, $script:warn, $script:fail)
if ($script:fail -eq 0) { Write-Host "필수 항목 모두 충족!" -ForegroundColor Green }
else { Write-Host "FAIL 항목을 해결한 뒤 다시 실행하세요." -ForegroundColor Red }
