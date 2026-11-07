#!/bin/bash
# AstroTrade 3D - dev 배포 스크립트
# dev ~/0.service/astro-trade/deploy.sh
# 사용법:
#   ./deploy.sh          - 모든 서비스 재배포 (기본값)
#   ./deploy.sh frontend - Frontend 서비스만 재배포
#   ./deploy.sh backend  - Backend 서비스만 재배포
#
# 주의: maru-estate deploy.sh와 달리 .env.prod를 셸에 source하지 않는다
# (비밀값의 $ 등이 셸 확장을 타는 것을 방지). compose에는 --env-file로 넘긴다.
# DB 초기화/마이그레이션 단계가 실패하면 "완료"로 찍지 않고 즉시 종료한다.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()    { echo -e "${GREEN}ℹ️  $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }

SERVICE=${1:-all}
if [ "$SERVICE" != "frontend" ] && [ "$SERVICE" != "backend" ] && [ "$SERVICE" != "all" ]; then
    log_error "잘못된 서비스: $SERVICE (frontend|backend|all)"
    exit 1
fi

ENV_FILE=".env.prod"
if [ ! -f "$ENV_FILE" ]; then
    log_error "$ENV_FILE 파일이 존재하지 않습니다."
    exit 1
fi

# .env.prod에서 값 하나만 읽는다 (source/eval 없이, 따옴표 제거)
env_val() {
    grep -E "^$1=" "$ENV_FILE" | head -n 1 | cut -d= -f2- | tr -d "\"'" | tr -d '\r'
}

POSTGRES_DB=$(env_val POSTGRES_DB)
POSTGRES_USER=$(env_val POSTGRES_USER)
if [ -z "$POSTGRES_DB" ] || [ -z "$POSTGRES_USER" ]; then
    log_error ".env.prod에 POSTGRES_DB/POSTGRES_USER가 없습니다."
    exit 1
fi

BACKEND_IMAGE="dirmich/astrob:latest"
FRONTEND_IMAGE="dirmich/astro:latest"
COMPOSE_FILE="docker-compose.yml.deploy"

if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "$COMPOSE_FILE 파일이 존재하지 않습니다."
    exit 1
fi

docker network inspect frontend >/dev/null 2>&1 || docker network create frontend
docker network inspect backend >/dev/null 2>&1 || docker network create backend

# PostgreSQL DB 초기화 (공용 postgres 컨테이너, DB astrotrade)
init_database() {
    log_info "PostgreSQL 컨테이너 확인 중..."
    if ! docker ps --format '{{.Names}}' | grep -qx "postgres"; then
        log_error "PostgreSQL 컨테이너(postgres)가 실행 중이지 않습니다."
        exit 1
    fi

    log_info "데이터베이스 '$POSTGRES_DB' 존재 확인 중..."
    DB_EXISTS=$(docker exec postgres psql -U "$POSTGRES_USER" -tAc "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'") || {
        log_error "PostgreSQL 조회 실패 (psql 종료 코드 $?)"
        exit 1
    }
    DB_EXISTS=$(echo "$DB_EXISTS" | tr -d '[:space:]')
    if [ "$DB_EXISTS" = "1" ]; then
        log_info "데이터베이스 '$POSTGRES_DB' 이미 존재합니다."
    else
        log_info "데이터베이스 '$POSTGRES_DB' 생성 중..."
        docker exec postgres psql -U "$POSTGRES_USER" -c "CREATE DATABASE \"$POSTGRES_DB\"" || {
            log_error "데이터베이스 '$POSTGRES_DB' 생성 실패"
            exit 1
        }
        log_success "데이터베이스 '$POSTGRES_DB' 생성 완료!"
    fi
    # 스키마/시드는 백엔드 기동 시 자동 생성된다 (adapter + seedDatabaseIfNeeded).
}

deploy_service() {
    local service_name=$1   # backend|frontend (compose 서비스명)
    local container_name=$2 # astrob|astro
    local image=$3

    log_info "[$service_name] 이미지 확인 중... ($image)"
    if ! docker pull "$image"; then
        log_warn "[$service_name] pull 실패 — 로컬 이미지로 배포를 계속합니다."
        if ! docker image inspect "$image" >/dev/null 2>&1; then
            log_error "[$service_name] 로컬 이미지 $image 도 없습니다. 빌드 후 다시 실행하세요."
            exit 1
        fi
    fi

    log_info "[$service_name] 서비스 시작 중..."
    docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps "$service_name"

    log_info "[$service_name] 헬스체크 대기 중..."
    sleep 10
    if docker ps --format '{{.Names}}' | grep -qx "$container_name"; then
        log_success "[$service_name] 배포 성공!"
        docker logs --tail=20 "$container_name" || true
    else
        log_error "[$service_name] 배포 실패!"
        docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=50 "$service_name" || true
        exit 1
    fi
}

log_info "========================================="
log_info "AstroTrade 3D dev 배포 (대상: $SERVICE)"
log_info "========================================="

if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "backend" ]; then
    init_database
    deploy_service "backend" "astrob" "$BACKEND_IMAGE"
fi
if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "frontend" ]; then
    deploy_service "frontend" "astro" "$FRONTEND_IMAGE"
fi

log_info "사용하지 않는 Docker 이미지 정리 중..."
docker image prune -f || true

log_success "========================================="
log_success "배포 완료!"
log_success "========================================="
docker ps --filter "name=astro" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
log_info "Frontend: https://astro.lab.highmaru.com"
log_info "Backend health: https://astrob.lab.highmaru.com/api/health"
