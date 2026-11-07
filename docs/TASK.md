# TASK: AstroTrade 3D 세부 개발 체크리스트 및 버전 기록

- **문서 버전**: v1.0.8 (모바일 폰 화면 반응형 레이아웃·터치 추진기 조종·모바일 우주지도 미니 레이더 및 드로어 HUD 최적화)
- **관리 원칙**: 각 Subtask 완료 시마다 버전을 업데이트하고 Git 커밋을 수행합니다.

---

## Subtask 체크리스트

### Phase 1: 기획 및 문서화 (`v0.1.0`) — 완료
- [x] `docs/PRD.md` 작성 (게임 루프, 12종 자원, 30개 신화/위성 행성, 공급 반비례 가격 모델, 자동 행성 확장, Admin 명세)
- [x] `docs/PLAN.md` 작성 (Frontend/Backend 폴더 구조, 공유 `.env` 아키텍처, Three.js 3D 설계)
- [x] `docs/TASK.md` 및 `docs/MANUAL_AND_API.md` 작성
- [x] Git 저장소 초기화 및 `v0.1.0` 커밋

### Phase 2: 공유 `.env` 및 Backend 서버 개발 (`v0.2.0`) — 완료
- [x] 루트 `.env` 파일 생성 (`[COMMON]`, `[BACKEND]`, `[FRONTEND]` 섹션 구분, 슈퍼유저 `oldtv.cf@gmail.com` 및 초기 비밀번호 `AstroAdmin!2026#` 설정)
- [x] `backend/src/config/env.ts` 루트 `.env` 파서 구현
- [x] `backend/src/db/adapter.ts` (SQLite 기본 + PostgreSQL 호환 스키마) 구현
- [x] `backend/src/db/seed.ts` (초기 30개 행성, 12종 자원, 행성별 초기 재고 및 특산 배율, 슈퍼유저 계정 시딩)
- [x] `backend/src/services/economy.ts` & `galaxy.ts` (공급량 반비례 가격 공식, 사용자 증가 시 신화/위성 행성 자동 추가 로직)
- [x] `backend/src/services/events.ts` (수리점 함선 개조, 술집 루머/선원 고용/주사위 갬블/랜덤 인카운터 이벤트)
- [x] `backend/src/routes/` (`auth.ts`, `game.ts`, `admin.ts`) 및 `backend/src/index.ts` (Hono.js 엔트리포인트) 구현
- [x] `v0.2.0` 버전업 및 Git 커밋

### Phase 3: Frontend (Svelte + Three.js) 개발 (`v0.3.0`) — 완료
- [x] `frontend/` 프로젝트 설정 (`package.json`, `vite.config.ts`에서 루트 `.env` 공유 로드)
- [x] `frontend/src/lib/three/SpaceScene.ts` 사실적 3D 우주/행성/우주선/채굴/워프 엔진 구현
- [x] `frontend/src/lib/stores/gameStore.ts` 상태 및 API 연동 구현
- [x] `frontend/src/lib/components/` (`TradingPostModal.svelte`, `RepairShopModal.svelte`, `TavernModal.svelte`, `AdminModal.svelte`) 및 `App.svelte` 구현
- [x] `v0.3.0` 버전업 및 Git 커밋

### Phase 4: 통합 패키징 및 릴리즈 (`v1.0.0`) — 완료
- [x] 전체 기능 검증 및 Canvas 즉시 실행용 번들(`astro_trade_3d.html`) + 풀스택 소스 아카이브(`astro_trade_3d_fullstack.zip`) 생성
- [x] `docs/TASK.md` 최종 완료 상태 업데이트 및 `v1.0.0` Git 커밋 & 태그 생성

### Phase 5: 3D 직접운행·상점·멀티유저 해적전리품·다국어·BGM 고도화 (`v1.0.1`) — 완료
- [x] 3D 직접 운행(`MANUAL`), 유료 워프 점프 셀(`WARP`), 횟수제 AI 자동항해 에이전트(`AI_AGENT`) 및 타이트한 초기 자금(`3,500 CR`) 적용
- [x] 행성별 특화 만물상점(`ShopModal`), 기간제 10개 구역 성간 지도, 항해 중 긴급 지도 구매(10배 가격, 최대 3회), 6단계 등급(`Lv.1`~`Lv.6`) 테두리 및 33종 커스텀 SVG 아이템 이미지 제작
- [x] 항해 중 우주 재해(태양풍, 행성 파편, 우주 쓰레기) 및 멀티유저 함선 표시·충돌 피해 구현
- [x] Google SSO 랜딩페이지(`LandingPage`), 슈퍼유저(`oldtv.cf@gmail.com`) 관리자 메뉴, 총자산 연동 실시간 파일럿 레벨(`Lv.1`~`Lv.10` 승급/강등)
- [x] 다단계 우주해적(`Lv.1`~`Lv.10`), 다중 유저 협동 공격(Co-op), 상점 비매품 해적 전용 전리품(`pirate_only: true`, 5종) 드랍 시스템
- [x] 친구 요청/수락 및 접속 상태 표시(`FriendsModal`), 레벨별 퀘스트 및 관리자 퀘스트 에디터(`QuestModal`, `AdminModal`)
- [x] 4개 국어 모듈화(`en` 기본, `ko`, `ja`, `zh`) + DB 설정 저장, Web Audio API 기반 우주 배경음악 4곡 랜덤 재생 및 전투 전용 BGM/효과음(`SoundEngine`)

### Phase 6: `man.sh` 실행 스크립트 및 Dockerize 표준화 (`v1.0.2`) — 완료
- [x] 전역 운영 규칙에 맞춘 기본 포트 표준화 (`frontend:3000`, `backend:8000`)
- [x] 루트 `man.sh` (`./man.sh [start|stop|status|restart] [backend|frontend|none]`) 작성 및 검증
- [x] `backend/Dockerfile`, `frontend/Dockerfile`, 루트 `docker-compose.yml`, `.dockerignore` 작성 (`host.docker.internal` 공용 DB 연동 지원)
- [x] `docs/ENV_GUIDE.md` 환경변수 소유권 및 설정 가이드 작성

### Phase 7: dev 배포 및 PostgreSQL 대응 (`v1.0.4`) — 완료
- [x] dev `~/0.service/astro-trade/` 구성 (`deploy.sh`, `docker-compose.yml.deploy`, `.env.prod`) — 다른 프로젝트와 동일 패턴
- [x] Docker 이미지 `dirmich/astro:latest` (frontend), `dirmich/astrob:latest` (backend) 빌드 (dev 로컬 빌드; Docker Hub 푸시는 GitHub Action `docker.yml` 경유 예정)
- [x] HAProxy에 `astro.lab.highmaru.com` / `astrob.lab.highmaru.com` 추가 (와일드카드 `*.lab.highmaru.com` 인증서 재사용, 백엔드 WebSocket Upgrade 전달)
- [x] 공용 PostgreSQL 컨테이너에 DB `astrotrade` 생성, `DB_CLIENT=postgres`로 기동 — 시드 30개 행성·12종 자원·360개 시장·5개 유저 확인, 30초 시장 틱 동작 확인
- [x] 배포 중 발견·수정: backend Dockerfile 최종 이미지에 `backend/node_modules` 누락 (`Cannot find package 'hono'`), Postgres INTEGER 32비트 오버플로 (`Date.now()` → BIGINT), postgres.js BIGINT 문자열 반환으로 시장 틱 NaN (BIGINT→Number 파서), 풀 커넥션 트랜잭션 분리 문제 (Postgres에서 BEGIN/COMMIT/ROLLBACK no-op)
- [x] `deploy/docker-compose.yml.deploy`, `deploy/deploy.sh`, `deploy/.env.example`, `.github/workflows/docker.yml` 추가

### Phase 8: 우측 대형 출항 메뉴·거리비례 AI자동운행·우주지도 항법레이더 및 3D 우주/경고 개선 (`v1.0.5`) — 완료
- [x] 우측 HUD 상단 및 하단 메뉴 우측에 대형 `출항 (수동운행 / AI 자동운행)` 버튼 및 목적지 행성 선택기 배치
- [x] AI 에이전트 보유 시 목적지 행성 선택 후 거리(`km`)에 비례하여 운행시간(`예상/남은 운행시간 초`)이 소요되는 AI 자동운행 및 수동운행 구현
- [x] 우주지도 구매/소지 시 실시간 2D 우주지도 항법 레이더(SVG 성도) 표시 — 내 함선(`🛸`), 목적지 마커(`🎯`), 항법 가이드라인 표시 및 클릭 목적지 지정 지원
- [x] 3D 우주 공간(`SpaceScene.ts`) 즉시 렌더링(태양·고리 행성·우주선·별무리) 및 TypeScript/Svelte/Vite 빌드 에러·경고 0건 달성

### Phase 9: 구역별 우주지도 정밀 성도·상점 내 지도 미리보기 및 E2E 브라우저 검증 (`v1.0.6`) — 완료
- [x] 우측 HUD, `StarMapModal`(전체 은하 2D 항법 레이더 + 구역별 정밀 성도), `ShopModal`(구역별 우주지도 미니 성도 미리보기) 상시 시각화
- [x] 구역 우주지도 모달 및 우측 HUD에서 미개방 구역 지도 1클릭 정가 즉시 구매 지원 및 보유 지도 인벤토리 연동
- [x] Headless Chrome CDP 기반 E2E 브라우저 자동화 테스트 및 스크린샷 검증 완료
- [x] 랜딩페이지 및 인게임 상단 HUD에 앱 버전(`v1.0.7`) 배지 상시 표시 (`v1.0.7`)

### Phase 10: 모바일 스마트폰 반응형 레이아웃 및 터치 조종 최적화 (`v1.0.8`) — 완료
- [x] 모바일 뷰포트(`100dvh`, `< 1024px`)에서 좌·우 사이드바 중첩 방지 및 `🌌 3D 우주 조종` / `🚀 출항 · 우주지도` / `🪐 행성 목록` 3탭 전환 바 구현
- [x] 모바일 3D 우주 조종 모드에서 중앙 3D 우주 화면 확보 + 상단 플로팅 간편 출항 카드 및 미니 2D 우주지도 항법 레이더 상시 표시
- [x] 수동 비행 추진 버튼(`◀ A`, `▲ W 추진`, `▼ S`, `▶ D`, `🔥 Shift`) 모바일 멀티터치(`touchstart`/`touchend`/`touchcancel`) 완벽 지원 및 하단 시설 액션 바 가로 스크롤 최적화
