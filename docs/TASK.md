# TASK: AstroTrade 3D 세부 개발 체크리스트 및 버전 기록

- **문서 버전**: v1.0.1 (직접운행, 구역지도 상점, 멀티유저 해적전리품, 다국어, BGM 확장 완료)
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
