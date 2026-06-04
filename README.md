# FITCOACH

운동 프로그램 트래커 · AI 자세 분석(Form Check) · 식단 기록(MEALS) 통합 헬스 코칭 앱.

## 기술 스택
- **Backend**: FastAPI · SQLAlchemy · SQLite · PyTorch · YOLOv8 · MediaPipe
- **Frontend**: React 19 · Vite · TailwindCSS · React Router · Recharts
- **AI**: 자세 분석(MediaPipe Pose), 음식 분류(EfficientNet/YOLO 커스텀)

## 주요 페이지
| 라우트 | 페이지 | 설명 |
|---|---|---|
| `/Dashboard` | Dashboard | 오늘 운동·식단 요약 |
| `/program` | RoutinePlan | 10종 프로그램(StrongLifts, nSuns, 5/3/1 등) 중량/세트 트래커 |
| `/formcheck` | FormCheck | 영상 업로드 → AI 자세 피드백 |
| `/meals` | MEALS | 끼니별 매크로(칼로리/탄수/단백/지방) 기록 |
| `/blog` | Blog | 운동·식단 저널 |

---

## 🚀 다른 컴퓨터에서 처음 실행하기

### 1️⃣ 사전 요건 (한 번만 설치)

| 도구 | 버전 | 다운로드 |
|---|---|---|
| Git | 최신 | https://git-scm.com |
| **Python** | **3.12 (필수)** | https://www.python.org/downloads/ |
| Node.js | LTS v18+ | https://nodejs.org |

> ⚠️ Python은 **3.12 권장** (3.11~3.13 가능). 3.10 이하는 `torch`·`torchvision` 설치 실패, 3.14는 일부 패키지가 빌드 도구 없이는 설치 실패합니다.

### 2️⃣ 저장소 클론

원하는 위치(예: `C:\Project`)에서 터미널 열고:
```bash
git clone https://github.com/kim1548/FITCOACH.git
cd FITCOACH
```

### 3️⃣ ⚠️ 별도 자산 받기 (`.gitignore`로 제외된 파일)

용량이 커서 깃에 없습니다. **별도 경로(구글 드라이브 등)로 공유받아 다음 위치에 그대로 넣으세요:**

| 항목 | 들어갈 위치 |
|---|---|
| ML 모델 (`.pt`, `.pth` 9개) | `backend/app/models/` |
| 데이터셋 (CSV 등) | `backend/app/data/` |
| `yolov8n.pt` | 프로젝트 루트 |

> 모델/데이터 없이도 로그인·기록·프로그램 페이지는 동작하지만, AI 분석 기능(자세 분석, 음식 인식)은 실패합니다.

### 4️⃣ 백엔드 셋업 — **터미널 ①**

```bash
cd backend

# 가상환경 생성
py -3.12 -m venv venv               # Windows
python3.12 -m venv venv             # macOS/Linux

# 가상환경 활성화
.\venv\Scripts\activate              # Windows
source venv/bin/activate             # macOS/Linux

# 가상환경에 아래와 같이 torch==2.11.0+cpu torchvision==0.26.0+cpu torchaudio==2.11.0+cpu <-- 3가지를 따로 설치하세요(비공식버전이라 따로 설치해야 합니다.)
pip install torch==2.11.0+cpu torchvision==0.26.0+cpu torchaudio==2.11.0+cpu --extra-index-url https://download.pytorch.org/whl/cpu

# 의존성 설치 (몇 분 소요)
pip install -r requirements.txt

# 서버 실행 (포트 8001)
uvicorn app.main:app --reload --port 8001
```

✅ 정상 시: `Uvicorn running on http://127.0.0.1:8001`
> `test.db`(SQLite)는 첫 실행 시 자동 생성됩니다.

### 5️⃣ 프론트엔드 셋업 — **터미널 ② (새 창)**

```bash
cd frontend
npm install                          # 의존성 설치
npm run dev                          # Vite 개발 서버 (포트 5173)
```

### 6️⃣ 브라우저에서 접속
👉 `http://localhost:5173`

---

 1) Ollama 설치

  - https://ollama.com/download → Windows 설치파일 받아 설치
  - 설치하면 자동으로 백그라운드에서 11434 포트로 실행됩니다 (별도 실행 명령 불필요)
  - 확인: 새 터미널에서
  ollama --version
  - 또는 브라우저로 http://localhost:11434 → "Ollama is running" 뜨면 정상

  2) 모델 받기 (필수)

  ollama pull gemma3:4b
  - 몇 GB라 시간 좀 걸립니다 (인터넷 필요)
  - 확인:
  ollama list          ← gemma3:4b 가 보이면 OK
  ollama run gemma3:4b "안녕"   ← 응답 나오면 정상 (테스트 후 /bye 로 종료)

  3) 백엔드와 자동 연동

  - 백엔드 코드가 http://localhost:11434 + 모델 gemma3:4b 로 고정돼 있어서, 같은 PC에 Ollama가 떠 있고 모델만 받아져
  있으면 자동 연결됩니다. 추가 설정 없음.
  - 단, 백엔드(8001)가 실행 중이어야 합니다.

  4) 앱에서 AI 총평 보는 곳

  - Body(인바디) 기록 저장 → AI 코멘트
  - 주간 리포트 / 저널 등 AI 총평 항목
  - 데이터를 넣고 해당 기능을 실행하면 Ollama가 총평을 생성합니다.

  5) 안 될 때 체크 (순서대로)

  1. ollama list 에 gemma3:4b 있는지 (없으면 2번 다시)
  2. http://localhost:11434 응답 뜨는지 (Ollama 실행 중인지)
  3. 백엔드(8001) 실행 중인지
  4. 첫 호출은 모델 로딩으로 수십 초 느릴 수 있음 — 잠시 기다리기
  5. 그래도 실패면 백엔드 터미널 로그에 "Ollama 연결 실패" 메시지 확인

  ▎ 핵심: Ollama 설치 → ollama pull gemma3:4b → 백엔드 실행 이 셋만 되면 AI 총평이 동작합니다.

## 📁 폴더 구조 (요약)

```
FITCOACH/
├── backend/                  # FastAPI 서버
│   ├── app/
│   │   ├── api/v1/endpoints/ # 라우터 (auth, diet, exercise, routine)
│   │   ├── models/           # ⛔ ML 모델 (gitignore) - 별도 다운로드
│   │   ├── data/             # ⛔ CSV 데이터셋 (gitignore) - 별도 다운로드
│   │   ├── core/             # 설정·보안 유틸
│   │   ├── schemas/          # Pydantic 스키마
│   │   ├── services/         # 비즈니스 로직
│   │   └── main.py           # FastAPI 진입점
│   ├── requirements.txt
│   └── test.db               # ⛔ 첫 실행 시 자동 생성 (gitignore)
│
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── pages/            # 모든 라우트 페이지 (.jsx)
│   │   ├── components/       # 공통 컴포넌트 (Navbar, TopNavbar)
│   │   ├── features/         # 도메인별 위젯 (ExerciseAnalyzer 등)
│   │   ├── api/config.js     # API base URL
│   │   ├── context/          # React Context (Auth)
│   │   ├── assets/           # 운동 가이드 이미지
│   │   └── programs.js       # 10종 운동 프로그램 엔진
│   ├── public/resources/     # 정적 자산 (프로그램 표지, 영상)
│   └── package.json
│
├── start_fiteating.bat       # Windows 동시 실행 런처
├── .gitignore
└── README.md
```

---

## 🛠 트러블슈팅

**`pip install`에서 `Microsoft Visual C++ 14.0 required` 에러**
→ Build Tools 설치: https://visualstudio.microsoft.com/visual-cpp-build-tools/

**`venv` 활성화 시 PowerShell에서 권한 거부**
→ PowerShell 관리자 권한으로 열고: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**프론트엔드는 뜨는데 API가 404**
→ 백엔드가 `:8001`에서 안 떴거나, frontend의 Vite proxy 설정이 깨짐. 양쪽 터미널 로그 확인.

**`torch` 설치 너무 느림 / 실패**
→ Python 3.12 인지 확인. `pip install torch --index-url https://download.pytorch.org/whl/cpu` (CPU 버전).

**브라우저에서 `localhost:5173` 안 열림**
→ Vite 로그에서 실제 포트 확인 (5173이 점유 중이면 5174로 자동 변경).

---

## 🔄 코드 수정 후 GitHub에 업로드

```bash
git status                   # 변경된 파일 확인
git add .                    # 전체 스테이징
git commit -m "변경 내용 요약"
git push                     # 변경분만 자동 업로드
```
