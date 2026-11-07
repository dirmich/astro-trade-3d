# AstroTrade 3D — 성간 자원 채집 및 교역 우주선 시뮬레이션 게임

`Three.js` + `Svelte` 프론트엔드와 `Bun.sh` + `Hono.js` + `SQLite / PostgreSQL` 백엔드로 구축된 3D 우주 자원 채집·교역 게임입니다.

## 핵심 특징
- **공유 루트 `.env`**: 프로젝트 루트의 `.env` 파일을 `[COMMON]`, `[BACKEND]`, `[FRONTEND]` 섹션으로 구분하여 Frontend와 Backend가 함께 참조합니다.
- **초기 30개 행성 & 사용자 증가 시 자동 행성 추가**: 그리스·로마 신화 및 태양계 행성들의 위성 이름(`Olympus Prime`, `Titan`, `Europa`, `Ganymede`, `Io`, `Callisto`, `Enceladus`, `Triton` 등)을 활용한 30개 초기 행성과 12종 자원이 시딩되며, 유저 수가 증가할수록 새로운 행성이 은하계 외곽에 자동 추가됩니다.
- **수요·공급 반비례 동적 가격**: 자원 재고가 풍부한 행성은 가격이 저렴하고, 희소한 행성은 가격이 최대 4.5배까지 상승합니다.
- **행성 시설 & 이벤트**: 교역소(Trading Post), 수리점 및 함선 개조소(Repair & Shipyard), 우주 술집(Space Tavern - 시세 루머, 선원 영입, 퀀텀 다이스 갬블, 랜덤 조우 이벤트)을 완비했습니다.
- **슈퍼유저 Admin 시스템**:
  - **Superuser 이메일**: `oldtv.cf@gmail.com`
  - **초기 비밀번호**: `AstroAdmin!2026#`
  - 행성 추가/수정, 자원 재고/시세 조정, 은하 이벤트 발령, 유저 유입 및 자동 행성 확장 시뮬레이션을 실시간 제어할 수 있습니다.

## 문서 목록 (`docs/`)
- [`docs/PRD.md`](./docs/PRD.md): 제품 요구사항 정의서
- [`docs/PLAN.md`](./docs/PLAN.md): 아키텍처 및 개발 계획서
- [`docs/TASK.md`](./docs/TASK.md): 세부 Subtask 및 버전별 Git 커밋 기록
- [`docs/MANUAL_AND_API.md`](./docs/MANUAL_AND_API.md): 실행 가이드 및 REST API 명세서
