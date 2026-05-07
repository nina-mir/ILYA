#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="/tmp/ilya-phase4-smoke-cookies.txt"
EMAIL="phase4-smoke@example.com"

rm -f "$COOKIE_JAR"

echo "Health check..."
curl -fsS "$BASE_URL/health" > /dev/null

echo "Send code..."
curl -fsS -c "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" \
  "$BASE_URL/api/auth/send-code"

echo
read -rp "Enter code printed by API: " CODE

echo "Verify code..."
curl -fsS -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}" \
  "$BASE_URL/api/auth/verify-code" > /dev/null

echo "Sign up reader..."
curl -fsS -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE_URL/api/sign-up-reader" > /dev/null

echo "Seed edition..."
SEED_RESPONSE=$(curl -fsS -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -d '{"gutenbergId":"1342","title":"Pride and Prejudice","author":"Jane Austen"}' \
  "$BASE_URL/api/dev/seed-edition")

echo "$SEED_RESPONSE"
BOOK_ID=$(node -e "const x=JSON.parse(process.argv[1]); console.log(x.id)" "$SEED_RESPONSE")

echo "Fetch library..."
curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/library" > /dev/null

echo "Fetch edition..."
curl -fsS -b "$COOKIE_JAR" "$BASE_URL/api/editions/$BOOK_ID" > /dev/null

echo "Save edition..."
curl -fsS -b "$COOKIE_JAR" \
  -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"markdownContent":"## Smoke Test\n\nSaved successfully."}' \
  "$BASE_URL/api/editions/$BOOK_ID" > /dev/null

echo "Withdraw edition..."
curl -fsS -b "$COOKIE_JAR" \
  -X DELETE \
  "$BASE_URL/api/editions/$BOOK_ID" > /dev/null

echo "Phase 4 smoke test passed."
