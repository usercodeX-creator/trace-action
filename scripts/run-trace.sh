#!/usr/bin/env bash
set -euo pipefail

JSON_OUT="$RUNNER_TEMP/trace.json"
SARIF_OUT="$RUNNER_TEMP/trace.sarif"

# Resolve target list
if [ -d "$TRACE_PATH" ]; then
  FILES=$(find "$TRACE_PATH" -type f \( \
    -name "*.py"  -o \
    -name "*.js"  -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs" -o \
    -name "*.ts"  -o -name "*.tsx" -o \
    -name "*.go"  -o \
    -name "*.rs"  -o \
    -name "*.rb" \
  \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*")
elif [ -f "$TRACE_PATH" ]; then
  FILES="$TRACE_PATH"
else
  echo "::error::path not found: $TRACE_PATH"
  exit 1
fi

# Empty result path: write valid JSON, succeed
if [ -z "$FILES" ]; then
  printf '{"version":"unknown","detections":[],"summary":{"total":0,"bySeverity":{}}}\n' > "$JSON_OUT"
  echo "json-path=$JSON_OUT"  >> "$GITHUB_OUTPUT"
  echo "sarif-path=$SARIF_OUT" >> "$GITHUB_OUTPUT"
  echo "No supported source files found in $TRACE_PATH"
  exit 0
fi

FILE_COUNT=$(echo "$FILES" | wc -l)
echo "Scanning $FILE_COUNT file(s) in $TRACE_PATH"

# Per-file scan, accumulate detections in a temp JSON-array file
ACC="$RUNNER_TEMP/trace_acc.json"
echo "[]" > "$ACC"
DETECTED_VERSION=""

while IFS= read -r f; do
  [ -z "$f" ] && continue

  set +e
  RESULT=$(npx --yes "trace-core@${TRACE_VERSION}" "$f" --json 2>&1)
  RC=$?
  set -e

  if [ "$RC" -ne 0 ] && [ "$RC" -ne 1 ]; then
    echo "::warning::trace-core exited $RC on $f"
    echo "$RESULT" | head -5
    continue
  fi

  if ! echo "$RESULT" | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))" 2>/dev/null; then
    echo "::warning::invalid JSON output for $f"
    continue
  fi

  # Capture version from first successful result
  if [ -z "$DETECTED_VERSION" ]; then
    DETECTED_VERSION=$(echo "$RESULT" | node -e "
      const d = JSON.parse(require('fs').readFileSync(0,'utf8'));
      process.stdout.write(d.version || 'unknown');
    ")
  fi

  # Merge: ACC = ACC.concat(RESULT.detections)
  echo "$RESULT" | ACC="$ACC" node -e "
    const fs = require('fs');
    const accPath = process.env.ACC;
    const acc = JSON.parse(fs.readFileSync(accPath, 'utf8'));
    const incoming = JSON.parse(fs.readFileSync(0, 'utf8')).detections || [];
    fs.writeFileSync(accPath, JSON.stringify(acc.concat(incoming)));
  "

done <<< "$FILES"

# Build final JSON with summary
ACC="$ACC" DETECTED_VERSION="$DETECTED_VERSION" JSON_OUT="$JSON_OUT" node -e "
  const fs = require('fs');
  const detections = JSON.parse(fs.readFileSync(process.env.ACC, 'utf8'));
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const d of detections) {
    if (counts[d.severity] !== undefined) counts[d.severity]++;
  }
  const merged = {
    version: process.env.DETECTED_VERSION || 'unknown',
    detections,
    summary: { total: detections.length, bySeverity: counts }
  };
  fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(merged, null, 2));
"

TOTAL=$(JSON_OUT="$JSON_OUT" node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.JSON_OUT,'utf8')).detections.length)")
echo "Done: $FILE_COUNT file(s) scanned, $TOTAL detection(s)"

echo "json-path=$JSON_OUT"  >> "$GITHUB_OUTPUT"
echo "sarif-path=$SARIF_OUT" >> "$GITHUB_OUTPUT"
