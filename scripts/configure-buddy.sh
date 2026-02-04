#!/usr/bin/env bash
#
# Script to programmatically configure an OpenClaw buddy via the setup API
# Usage: ./configure-buddy.sh <buddy-url> <setup-password> <config-json-file>
#
# Example config JSON:
# {
#   "flow": "quickstart",
#   "authChoice": "gemini-api-key",
#   "authSecret": "$GEMINI_API_KEY",
#   "model": "google/gemini-2.0-flash-exp",
#   "telegramToken": "$TELEGRAM_BOT_TOKEN"
# }

set -euo pipefail

BUDDY_URL="${1:-}"
SETUP_PASSWORD="${2:-}"
CONFIG_FILE="${3:-}"

if [[ -z "$BUDDY_URL" ]] || [[ -z "$SETUP_PASSWORD" ]] || [[ -z "$CONFIG_FILE" ]]; then
  echo "Usage: $0 <buddy-url> <setup-password> <config-json-file>"
  echo ""
  echo "Example:"
  echo "  $0 https://roel-or-galahad-production.up.railway.app mypassword galahad-config.json"
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: Config file not found: $CONFIG_FILE"
  exit 1
fi

# Read and expand environment variables in JSON
CONFIG=$(envsubst < "$CONFIG_FILE")

echo "🔧 Configuring buddy at: $BUDDY_URL"
echo "📋 Using config from: $CONFIG_FILE"
echo ""

# First check status
echo "1️⃣ Checking current status..."
STATUS_RESPONSE=$(curl -s -u ":$SETUP_PASSWORD" \
  "$BUDDY_URL/setup/api/status")

CONFIGURED=$(echo "$STATUS_RESPONSE" | jq -r '.configured // false')
echo "   Configured: $CONFIGURED"

if [[ "$CONFIGURED" == "true" ]]; then
  echo "⚠️  Buddy is already configured!"
  echo "   To reconfigure, reset first via the UI at: $BUDDY_URL/setup"
  exit 0
fi

# Run the setup
echo ""
echo "2️⃣ Running setup with provided configuration..."
SETUP_RESPONSE=$(curl -s -u ":$SETUP_PASSWORD" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$CONFIG" \
  "$BUDDY_URL/setup/api/run")

OK=$(echo "$SETUP_RESPONSE" | jq -r '.ok // false')
OUTPUT=$(echo "$SETUP_RESPONSE" | jq -r '.output // "No output"')

echo ""
echo "📤 Setup Response:"
echo "$OUTPUT"
echo ""

if [[ "$OK" == "true" ]]; then
  echo "✅ Buddy configured successfully!"
  echo ""
  echo "3️⃣ Running doctor check..."
  DOCTOR_RESPONSE=$(curl -s -u ":$SETUP_PASSWORD" \
    -X POST \
    "$BUDDY_URL/setup/api/doctor")
  
  DOCTOR_OK=$(echo "$DOCTOR_RESPONSE" | jq -r '.ok // false')
  DOCTOR_OUTPUT=$(echo "$DOCTOR_RESPONSE" | jq -r '.output // "No output"')
  
  echo "$DOCTOR_OUTPUT"
  
  if [[ "$DOCTOR_OK" == "true" ]]; then
    echo ""
    echo "🎉 All done! Your buddy is ready to use."
    echo "   Access it at: $BUDDY_URL"
  else
    echo ""
    echo "⚠️  Setup succeeded but doctor found issues. Check the output above."
  fi
else
  echo "❌ Setup failed! Check the output above for errors."
  exit 1
fi
