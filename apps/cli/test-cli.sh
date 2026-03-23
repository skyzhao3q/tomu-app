#!/usr/bin/env bash
# test-cli.sh — Integration smoke tests for every tomu CLI command.
# Starts a local mock HTTP server, runs each command, checks output.
#
# Usage:
#   cd apps/cli
#   ./test-cli.sh
#
# Exit code: 0 if all tests pass, 1 if any fail.

set -euo pipefail
cd "$(dirname "$0")"

TOMU="node_modules/.bin/tsx src/index.ts"
PASS=0
FAIL=0
FAILURES=()

# ── Colours ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Start mock server and capture port ────────────────────────────────────────
MOCK_OUT=$(mktemp)
node test-mock-server.mjs 0 >>"$MOCK_OUT" 2>/dev/null &
MOCK_PID=$!
MOCK_PORT=""

# Poll for the READY line (max 3 seconds)
for _i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  _line=$(head -1 "$MOCK_OUT" 2>/dev/null) || true
  if [[ "$_line" == READY* ]]; then
    MOCK_PORT="${_line#READY }"
    break
  fi
  sleep 0.1
done

if [[ -z "${MOCK_PORT}" ]]; then
  echo "ERROR: mock server did not start" >&2
  cat "$MOCK_OUT" >&2 || true
  kill "$MOCK_PID" 2>/dev/null || true
  rm -f "$MOCK_OUT"
  exit 1
fi

export TOMU_API_URL="http://127.0.0.1:${MOCK_PORT}"

# ── Cleanup on exit ────────────────────────────────────────────────────────────
cleanup() {
  kill "$MOCK_PID" 2>/dev/null || true
  rm -f "$MOCK_OUT" 2>/dev/null || true
}
trap cleanup EXIT

# ── Helpers ────────────────────────────────────────────────────────────────────
section() {
  echo ""
  echo -e "${CYAN}${BOLD}── $1 ──${NC}"
}

# assert_contains <label> <expected_string> "<full shell command>"
assert_contains() {
  local label="$1"
  local expected="$2"
  local cmd="$3"
  local out
  out=$(eval "$cmd" 2>&1) || true
  if echo "$out" | grep -qF "$expected"; then
    echo -e "  ${GREEN}PASS${NC}  $label"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  $label"
    echo -e "        Expected to contain: ${YELLOW}${expected}${NC}"
    echo -e "        Got: $out"
    FAIL=$((FAIL + 1))
    FAILURES+=("$label")
  fi
}

# assert_json <label> "<full shell command>"  — output must be valid JSON
assert_json() {
  local label="$1"
  local cmd="$2"
  local out
  out=$(eval "$cmd" 2>&1) || true
  if echo "$out" | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{JSON.parse(d);process.exit(0)}catch{process.exit(1)}
    });
  " 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC}  $label (valid JSON)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  $label (invalid JSON)"
    echo -e "        Got: $out"
    FAIL=$((FAIL + 1))
    FAILURES+=("$label")
  fi
}

# assert_exit0 <label> "<full shell command>"
assert_exit0() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo -e "  ${GREEN}PASS${NC}  $label (exit 0)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  $label (expected exit 0)"
    FAIL=$((FAIL + 1))
    FAILURES+=("$label")
  fi
}

# ── Tests ──────────────────────────────────────────────────────────────────────

section "Help / Top-level"
assert_exit0  "--help"              "$TOMU --help"
assert_exit0  "browser --help"      "$TOMU browser --help"
assert_exit0  "heartbeat --help"    "$TOMU heartbeat --help"
assert_exit0  "cron --help"         "$TOMU cron --help"
assert_exit0  "emotion --help"      "$TOMU emotion --help"
assert_exit0  "image --help"        "$TOMU image --help"
assert_exit0  "sing --help"         "$TOMU sing --help"

section "Status / Health / Version"
assert_contains "status"          "API Server is running"   "$TOMU status"
assert_contains "health (alias)"  "API Server is running"   "$TOMU health"
assert_contains "version"         "tomu v"                  "$TOMU version"

section "Config"
assert_contains "config list"   "chat"      "$TOMU config list"
assert_contains "config get"    "gpt-4"     "$TOMU config get chat.defaultModel"
assert_contains "config set"    "Updated"   "$TOMU config set chat.defaultModel mymodel"

section "Providers (shorthand)"
assert_contains "providers"             "OpenAI"   "$TOMU providers"
assert_json     "providers --json"                 "$TOMU providers --json"
assert_contains "providers <id> models" "gpt-4"    "$TOMU providers p1 models"

section "Provider (subcommand)"
assert_json     "provider list --json"                  "$TOMU provider list --json"
assert_contains "provider add"   "added"                "$TOMU provider add --name Test --type openai --api-key sk-test"
assert_contains "provider delete" "deleted"             "$TOMU provider delete p1"
assert_contains "provider models" "gpt-4"               "$TOMU provider models p1"

section "Models"
assert_contains "models"         "gpt-4"        "$TOMU models"
assert_json     "models --json"                 "$TOMU models --json"
assert_contains "model set"      "Default model" "$TOMU model set openai:gpt-4"

section "Threads"
assert_contains "threads"              "t1"          "$TOMU threads"
assert_json     "threads --json"                     "$TOMU threads --json"
assert_contains "thread create"        "Created"     "$TOMU thread create 'Test Thread'"
assert_contains "thread delete"        "Deleted"     "$TOMU thread delete t1"
assert_contains "thread search"        "t1"          "$TOMU thread search hello"
assert_contains "thread compact"       "compacted"   "$TOMU thread compact t1"
assert_contains "thread messages"      "[user]"      "$TOMU thread messages t1"
assert_contains "thread switch"        "Switched"    "$TOMU thread switch t1"

section "Memory"
assert_contains "memory list"    "test"            "$TOMU memory list"
assert_contains "memory stats"   "Total memories"  "$TOMU memory stats"
assert_contains "memory search"  "test"            "$TOMU memory search query"
assert_contains "memory add"     "Memory added"    "$TOMU memory add 'test content'"
assert_contains "memory delete"  "deleted"         "$TOMU memory delete m1"

section "Voices"
assert_contains "voices"         "Alloy"   "$TOMU voices"
assert_json     "voices --json"            "$TOMU voices --json"

section "Image"
assert_contains "image models"          "dall-e-3"       "$TOMU image models"
assert_contains "image generate"        "Image generated" "$TOMU image generate 'a sunset'"
assert_json     "image generate --json"                  "$TOMU image generate 'a cat' --json"
assert_contains "image edit"            "Image edited"   "$TOMU image edit 'add a rainbow'"

section "Skill"
assert_contains "skill list"      "web-search"    "$TOMU skill list"
assert_contains "skill search"    "web-search"    "$TOMU skill search web"
assert_contains "skill find"      "web-search"    "$TOMU skill find web"
assert_contains "skill toggle"    "disabled"      "$TOMU skill toggle s1"
assert_contains "skill uninstall" "uninstalled"   "$TOMU skill uninstall s1"
assert_exit0    "skill install --help"            "$TOMU skill install --help"
assert_exit0    "skill update --help"             "$TOMU skill update --help"

section "Heartbeat"
assert_contains "heartbeat (default)"   "enabled"    "$TOMU heartbeat"
assert_contains "heartbeat status"      "enabled"    "$TOMU heartbeat status"
assert_contains "heartbeat config"      "interval"   "$TOMU heartbeat config"
assert_contains "heartbeat enable"      "enabled"    "$TOMU heartbeat enable"
assert_contains "heartbeat disable"     "disabled"   "$TOMU heartbeat disable"
assert_contains "heartbeat interval"    "interval"   "$TOMU heartbeat interval 15"
assert_contains "heartbeat patrol"      "Patrol"     "$TOMU heartbeat patrol enable"

section "Cron"
assert_contains "cron list"     "daily"       "$TOMU cron list"
assert_json     "cron list --json"            "$TOMU cron list --json"
assert_contains "cron add"      "added"       "$TOMU cron add test-job cron '0 * * * *'"
assert_contains "cron remove"   "removed"     "$TOMU cron remove c1"
assert_contains "cron run"      "triggered"   "$TOMU cron run c1"
assert_contains "cron enable"   "enabled"     "$TOMU cron enable c1"
assert_contains "cron disable"  "disabled"    "$TOMU cron disable c1"
assert_contains "cron history"  "success"     "$TOMU cron history c1"

section "Workspace"
assert_contains "workspace list"  "default"    "$TOMU workspace list"
assert_contains "workspace set"   "path set"   "$TOMU workspace set w1 /new/path"

section "Update"
assert_contains "update (default)"  "up to date"  "$TOMU update"
assert_contains "update check"      "up to date"  "$TOMU update check"
assert_contains "update download"   "Downloaded"  "$TOMU update download"
assert_contains "update install"    "Installed"   "$TOMU update install"

section "DM / Msg"
assert_contains "dm"          "DM sent"   "$TOMU dm user123 'Hello there'"
assert_contains "msg delete"  "deleted"   "$TOMU msg delete chat1 msg42"

section "Sing"
assert_contains "sing generate"         "Song generated"  "$TOMU sing generate 'a happy song'"
assert_json     "sing generate --json"                    "$TOMU sing generate 'test song' --json"
assert_contains "sing config"           "configured"      "$TOMU sing config my-piapi-key"

section "Emotion"
assert_contains "emotion (default)"     "Mood"      "$TOMU emotion"
assert_contains "emotion status"        "Mood"      "$TOMU emotion status"
assert_json     "emotion status --json"             "$TOMU emotion status --json"
assert_contains "emotion set-base"      "updated"   "$TOMU emotion set-base happy 0.8 0.9 'feeling good'"
assert_contains "emotion set-context"   "set for"   "$TOMU emotion set-context chat1 curious 0.7 'question'"
assert_json     "emotion get"                       "$TOMU emotion get"
assert_json     "emotion get chatId"                "$TOMU emotion get chat1"

section "Browser"
assert_contains "browser status"      "connected"    "$TOMU browser status"
assert_contains "browser tabs"        "Google"       "$TOMU browser tabs"
assert_contains "browser open"        "Opened tab"   "$TOMU browser open"
assert_contains "browser open <url>"  "Opened tab"   "$TOMU browser open https://example.com"
assert_contains "browser goto"        "Navigated"    "$TOMU browser goto tab1 https://example.com"
assert_contains "browser click"       "Clicked"      "$TOMU browser click tab1 '.btn'"
assert_contains "browser type"        "Typed"        "$TOMU browser type tab1 '.input' 'hello world'"
assert_contains "browser screenshot"  "/tmp"         "$TOMU browser screenshot tab1"
assert_contains "browser read"        "Page Title"   "$TOMU browser read tab1"
assert_json     "browser read-dom"                   "$TOMU browser read-dom tab1"
assert_contains "browser eval"        "42"           "$TOMU browser eval tab1 'document.title.length'"
assert_contains "browser scroll"      "Scrolled"     "$TOMU browser scroll tab1 down 300"
assert_contains "browser back"        "back"         "$TOMU browser back tab1"
assert_contains "browser forward"     "forward"      "$TOMU browser forward tab1"

section "Usage"
assert_contains "usage"  "Requests"  "$TOMU usage"

section "Export / Import"
EXPORT_FILE="/tmp/tomu-test-export-$$.json"
assert_contains "export"   "Exported"   "$TOMU export --output $EXPORT_FILE"
echo '{"threads":[],"memories":[],"settings":{}}' > "$EXPORT_FILE"
assert_contains "import"   "Imported"   "$TOMU import --file $EXPORT_FILE"
rm -f "$EXPORT_FILE"

section "Soul"
assert_exit0    "soul (show)"              "$TOMU soul"
assert_contains "soul set"   "updated"    "$TOMU soul set 'Test personality'"
assert_contains "soul append-trait" "Trait" "$TOMU soul append-trait 'always helpful'"
assert_exit0    "soul edit --help"         "$TOMU soul edit --help"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}────────────────────────────────────────${NC}"
TOTAL=$((PASS + FAIL))
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All $TOTAL tests passed!${NC}"
else
  echo -e "${RED}${BOLD}$FAIL/$TOTAL tests FAILED${NC}"
  echo ""
  echo -e "${RED}Failed tests:${NC}"
  for f in "${FAILURES[@]}"; do
    echo -e "  • $f"
  done
fi
echo ""

[[ $FAIL -eq 0 ]]
