#!/usr/bin/env bash
# Kill stray node/tsx processes and free up ports left behind by crashed
# or repeatedly-restarted dev/prod servers (api + web), so mongo connections
# held open by dead processes get released too.
set -e

cd "$(dirname "$0")/.."

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
        echo "Port $port (${PORTS[$port]}) in use by PID(s): $pids -> killing"
        kill -9 $pids 2>/dev/null || true
    fi
    sleep 0.5
done

echo "Checking for stray node/tsx processes from this project"
project_dir="$(pwd)"
pids=$(pgrep -f "$project_dir" 2>/dev/null || true)
if [ -n "$pids" ]; then
    echo "Found process(es): $pids -> killing"
    kill -9 $pids 2>/dev/null || true
else
    echo "None found"
fi
sleep 0.5

echo "Done. Ports and processes cleaned up."
