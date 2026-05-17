#!/bin/bash
set -euo pipefail

# ZAP API Scan using OpenAPI specification
# Usage: ./zap-api-scan.sh [target_url] [openapi_spec_url]

TARGET_URL=${1:-http://localhost:8000}
OPENAPI_SPEC=${2:-http://localhost:8000/openapi.json}
ZAP_URL=${ZAP_URL:-http://localhost:8080}
API_KEY=${ZAP_API_KEY:-change-me}
REPORT_DIR="./owasp-zap/reports"
CONTEXT_FILE="./owasp-zap/context.json"
POLICY_FILE="./owasp-zap/zap-api-scan-policy.json"

mkdir -p "$REPORT_DIR"

echo "=== ZAP API Scan ==="
echo "Target: $TARGET_URL"
echo "OpenAPI Spec: $OPENAPI_SPEC"
echo "ZAP: $ZAP_URL"
echo ""

# Wait for ZAP
for i in $(seq 1 30); do
  if curl -s "$ZAP_URL" > /dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then echo "ERROR: ZAP not ready"; exit 1; fi
  sleep 2
done

# Import OpenAPI spec
echo "Importing OpenAPI spec..."
IMPORT_RESULT=$(curl -s "$ZAP_URL/JSON/openapi/action/importUrl/?apikey=$API_KEY&url=$OPENAPI_SPEC")
echo "Import result: $IMPORT_RESULT"

# Load scan policy if exists
if [ -f "$POLICY_FILE" ]; then
  echo "Loading scan policy..."
  POLICY=$(cat "$POLICY_FILE")
  POLICY_ID=$(curl -s "$ZAP_URL/JSON/ascan/action/addScanPolicy/?apikey=$API_KEY&scanPolicyName=api-policy" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scanPolicyId', '1'))" 2>/dev/null || echo "1")
  echo "Policy ID: $POLICY_ID"
fi

# Load context if exists
if [ -f "$CONTEXT_FILE" ]; then
  echo "Loading context..."
  curl -s -X POST "$ZAP_URL/JSON/context/action/importContext/?apikey=$API_KEY" \
    -F "contextFile=@$CONTEXT_FILE" > /dev/null
fi

# Run active scan against API
echo "Starting API active scan..."
SCAN_ID=$(curl -s "$ZAP_URL/JSON/ascan/action/scan/?apikey=$API_KEY&url=$TARGET_URL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scanId', '0'))" 2>/dev/null || echo "0")

while true; do
  STATUS=$(curl -s "$ZAP_URL/JSON/ascan/view/status/?apikey=$API_KEY&scanId=$SCAN_ID")
  PROGRESS=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status', '0'))" 2>/dev/null || echo "0")
  echo "Scan progress: $PROGRESS%"
  if [ "$PROGRESS" = "100" ]; then break; fi
  sleep 10
done

# Generate reports
curl -s "$ZAP_URL/OTHER/core/other/htmlreport/?apikey=$API_KEY" > "$REPORT_DIR/zap-api-report.html"
echo "HTML report: $REPORT_DIR/zap-api-report.html"

curl -s "$ZAP_URL/JSON/reports/action/generate/?apikey=$API_KEY&title=NFTFanClub-API&template=traditional-json&reportDir=$(pwd)/$REPORT_DIR&reportFileName=zap-api-report.json" > /dev/null
echo "JSON report: $REPORT_DIR/zap-api-report.json"

echo ""
echo "=== API Scan Complete ==="
echo "Reports: $REPORT_DIR/"
