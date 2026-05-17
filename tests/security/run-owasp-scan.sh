#!/bin/bash
set -euo pipefail

# OWASP ZAP Automated Security Scan
# Usage: ./run-owasp-scan.sh [target_url] [--api]
#   --api: Use API scan mode with OpenAPI spec

TARGET_URL=${1:-http://localhost:8000}
SCAN_MODE=${2:-full}
ZAP_URL=${ZAP_URL:-http://localhost:8080}
API_KEY=${ZAP_AP_IKEY:-change-me}
REPORT_DIR="./owasp-zap/reports"

mkdir -p "$REPORT_DIR"

echo "=== OWASP ZAP Security Scan ==="
echo "Target: $TARGET_URL"
echo "ZAP: $ZAP_URL"
echo "Mode: $SCAN_MODE"
echo "Reports: $REPORT_DIR/"
echo ""

# Wait for ZAP to be ready
echo "Waiting for ZAP to be ready..."
for i in $(seq 1 30); do
  if curl -s "$ZAP_URL" > /dev/null 2>&1; then
    echo "ZAP is ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: ZAP did not become ready in time"
    exit 1
  fi
  sleep 2
done

# Run spider scan
echo "Starting spider scan..."
SPIDER_SCAN_ID=$(curl -s "$ZAP_URL/JSON/spider/action/scan/?apikey=$API_KEY&url=$TARGET_URL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scanId', '0'))" 2>/dev/null || echo "0")
echo "Spider scan ID: $SPIDER_SCAN_ID"

# Wait for spider to complete
while true; do
  SPIDER_STATUS=$(curl -s "$ZAP_URL/JSON/spider/view/status/?apikey=$API_KEY&scanId=$SPIDER_SCAN_ID")
  SPIDER_PROGRESS=$(echo "$SPIDER_STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status', '0'))" 2>/dev/null || echo "0")
  echo "Spider progress: $SPIDER_PROGRESS%"
  if [ "$SPIDER_PROGRESS" = "100" ]; then
    break
  fi
  sleep 5
done

# Run active scan
echo "Starting active scan..."
ACTIVE_SCAN_ID=$(curl -s "$ZAP_URL/JSON/ascan/action/scan/?apikey=$API_KEY&url=$TARGET_URL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scanId', '0'))" 2>/dev/null || echo "0")
echo "Active scan ID: $ACTIVE_SCAN_ID"

# Wait for active scan to complete
while true; do
  ACTIVE_STATUS=$(curl -s "$ZAP_URL/JSON/ascan/view/status/?apikey=$API_KEY&scanId=$ACTIVE_SCAN_ID")
  ACTIVE_PROGRESS=$(echo "$ACTIVE_STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status', '0'))" 2>/dev/null || echo "0")
  echo "Active scan progress: $ACTIVE_PROGRESS%"
  if [ "$ACTIVE_PROGRESS" = "100" ]; then
    break
  fi
  sleep 10
done

# Generate HTML report
echo "Generating reports..."
curl -s "$ZAP_URL/OTHER/core/other/htmlreport/?apikey=$API_KEY" > "$REPORT_DIR/zap-report.html"
echo "HTML report: $REPORT_DIR/zap-report.html"

# Generate JSON report
curl -s "$ZAP_URL/JSON/reports/action/generate/?apikey=$API_KEY&title=NFTFanClub&template=traditional-json&reportDir=$(pwd)/$REPORT_DIR&reportFileName=zap-report.json" > /dev/null
echo "JSON report: $REPORT_DIR/zap-report.json"

# Generate Markdown report
curl -s "$ZAP_URL/JSON/reports/action/generate/?apikey=$API_KEY&title=NFTFanClub&template=traditional-markdown&reportDir=$(pwd)/$REPORT_DIR&reportFileName=zap-report.md" > /dev/null
echo "Markdown report: $REPORT_DIR/zap-report.md"

# Check for alerts
ALERT_COUNT=$(curl -s "$ZAP_URL/JSON/core/view/alertsSummary/?apikey=$API_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(d.get('High',0), d.get('Medium',0), d.get('Low',0)))" 2>/dev/null || echo "0")
echo ""
echo "=== Scan Complete ==="
echo "Total alerts found: $ALERT_COUNT"
echo "Reports saved in: $REPORT_DIR/"
echo ""

# Exit with error if high-severity alerts found
HIGH_ALERTS=$(curl -s "$ZAP_URL/JSON/core/view/alertsSummary/?apikey=$API_KEY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('High', 0))" 2>/dev/null || echo "0")
if [ "$HIGH_ALERTS" -gt 0 ]; then
  echo "WARNING: $HIGH_ALERTS high-severity alerts found!"
  exit 1
fi
