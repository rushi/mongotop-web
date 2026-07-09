#!/usr/bin/env bash
# Kill stray node/tsx processes and free up ports left behind by crashed
# or repeatedly-restarted dev/prod servers (api + web), so mongo connections
# held open by dead processes get released too.
#
# Sends SIGTERM first so the api's graceful shutdown handler (server.ts)
# can close MongoClient connections cleanly; only falls back to SIGKILL
# if a process ignores TERM.
set -e

cd "$(dirname "$0")/.."

TERM_WAIT_SECS=3

# Send TERM, wait up to TERM_WAIT_SECS for exit, then KILL survivors.
graceful_kill() {
    local pids="$1"
    kill -TERM $pids 2>/dev/null || true

    local waited=0
    while [ "$waited" -lt "$TERM_WAIT_SECS" ]; do
        local alive=""
        for pid in $pids; do
            kill -0 "$pid" 2>/dev/null && alive="$alive $pid"
        done
        [ -z "$alive" ] && return
        sleep 0.5
        waited=$((waited + 1))
    done

    for pid in $pids; do
        kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
    done
}

declare -A PORTS=(
    [7000]="web dev"
    [7001]="api dev"
    [7010]="web prod"
    [7011]="api prod"
)

echo "Checking ports: ${!PORTS[*]}"
for port in "${!PORTS[@]}"; do
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "Port $port (${PORTS[$port]}) in use by PID(s): $pids -> stopping"
        graceful_kill "$pids"
    fi
    sleep 0.5
done

echo "Checking for stray node/tsx processes from this project"
project_dir="$(pwd)"
pids=$(pgrep -f "$project_dir" 2>/dev/null || true)
if [ -n "$pids" ]; then
    echo "Found process(es): $pids -> stopping"
    graceful_kill "$pids"
else
    echo "None found"
fi
sleep 0.5

echo "Done. Ports and processes cleaned up."
