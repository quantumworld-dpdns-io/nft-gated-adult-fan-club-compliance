#!/bin/bash
set -euo pipefail

# ZAP Authenticated Scan
# Gets a JWT token first, then scans with auth headers
# Usage: ./zap-authenticated-scan.sh [target_url] [auth_endpoint] [email] [password]

TARGET_URL=${1:-http://localhost:8000}
AUTH_ENDPOINT=${2:-/api/auth/login/password}
EMAIL=${3:-admin@example.com}
PASSWORD=${4:-AdminPass123!}
ZAP_URL=${ZAP_URL:-http://localhost:8080}
API_KEY=${ZAP_API_KEY:-change-me}
REPORT_DIR="./owasp-zap/reports"

mkdir -p "$REPORT_DIR"

echo "=== ZAP Authenticated Security Scan ==="
echo "Target: $TARGET_URL"
echo "Auth Endpoint: $AUTH_ENDPOINT"
echo ""

# Step 1: Get authentication token
echo "Obtaining authentication token..."
AUTH_RESPONSE=$(curl -s -X POST "$TARGET_URL$AUTH_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo "$AUTH_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "WARNING: Failed to obtain auth token. Running unauthenticated scan."
  echo "Response: $AUTH_RESPONSE"
fi

echo "Token obtained: ${TOKEN:0:20}..."

# Wait for ZAP
for i in $(seq 1 30); do
  if curl -s "$ZAP_URL" > /dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then echo "ERROR: ZAP not ready"; exit 1; fi
  sleep 2
done

# Step 2: Configure ZAP with auth headers
if [ -n "$TOKEN" ]; then
  echo "Configuring ZAP authentication..."

  # Set auth header for ZAP
  curl -s "$ZAP_URL/JSON/ascan/action/setOptionBearerTokenString/?apikey=$API_KEY&bearerTokenString=$TOKEN" > /dev/null

  # Configure context with auth details
  curl -s "$ZAP_URL/JSON/context/action/newContext/?apikey=$API_KEY&contextName=authenticated-scan" > /dev/null

  # Include target URL in context
  curl -s "$ZAP_URL/JSON/context/action/includeInContext/?apikey=$API_KEY&contextName=authenticated-scan&regex=$TARGET_URL.*" > /dev/null

  # Set auth method to Bearer
  curl -s "$ZAP_URL/JSON/authentication/action/setAuthenticationMethod/?apikey=$API_KEY&contextName=authenticated-scan&authMethodName=bearer" > /dev/null
fi

# Step 3: Run spider scan with auth
echo "Starting authenticated spider scan..."
SPIDER_ID=$(curl -s "$ZAP_URL/JSON/spider/action/scanAsUser/?apikey=$API_KEY&url=$TARGET_URL&contextName=authenticated-scan" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scanId', '0'))" 2>/dev/null || echo "0")

while true; do
  STATUS=$(curl -s "$ZAP_URL/JSON/spider/view/status/?apikey=$API_KEY&scanId=$SPIDER_ID")
  PROGRESS=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status', '0'))" 2>/dev/null || echo "0")
  echo "Spider progress: $PROGRESS%"
  if [ "$PROGRESS" = "100" ]; then break; fi
  sleep 5
done

# Step 4: Run active scan with auth
echo "Starting authenticated active scan..."
SCAN_ID=$(curl -s "$ZAP_URL/JSON/ascan/action/scan/?apikey=$API_KEY&url=$TARGET_URL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scanId', '0'))" 2>/dev/null || echo "0")

while true; do
  STATUS=$(curl -s "$ZAP_URL/JSON/ascan/view/status/?apikey=$API_KEY&scanId=$SCAN_ID")
  PROGRESS=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status', '0'))" 2>/dev/null || echo "0")
  echo "Active scan progress: $PROGRESS%"
  if [ "$PROGRESS" = "100" ]; then break; fi
  sleep 10
done

# Generate reports
curl -s "$ZAP_URL/OTHER/core/other/htmlreport/?apikey=$API_KEY" > "$REPORT_DIR/zap-authenticated-report.html"
echo "HTML report: $REPORT_DIR/zap-authenticated-report.html"

curl -s "$ZAP_URL/JSON/reports/action/generate/?apikey=$API_KEY&title=NFTFanClub-Authenticated&template=traditional-json&reportDir=$(pwd)/$REPORT_DIR&reportFileName=zap-authenticated-report.json" > /dev/null
echo "JSON report: $REPORT_DIR/zap-authenticated-report.json"

echo ""
echo "=== Authenticated Scan Complete ==="
echo "Reports: $REPORT_DIR/"
