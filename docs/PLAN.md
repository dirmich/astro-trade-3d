# PLAN: AstroTrade 3D 아키텍처 및 개발 마스터 플랜

- **문서 버전**: v1.0.0
- **작성일**: 2026-11-07

---

## 1. 디렉토리 구조 (Monorepo Architecture)

```text
astro-trade-3d/
├── .env                        # Frontend & Backend 공유 루트 환경변수 파일
├── package.json                # 루트 워크스페이스 스크립트 (dev, build, seed, test)
├── README.md                   # 프로젝트 개요 및 빠른 시작 가이드
├── docs/                       # 전체 설계 및 운영 문서
│   ├── PRD.md                  # 제품 요구사항 정의서
│   ├── PLAN.md                 # 아키텍처 및 기술 구현 계획서
│   ├── TASK.md                 # 단계별 태스크 및 Git 버전 커밋 로그
│   └── MANUAL_AND_API.md       # 사용자/관리자 매뉴얼 및 API 명세서
├── backend/                    # Bun.sh + Hono.js 백엔드 서버
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Hono 서버 엔트리포인트 & 정적/CORS/스케줄러
│       ├── config/
│       │   └── env.ts          # 루트 ../.env 파서 및 타입 안전 설정 로더
│       ├── db/
│       │   ├── adapter.ts      # SQLite (초기 기본) & PostgreSQL 통합 DB 어댑터
│       │   ├── schema.ts       # 테이블 스키마 (users, planets, resources, planet_markets, events, logs)
│       │   └── seed.ts         # 12종 자원, 30개 초기 행성, 슈퍼유저(oldtv.cf@gmail.com) 시딩
│       ├── services/
│       │   ├── economy.ts      # 수요/공급 기반 가격 산출, 매수/매도 체결, 시세 변동 엔진
│       │   ├── galaxy.ts       # 사용자 증가 감지 및 신규 행성 자동 확장 알고리즘
│       │   └── events.ts       # 수리점, 술집 루머/퀘스트/선원/도박 이벤트 처리기
│       └── routes/
│           ├── auth.ts         # 로그인, 회원가입(자동 행성 확장 트리거 포함), 세션 검증
│           ├── game.ts         # 항해(워프), 궤도 채굴, 교역, 수리/개조, 술집 이벤트 API
│           └── admin.ts        # 슈퍼유저(oldtv.cf@gmail.com) 전용 행성/자원/이벤트/유저 관리 API
└── frontend/                   # Svelte + Three.js 프론트엔드 애플리케이션
    ├── package.json
    ├── vite.config.ts          # 루트 ../.env 로드 및 VITE_ 환경변수 주입 설정
    ├── index.html
    └── src/
        ├── main.ts
        ├── App.svelte          # 메인 레이아웃, HUD, 모달 라우팅, 사운드/알림 통합
        └── lib/
            ├── config/
            │   └── env.ts      # 공유 .env FRONTEND 설정 클라이언트
            ├── api/
            │   └── client.ts   # Hono REST API 클라이언트 & 오프라인/프리뷰 하이브리드 엔진
            ├── stores/
            │   └── gameStore.ts# Svelte 반응형 상태 (플레이어, 우주선, 행성, 시장, 로그)
            ├── three/
            │   ├── SpaceScene.ts     # Three.js WebGL 씬, PBR 조명, 은하 성운, 별자리, 궤도선
            │   ├── ShipBuilder.ts    # 정밀 다중 메쉬 우주선 모델 (엔진 플룸, 채굴 레이저, 실드)
            │   └── PlanetBuilder.ts  # 절차적 노이즈 텍스처 행성, 대기권 림 셰이더, 고리, 위성
            └── components/
                ├── TopHud.svelte         # 크레딧, 화물, 연료, 선체, 현재 행성, 빠른 이동 HUD
                ├── TradingPostModal.svelte # 행성 교역소 (재고 반비례 가격, 호가창, 차익 계산기)
                ├── RepairShopModal.svelte  # 수리점 & 함선 개조소 (선체 수리, 연료, 모듈 업그레이드)
                ├── TavernModal.svelte      # 우주 술집 (루머, 배달 의뢰, 선원 고용, 주사위 갬블)
                ├── StarMapModal.svelte     # 3D/2D 성간 항법 지도 & 무역로 수익 분석기
                ├── AdminModal.svelte       # 슈퍼유저(oldtv.cf@gmail.com) 전용 통합 관리 콘솔
                └── AuthModal.svelte        # 로그인 / 신규 파일럿 등록 / 슈퍼유저 원클릭 전환
```

---

## 2. 루트 `.env` 공유 설계

- 프로젝트 루트의 단일 `.env` 파일을 `backend`와 `frontend`가 함께 참조합니다.
- `.env` 내부는 주석 헤더와 접두어를 통해 명확히 구분합니다:
  1. **`# [COMMON / SHARED]`**: 앱 이름, 버전, 환경 모드(`APP_ENV`), 슈퍼유저 이메일(`SUPERUSER_EMAIL=oldtv.cf@gmail.com`).
  2. **`# [BACKEND]`**: 서버 포트(`BACKEND_PORT=4000`), DB 드라이버(`DB_CLIENT=sqlite` 또는 `postgres`), `SQLITE_DB_PATH`, `POSTGRES_URL`, `JWT_SECRET`, `SUPERUSER_INITIAL_PASSWORD=AstroAdmin!2026#`, 자동 행성 확장 비율(`PLANET_EXPANSION_USERS_PER_PLANET=2`).
  3. **`# [FRONTEND]`**: `VITE_API_BASE_URL`, `VITE_SUPERUSER_EMAIL`, `VITE_INITIAL_PLANET_COUNT=30`, `VITE_STARFIELD_DENSITY`, `VITE_ENABLE_REALISTIC_BLOOM`.

---

## 3. 사실적인 3D 우주 및 우주선 구현 전략 (Three.js)

1. **절차적 고해상도 행성 텍스처 & 대기 산란**:
   - 외부 이미지 파일에 의존하지 않고 Canvas2D Fractal Brownian Motion(fBm) 노이즈 및 밴드 생성기로 암석형, 가스형, 빙하형, 용암형, 해양형, 사막형, 정글형, 크리스탈형 8종의 고해상도 구면 텍스처와 범프맵을 생성합니다.
   - 행성 주변에 프레넬(Fresnel) 기반 대기권 글로우(Atmosphere Rim Halo)와 가스 행성 고리(Saturn/Rhea 스타일 다중 알파 링), 공전하는 소행성 벨트를 배치합니다.
2. **정밀 우주선 3D 모델링**:
   - 다중 기하 구조(주 선체 동체, 조종석 캐노피, 좌우 나셀 워프 엔진, 가변형 화물 포드, 회전 레이더 배열, 하부 채굴 레이저 터렛, 후방 플라즈마 추진 노즐)를 결합한 사실적 우주선 메쉬를 구성합니다.
   - 항해 속도에 비례하는 **이온 플룸(Ion Thruster Plume)** 파티클과 워프 시 **스타필드 스트레칭(Warp Tunnel)** 효과를 구현합니다.
3. **실시간 궤도 채굴 연출**:
   - 행성 근접 또는 소행성대에서 채굴 시 함선 터렛에서 목표 소행성/행성 궤도 광맥으로 고에너지 레이저 빔과 스파크 파티클이 방출되며, 열 게이지(Heat Gauge) 조절을 통해 몰입감 있는 손맛을 제공합니다.

---

## 4. 버전 관리 및 Git 커밋 계획

- **v0.1.0**: 프로젝트 초기화, `docs/` (`PRD.md`, `PLAN.md`, `TASK.md`, `MANUAL_AND_API.md`) 작성 완료.
- **v0.2.0**: 루트 `.env` 구성 및 `backend/` (Bun + Hono + SQLite/Postgres 어댑터 + 30개 행성/12종 자원 시드 + 교역/수리/술집/자동확장/Admin API) 구현 완료.
- **v0.3.0**: `frontend/` (Svelte + Three.js 3D 우주/행성/우주선 엔진 + 교역소/수리점/술집/성간지도/Admin UI) 구현 완료.
- **v1.0.0**: 통합 검증, 단일 파일 Canvas 인터랙티브 빌드(`astro_trade_3d.html`) 및 풀스택 아카이브(`astro_trade_3d_fullstack.zip`) 패키징 완료.
