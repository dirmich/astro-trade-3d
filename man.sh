#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT_DIR/.man"
PID_DIR="$RUN_DIR/pids"
LOG_DIR="$RUN_DIR/logs"
ENV_FILE="$ROOT_DIR/.env"

mkdir -p "$PID_DIR" "$LOG_DIR"

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="$(printf '%s' "$line" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      if [[ -n "$line" && ! "$line" =~ ^# ]]; then
        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
          local key="${BASH_REMATCH[1]}"
          local val="${BASH_REMATCH[2]}"
          val="${val%\"}"
          val="${val#\"}"
          val="${val%\'}"
          val="${val#\'}"
          export "$key"="$val"
        fi
      fi
    done < "$ENV_FILE"
  fi

  FRONTEND_PORT="${FRONTEND_PORT:-3000}"
  BACKEND_PORT="${BACKEND_PORT:-8000}"
}

usage() {
  cat <<'EOF'
사용법:
  ./man.sh [start|stop|status|restart] [backend|frontend|none]

인자:
  action  start, stop, status, restart 중 하나 (기본값: status)
  target  backend, frontend, none 중 하나 (생략 또는 none은 backend와 frontend 모두 대상)
EOF
}

port_for() {
  case "$1" in
    frontend) printf '%s\n' "$FRONTEND_PORT" ;;
    backend) printf '%s\n' "$BACKEND_PORT" ;;
    *) echo "알 수 없는 서비스입니다: $1" >&2; exit 1 ;;
  esac
}

command_for() {
  case "$1" in
    frontend) printf '%s\n' "bun run --cwd $ROOT_DIR/frontend dev -- --port $FRONTEND_PORT" ;;
    backend) printf '%s\n' "bun $ROOT_DIR/backend/src/index.ts" ;;
    *) echo "알 수 없는 서비스입니다: $1" >&2; exit 1 ;;
  esac
}

pid_file_for() {
  printf '%s/%s.pid\n' "$PID_DIR" "$1"
}

log_file_for() {
  printf '%s/%s.log\n' "$LOG_DIR" "$1"
}

err_log_file_for() {
  printf '%s/%s.err.log\n' "$LOG_DIR" "$1"
}

port_pids() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null | tr -d '\r' | sed '/^$/d' || true
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ano 2>/dev/null | grep "LISTENING" | grep -E "[.:]$port([[:space:]]|$)" | awk '{print $NF}' | sort -u | tr -d '\r' | sed '/^$/d' || true
  else
    true
  fi
}

is_running_pid() {
  local pid="${1:-}"
  [[ -z "$pid" ]] && return 1
  if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" ]]; then
    tasklist //FI "PID eq $pid" //NH 2>/dev/null | grep -q "$pid"
  else
    kill -0 "$pid" 2>/dev/null
  fi
}

kill_pid() {
  local pid="${1:-}"
  [[ -z "$pid" ]] && return 0
  if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" ]]; then
    taskkill //F //T //PID "$pid" >/dev/null 2>&1 || kill -9 "$pid" 2>/dev/null || true
  else
    kill "$pid" 2>/dev/null || true
    sleep 1
    if is_running_pid "$pid"; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
}

start_service() {
  local service="$1"
  local port
  local pid_file
  local log_file
  local err_file
  port="$(port_for "$service")"
  pid_file="$(pid_file_for "$service")"
  log_file="$(log_file_for "$service")"
  err_file="$(err_log_file_for "$service")"

  local existing_pids
  existing_pids="$(port_pids "$port" | tr '\n' ' ')"
  if [[ -f "$pid_file" ]]; then
    local tracked_pid
    tracked_pid="$(cat "$pid_file" | tr -d '\r')"
    if is_running_pid "$tracked_pid"; then
      echo "$service: 이미 실행 중입니다 (PID: $tracked_pid, 포트: $port)"
      return 0
    fi
    rm -f "$pid_file"
  fi

  if [[ -n "${existing_pids// }" ]]; then
    echo "$service: 포트 $port에서 기존 프로세스 감지됨 ($existing_pids). 종료 후 재기동합니다..."
    for p in $existing_pids; do
      kill_pid "$p"
    done
    sleep 1
  fi

  echo "$service 시작 중 (포트: $port)..."
  : > "$log_file"
  : > "$err_file"

  if [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" ]]; then
    local win_cwd
    win_cwd="$(cygpath -w "$ROOT_DIR")"
    local win_log
    win_log="$(cygpath -w "$log_file")"
    local win_err
    win_err="$(cygpath -w "$err_file")"
    local temp_ps1="$RUN_DIR/start_${service}.ps1"
    local win_temp_ps1
    win_temp_ps1="$(cygpath -w "$temp_ps1")"

    if [[ "$service" == "backend" ]]; then
      cat <<EOF > "$temp_ps1"
\$env:BACKEND_PORT = '$BACKEND_PORT'
Start-Process bun -ArgumentList 'backend/src/index.ts' -WorkingDirectory '$win_cwd' -RedirectStandardOutput '$win_log' -RedirectStandardError '$win_err' -WindowStyle Hidden
EOF
    else
      cat <<EOF > "$temp_ps1"
\$env:FRONTEND_PORT = '$FRONTEND_PORT'
\$env:BACKEND_PORT = '$BACKEND_PORT'
Start-Process bun -ArgumentList 'run', '--cwd', 'frontend', 'dev', '--', '--port', '$FRONTEND_PORT' -WorkingDirectory '$win_cwd' -RedirectStandardOutput '$win_log' -RedirectStandardError '$win_err' -WindowStyle Hidden
EOF
    fi

    powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$win_temp_ps1" >/dev/null 2>&1
    rm -f "$temp_ps1"
  else
    local cmd
    cmd="$(command_for "$service")"
    (
      cd "$ROOT_DIR"
      nohup bash -lc "$cmd" >"$log_file" 2>"$err_file" < /dev/null &
      echo $! > "$pid_file"
    )
  fi

  local elapsed=0
  local detected_pid=""
  while [[ $elapsed -lt 30 ]]; do
    sleep 0.3
    detected_pid="$(port_pids "$port" | head -n 1 | tr -d '\r')"
    if [[ -n "$detected_pid" ]]; then
      break
    fi
    elapsed=$((elapsed + 1))
  done

  if [[ -n "$detected_pid" ]]; then
    echo "$detected_pid" > "$pid_file"
    echo "$service: 시작 완료 (PID: $detected_pid, 포트: $port, 로그: $log_file)"
  else
    echo "$service: 시작 실패 (포트 $port 리슨 타임아웃). 에러 로그($err_file)를 확인하세요." >&2
    return 1
  fi
}

stop_service() {
  local service="$1"
  local port
  local pid_file
  port="$(port_for "$service")"
  pid_file="$(pid_file_for "$service")"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" | tr -d '\r')"
    if is_running_pid "$pid"; then
      echo "$service: 종료 중 (PID: $pid)..."
      kill_pid "$pid"
    fi
    rm -f "$pid_file"
  fi

  local pids
  pids="$(port_pids "$port" | tr '\n' ' ')"
  if [[ -n "${pids// }" ]]; then
    for p in $pids; do
      kill_pid "$p"
    done
  fi
  echo "$service: 중지됨 (포트: $port)"
}

status_service() {
  local service="$1"
  local port
  local pid_file
  port="$(port_for "$service")"
  pid_file="$(pid_file_for "$service")"

  local pids
  pids="$(port_pids "$port" | tr '\n' ' ')"
  local tracked=""
  if [[ -f "$pid_file" ]]; then
    tracked="$(cat "$pid_file" | tr -d '\r')"
  fi

  if [[ -n "${pids// }" ]]; then
    echo "$service: 실행 중 (포트: $port, PID: ${tracked:-$pids})"
  else
    echo "$service: 중지됨 (포트: $port)"
  fi
}

restart_service() {
  local service="$1"
  stop_service "$service"
  sleep 1
  start_service "$service"
}

targets_for() {
  local target="${1:-none}"
  case "$target" in
    ""|none) printf '%s\n%s\n' backend frontend ;;
    backend|frontend) printf '%s\n' "$target" ;;
    *) usage; exit 1 ;;
  esac
}

main() {
  load_env
  local action="${1:-status}"
  local target="${2:-none}"

  case "$action" in
    start|stop|status|restart) ;;
    -h|--help|help) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac

  while IFS= read -r service; do
    case "$action" in
      start) start_service "$service" ;;
      stop) stop_service "$service" ;;
      status) status_service "$service" ;;
      restart) restart_service "$service" ;;
    esac
  done < <(targets_for "$target")
}

main "$@"
