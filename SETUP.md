# FITCOACH — 다른 PC에서 실행하기

> ✅ **모델·데이터셋·DB가 깃에 포함**되어 있어, 클론만 하면 자산이 전부 따라옵니다. (별도 다운로드 불필요)
> 환경(Python 2개 · Node · Ollama)만 설치하면 됩니다.

---

## 0. 빠른 점검
클론 후 프로젝트 루트에서:
```powershell
powershell -ExecutionPolicy Bypass -File check-setup.ps1
```
필요한 것들이 깔렸는지 ✅/⚠️/❌ 로 한눈에 보여주고, 부족한 건 설치 명령을 안내합니다.

---

## 1. 사전 도구 설치 (PC당 한 번)
| 도구 | 버전 | 비고 |
|---|---|---|
| **Git** | 최신 | https://git-scm.com |
| **Python (메인 백엔드)** | **3.12** 권장 (3.11~3.13) | `torch 2.11+cpu` 휠 때문에 3.14는 비권장 |
| **Python 3.10 (영상 사이드카)** | **3.10** | `mediapipe`·`scikit-learn` 휠. `py -3.10` 으로 호출됨 |
| **Node.js** | LTS 18+ | https://nodejs.org |
| **Ollama** | 최신 | https://ollama.com/download → 설치 후 `ollama pull gemma3:4b` |

> Python은 설치 시 **"Add to PATH"** 체크. 3.12와 3.10을 둘 다 깔면 `py -3.12`, `py -3.10` 으로 구분 호출됩니다.

---

## 2. 클론
```bash
git clone https://github.com/kim1548/FITCOACH.git
cd FITCOACH
```

## 3. 메인 백엔드 의존성 (포트 8001)
```powershell
cd backend
pip install -r requirements.txt   # torch CPU 포함(--extra-index-url 자동), 몇 분 소요
cd ..
```
> `run_dev.ps1` 이 시스템 `python` 으로 메인 백엔드를 띄우므로, 위처럼 **현재 python** 에 설치하면 됩니다.
> (가상환경을 쓰려면 `py -3.12 -m venv backend\venv` → 활성화 후 설치하고, 실행 시에도 그 venv를 활성화한 상태로 `run_dev.ps1` 실행)

## 4. 영상 분석 사이드카 (포트 8003)
프로젝트 루트에서:
```powershell
py -3.10 -m venv .venv310
.\.venv310\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.\.venv310\Scripts\python.exe -m pip install -r backend\requirements-models.txt
```

## 5. Ollama 모델
```powershell
ollama pull gemma3:4b
```
(Ollama 데스크톱이 백그라운드에서 11434 포트로 자동 서빙)

## 6. 프론트엔드 (포트 5173)
```powershell
cd frontend
npm install
cd ..
```

---

## 7. 실행
**터미널 ① — 백엔드 + 사이드카 동시 기동:**
```powershell
powershell -ExecutionPolicy Bypass -File backend\run_dev.ps1
```
**터미널 ② — 프론트:**
```powershell
cd frontend
npm run dev
```
👉 브라우저: http://localhost:5173

실행 후 `check-setup.ps1` 을 다시 돌리면 4개 포트(11434/8001/8003/5173)가 전부 `LISTEN` 인지 확인됩니다.

---

## 8. (선택) 폰에서 접속 / PWA 설치
```powershell
powershell -ExecutionPolicy Bypass -File start-tunnel.ps1
```
→ 발급된 `https://....trycloudflare.com` 주소로 폰 접속. 이 주소는 앱 **SET → Get the app** 에도 자동 표시됩니다.
> 알림·카메라·PWA 설치는 HTTPS(터널)에서만 동작합니다.

---

## 트러블슈팅
- **torch 설치 실패** → Python이 **3.12**인지 확인 (3.14는 휠 없음). `py -3.12` 로 환경 구성.
- **`py -3.10` 없음** → Python 3.10 설치.
- **AI 분석/코멘트 실패** → ① Ollama 실행 + `ollama list` 에 `gemma3:4b` 있는지, ② 사이드카(8003, `.venv310`)가 떴는지 확인.
- **첫 폼체크가 느림/네트워크 오류** → YOLOv5를 `torch.hub` 로 최초 1회 인터넷에서 받아 캐시함(인터넷 필요).
- **포트 충돌** → 8001/8003/5173 사용 중인 프로세스 종료 후 재실행.
