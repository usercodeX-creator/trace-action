#!/usr/bin/env bash
set -euo pipefail

JSON_OUT="$RUNNER_TEMP/trace.json"
SARIF_OUT="$RUNNER_TEMP/trace.sarif"

# Run trace-core. We use --json. We do NOT pass --fail-on here — the
# composite step "Fail if requested" handles failure semantics so that we
# always have a chance to upload SARIF and post the comment first.
set +e
npx --yes "trace-core@${TRACE_VERSION}" "$TRACE_PATH" --json > "$JSON_OUT"
TRACE_EXIT=$?
set -e

# trace-core exits 0 when no detections at or above its own threshold.
# We tolerate exit 1 here (means: detections found). Anything else is a
# real error.
if [ "$TRACE_EXIT" -ne 0 ] && [ "$TRACE_EXIT" -ne 1 ]; then
  echo "::error::trace-core exited with unexpected code $TRACE_EXIT"
  cat "$JSON_OUT" || true
  exit "$TRACE_EXIT"
fi

# Sanity: the JSON must be parseable
if ! node -e "JSON.parse(require('fs').readFileSync('$JSON_OUT','utf8'))" ; then
  echo "::error::trace-core did not produce valid JSON"
  cat "$JSON_OUT"
  exit 1
fi

echo "json-path=$JSON_OUT"  >> "$GITHUB_OUTPUT"
echo "sarif-path=$SARIF_OUT" >> "$GITHUB_OUTPUT"
