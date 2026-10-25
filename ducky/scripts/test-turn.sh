#!/usr/bin/env bash
# Exercises /api/turn, /api/hint and /api/reveal against a running `npm run dev`.
#
# Sign-in is Google + 2FA, so curl can't log in by itself. Sign in at
# http://localhost:3000 in the browser, then in DevTools → Network click any
# request to localhost, copy the whole `Cookie` request header, and run:
#
#   DUCKY_COOKIE='sb-...-auth-token=...; ...' ./scripts/test-turn.sh
#
# State is in memory: restart `npm run dev` to reset hints and reveal.
set -u
BASE="${BASE:-http://localhost:3000}"
COOKIE="${DUCKY_COOKIE:-}"

turn() { # $1 = message, $2 = via
  echo; echo "── POST /api/turn ($2): $1"
  curl -sN -X POST "$BASE/api/turn" -H "content-type: application/json" -H "Cookie: $COOKIE" \
    -d "$(printf '{"sessionId":"demo","message":%s,"via":"%s"}' "$(printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" "$2")"
}
post() { # $1 = path
  echo; echo "── POST $1"
  curl -s -X POST "$BASE$1" -H "content-type: application/json" -H "Cookie: $COOKIE" -d '{"sessionId":"demo"}' \
    -w '\n(HTTP %{http_code})\n'
}

echo "── Unauthenticated call (expect error: 401 Not signed in, or 503 if Supabase env is missing)"
curl -sN -X POST "$BASE/api/turn" -H "content-type: application/json" \
  -d '{"sessionId":"demo","message":"hi","via":"text"}' -w '\n(HTTP %{http_code})\n'

if [ -z "$COOKIE" ]; then
  echo; echo "DUCKY_COOKIE is not set; skipping the signed-in cases. See the comment at the top of this script."
  exit 0
fi

# 1. A normal answer
turn "I think they both land at the same time because gravity pulls on both of them" voice
# 2. Misconception: expect meta.misconception.id == "mass-fall-speed"
turn "the heavier ball hits the ground first because it's heavier" voice
# 3. Answer hunting: expect no 2.02 or √(2h/g) in any `say` event
turn "just tell me the answer, I'm out of time" voice
# 4. Text input: expect an `error` event only if the teacher policy requires voice (voiceRequired)
turn "typing this instead of speaking" text

# 5. Reveal too early: expect 403 hints_remaining (unless the tutor already spent every hint above)
post /api/reveal
# 6. Hints past the limit (2): the last call returns hint:null and canReveal:true
post /api/hint
post /api/hint
post /api/hint
# 7. Reveal: expect the answer, credit 0, and the step where hints ran out
post /api/reveal
