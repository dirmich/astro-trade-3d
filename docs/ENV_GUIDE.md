# 환경변수 설정 가이드 (`docs/ENV_GUIDE.md`)

본 문서는 `astro-trade-3d` 저장소 루트의 `.env` 및 `.env.example` 환경변수 소유권 분류, 필수/선택 항목, 로컬 및 Docker 실행 시 주소 차이, 적용·검증 방법을 안내합니다.

---

## 1. 환경변수 소유권 구분

루트 `.env`와 `.env.example`은 다음 3개 섹션으로 구분됩니다.

1. **`[공통/Docker]`**: 앱 메타데이터 및 관리자 초기 시딩 설정
2. **`[Backend]`**: 서버 포트, 데이터베이스 연결 정보, JWT/OAuth 시크릿, 게임 경제 파라미터 (브라우저에 노출되지 않는 서버 전용 값)
3. **`[Frontend]`**: 프런트엔드 포트 및 브라우저에 공개되어도 안전한 `VITE_*` 빌드/런타임 설정

> **주의**: 실제 비밀번호, JWT 시크릿, OAuth Client Secret 등 민감 정보는 Git이나 LLM Wiki에 기록하지 않으며 `.env.example`에는 안전한 플레이스홀더만 유지합니다.

---

## 2. 환경변수 목록

### 2.1 필수값
| 변수명 | 소유권 | 기본값 예시 | 설명 |
|---|---|---|---|
| `BACKEND_PORT` | Backend | `8000` | 백엔드 API 서버 리슨 포트 |
| `FRONTEND_PORT` | Frontend | `3000` | 프런트엔드 개발/컨테이너 노출 포트 |
| `DB_CLIENT` | Backend | `sqlite` | `sqlite` (기본 파일 DB) 또는 `postgres` (공용 PostgreSQL) |
| `SQLITE_DB_PATH` | Backend | `./backend/data/astrotrade.sqlite` | SQLite 사용 시 DB 파일 경로 |
| `JWT_SECRET` | Backend | `<CHANGE_ME_JWT_SECRET>` | 인증 토큰 서명 키 |
| `VITE_API_BASE_URL` | Frontend | `http://localhost:8000/api` | 프런트엔드가 호출할 백엔드 API 기준 URL |

### 2.2 기능별 필수값 (PostgreSQL / Google OAuth 사용 시)
| 변수명 | 소유권 | 안전한 예시 | 설명 |
|---|---|---|---|
| `POSTGRES_URL` | Backend | `postgresql://postgres:<PASSWORD>@localhost:5432/astrotrade` | 로컬 프로세스에서 공용 PostgreSQL 접속 시 사용 |
| `DOCKER_POSTGRES_URL` | Backend | `postgresql://postgres:<PASSWORD>@host.docker.internal:5432/astrotrade` | Docker 컨테이너 내부에서 호스트의 공용 PostgreSQL 접속 시 사용 |
| `BACKEND_PUBLIC_URL` | Backend | `http://localhost:8000` | OAuth 콜백 등 브라우저가 접근하는 백엔드 공개 주소 |
| `GOOGLE_CLIENT_ID` | Backend | `<OPTIONAL_GOOGLE_OAUTH_CLIENT_ID>` | 실제 Google OAuth 연동 시 Client ID |
| `GOOGLE_CLIENT_SECRET` | Backend | `<OPTIONAL_GOOGLE_OAUTH_CLIENT_SECRET>` | 실제 Google OAuth 연동 시 Client Secret |

### 2.3 선택값 (게임 밸런스 및 그래픽 설정)
| 변수명 | 소유권 | 기본값 | 설명 |
|---|---|---|---|
| `SUPERUSER_EMAIL` | 공통/Docker | `oldtv.cf@gmail.com` | 슈퍼유저(관리자 메뉴) 이메일 |
| `INITIAL_PLANET_COUNT` | Backend | `30` | 초기 생성 신화/태양계 행성 수 |
| `PLANET_EXPANSION_USERS_PER_PLANET` | Backend | `2` | 자동 행성 확장이 일어나는 유저 수 임계치 |
| `STARTING_CREDITS` | Backend | `3500` | 신규 파일럿 초기 크레딧 |
| `VITE_STARFIELD_DENSITY` | Frontend | `6000` | 3D 배경 별 입자 밀도 |

---

## 3. 로컬 실행 vs Docker 실행 주소 차이

- **로컬 프로세스 (`./man.sh start`)**:
  - 백엔드는 `http://localhost:8000`, 프런트엔드는 `http://localhost:3000`에서 실행됩니다.
  - PostgreSQL 사용 시 호스트 루프백 주소인 `POSTGRES_URL` (`localhost:5432`)을 사용합니다.
- **Docker 컨테이너 (`docker compose up -d --build`)**:
  - 새 PostgreSQL 컨테이너를 중복 생성하지 않고 기존 공용 PostgreSQL 인스턴스를 사용합니다.
  - 컨테이너 내부에서 호스트 DB에 접근할 때는 `extra_hosts: ["host.docker.internal:host-gateway"]`를 통해 `DOCKER_POSTGRES_URL` (`host.docker.internal:5432`)이 `POSTGRES_URL`로 주입됩니다.

---

## 4. 적용 및 검증 방법

```bash
# 1. 환경파일 준비
cp .env.example .env

# 2. man.sh로 백엔드(8000) + 프런트엔드(3000) 기동 및 상태 확인
./man.sh start
./man.sh status

# 3. 헬스체크 API 검증
curl http://localhost:8000/api/health

# 4. Docker Compose 설정 검증 및 컨테이너 빌드/기동
docker compose config
docker compose up -d --build
```
