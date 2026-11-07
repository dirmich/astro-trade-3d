# MANUAL & API SPECIFICATION: AstroTrade 3D

- **문서 버전**: v1.0.0
- **작성일**: 2026-11-07

---

## 1. 슈퍼유저 (Superuser / Admin) 계정 정보

| 항목 | 값 | 비고 |
| :--- | :--- | :--- |
| **Superuser Email** | `oldtv.cf@gmail.com` | 루트 `.env`의 `SUPERUSER_EMAIL`에 정의 |
| **초기 비밀번호 (Initial Password)** | `AstroAdmin!2026#` | 루트 `.env`의 `SUPERUSER_INITIAL_PASSWORD`에 정의 |
| **권한 (Role)** | `SUPERADMIN` | 게임 내 우측 상단 **[⚙️ ADMIN 관리]** 메뉴 전체 접근 가능 |

---

## 2. 루트 `.env` 환경변수 구성 안내

루트 경로의 `.env` 파일은 `[COMMON]`, `[BACKEND]`, `[FRONTEND]` 3개 구역으로 나뉘며, Backend(`backend/src/config/env.ts`)와 Frontend(`frontend/vite.config.ts`)가 동일 파일을 읽어들입니다.

```ini
# ============================================================================
# [COMMON] Shared Application Metadata
# ============================================================================
APP_NAME="AstroTrade 3D: Interplanetary Resource & Trading Simulator"
APP_VERSION="1.0.0"
APP_ENV="development"

# ============================================================================
# [BACKEND] Bun.sh + Hono.js + Database Configuration
# ============================================================================
BACKEND_HOST="0.0.0.0"
BACKEND_PORT=4000
DB_CLIENT="sqlite"
SQLITE_DB_PATH="./backend/data/astrotrade.sqlite"
POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/astrotrade"
JWT_SECRET="astrotrade-super-secret-jwt-key-2026-orbital-voyager"
SUPERUSER_EMAIL="oldtv.cf@gmail.com"
SUPERUSER_INITIAL_PASSWORD="AstroAdmin!2026#"
INITIAL_PLANET_COUNT=30
PLANET_EXPANSION_USERS_PER_PLANET=2

# ============================================================================
# [FRONTEND] Svelte + Three.js Client Configuration
# ============================================================================
FRONTEND_PORT=5173
VITE_API_BASE_URL="http://localhost:4000/api"
VITE_SUPERUSER_EMAIL="oldtv.cf@gmail.com"
VITE_INITIAL_PLANET_COUNT=30
VITE_STARFIELD_COUNT=6000
```

---

## 3. 실행 방법 (Quick Start)

### 3.1 Backend 실행 (Bun + Hono)
```bash
cd backend
bun install
bun run dev
# 서버가 http://localhost:4000 에서 시작되며, 초기 구동 시 30개 행성, 12종 자원, 슈퍼유저(oldtv.cf@gmail.com)가 자동 시딩됩니다.
```

### 3.2 Frontend 실행 (Svelte + Three.js)
```bash
cd frontend
bun install # 또는 npm install
bun run dev # 또는 npm run dev
# 브라우저에서 http://localhost:5173 접속
```

---

## 4. 주요 REST API 명세 (Hono.js Backend)

### 인증 및 플레이어 (`/api/auth`)
- `POST /api/auth/login`: 이메일/비밀번호 로그인 (`oldtv.cf@gmail.com` / `AstroAdmin!2026#` 지원)
- `POST /api/auth/register`: 신규 플레이어 등록. **가입 시 총 유저 수를 계산하여 자동으로 새로운 신화/위성 행성을 은하계에 생성**합니다.
- `GET /api/auth/me`: 현재 로그인된 플레이어 및 우주선 상태 조회

### 우주/행성/교역/이벤트 (`/api/game`)
- `GET /api/game/universe`: 전체 행성 목록(30+개), 행성별 자원 시세/재고, 은하 이벤트, 랭킹 조회
- `POST /api/game/warp`: 목표 행성으로 워프 항해 (거리 기반 연료 소모, 돌발 우주 이벤트 판정)
- `POST /api/game/mine`: 현재 행성 궤도/소행성대에서 자원 채집 (채굴 레이저 레벨 및 콤보 보너스 반영)
- `POST /api/game/trade`: 행성 교역소에서 자원 매수(`BUY`) 또는 매도(`SELL`). 거래 즉시 해당 행성의 자원 재고가 변동하고 가격이 재계산됨
- `POST /api/game/repair`: 수리점에서 선체 수리, 워프 연료 보충, 함선 장비(화물칸, 레이저, 워프드라이브, 실드, 함선 등급) 업그레이드
- `POST /api/game/tavern`: 술집 이벤트 수행 (`RUMOR` 시세 정보 입수, `CONTRACT` 특송 퀘스트 수락/완료, `HIRE` 전문 선원 고용, `GAMBLE` 퀀텀 다이스 게임)

### 슈퍼유저 관리 (`/api/admin`) — `oldtv.cf@gmail.com` 전용
- `POST /api/admin/planets`: 새로운 행성 수동 추가 또는 자동 확장 트리거 실행
- `PATCH /api/admin/planets/:id`: 특정 행성의 세율, 위험도, 수리점/술집 운영 상태, 자원 배율 수정
- `PATCH /api/admin/market`: 특정 행성의 자원 재고량 또는 기준 가격 즉시 조정
- `POST /api/admin/events`: 은하계 특수 경제/재난 이벤트(골드러시, 플라즈마 폭풍, 바이오 팬데믹 등) 발령 및 종료
- `POST /api/admin/simulate-users`: 다수의 신규 유저 유입을 시뮬레이션하여 자동 행성 추가 시스템을 즉시 테스트
