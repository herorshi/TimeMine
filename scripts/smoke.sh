#!/usr/bin/env bash
# Smoke: login as each role and GET every main endpoint. Usage: scripts/smoke.sh [api_base]
API=${1:-http://localhost:4000/api}
tok() { curl -s -X POST "$API/auth/login" -H 'content-type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'; }
EMP=$(tok somchai@timemint.local emp123); ADM=$(tok admin@timemint.local admin123); EXE=$(tok exec@timemint.local exec123)
fail=0
hit() { local who=$1 t=$2 path=$3; code=$(curl -s -o /tmp/smoke.out -w '%{http_code}' -H "Authorization: Bearer $t" "$API$path"); 
  if [ "$code" = 200 ]; then echo "ok   $who $path"; else echo "FAIL $who $path -> $code $(head -c 160 /tmp/smoke.out)"; fail=1; fi; }
M=$(date +%Y-%m); Y=$(date +%Y)
for p in /auth/me /dashboard/me /attendance/today /attendance/me "/attendance/me/late-summary?month=$M" /face/status /leaves/types /leaves/me /leaves/me/balance /ot/me "/ot/me/summary?month=$M" "/holidays?year=$Y" /holidays/years /announcements /users/me /settings /warnings/me; do hit emp "$EMP" "$p"; done
for p in /attendance /leaves /ot /users /warnings "/reports/attendance?from=$Y-01-01&to=$Y-12-31" "/reports/leaves?from=$Y-01-01&to=$Y-12-31" "/reports/ot?from=$Y-01-01&to=$Y-12-31" "/reports/payroll?month=$M"; do hit admin "$ADM" "$p"; done
hit exec "$EXE" "/stats/overview?year=$Y"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $EMP" "$API/users"); [ "$code" = 403 ] && echo "ok   emp blocked from /users (403)" || { echo "FAIL emp /users -> $code (want 403)"; fail=1; }
exit $fail
