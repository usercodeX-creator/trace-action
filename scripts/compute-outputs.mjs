import { readFileSync, appendFileSync } from "fs";

const jsonPath = process.env.TRACE_JSON;
const threshold = process.env.TRACE_THRESHOLD || "low";
const scanPath = process.env.TRACE_PATH || ".";

if (!jsonPath) {
  console.error("::error::TRACE_JSON environment variable not set");
  process.exit(1);
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

function severityAtOrAbove(severity, threshold) {
  return SEVERITY_ORDER.indexOf(severity) <= SEVERITY_ORDER.indexOf(threshold);
}

function computeGrade(total, critical) {
  if (total === 0) return "A";
  if (critical > 3 || total > 20) return "F";
  if (critical >= 2 || total > 10) return "D";
  if (total <= 3 && critical === 0) return "B";
  if (total <= 10 && critical <= 1) return "C";
  return "D";
}

try {
  const raw = readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw);
  const detections = data.detections || [];
  const version = data.version || "unknown";

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const d of detections) {
    if (counts[d.severity] !== undefined) counts[d.severity]++;
  }

  const filtered = detections.filter((d) =>
    severityAtOrAbove(d.severity, threshold)
  );
  const total = filtered.length;
  const grade = computeGrade(
    detections.length,
    counts.critical
  );

  // Top 3 detections sorted by severity then file path
  const sorted = [...detections].sort((a, b) => {
    const sa = SEVERITY_ORDER.indexOf(a.severity);
    const sb = SEVERITY_ORDER.indexOf(b.severity);
    if (sa !== sb) return sa - sb;
    return (a.file || "").localeCompare(b.file || "");
  });
  const top3 = sorted.slice(0, 3);

  let summary;
  if (detections.length === 0) {
    summary = [
      "## \\u2705 Trace scan",
      "",
      "No detections. **Grade: A**",
      "",
      `\\u2014 [Trace](https://tracecheck.dev) v${version} \\u00b7 scanned \\\`${scanPath}\\\``,
    ].join("\n");
  } else {
    const bullets = top3
      .map(
        (d) =>
          `- **${d.detector}** \\u2014 \\\`${d.file || "unknown"}:${d.line || 0}\\\` \\u2014 ${d.message}`
      )
      .join("\n");

    summary = [
      "## \\ud83d\\udd0e Trace scan",
      "",
      `**Grade: ${grade}** \\u00b7 ${detections.length} detection${detections.length !== 1 ? "s" : ""}`,
      "",
      "| Severity | Count |",
      "|---|---|",
      `| Critical | ${counts.critical} |`,
      `| High | ${counts.high} |`,
      `| Medium | ${counts.medium} |`,
      `| Low | ${counts.low} |`,
      "",
      bullets,
      "",
      `\\u2014 [Trace](https://tracecheck.dev) v${version} \\u00b7 scanned \\\`${scanPath}\\\``,
    ].join("\n");
  }

  // Write outputs
  const out = process.env.GITHUB_OUTPUT;
  if (!out) {
    // Local testing fallback
    console.log(`detection-count=${total}`);
    console.log(`critical-count=${counts.critical}`);
    console.log(`high-count=${counts.high}`);
    console.log(`medium-count=${counts.medium}`);
    console.log(`low-count=${counts.low}`);
    console.log(`grade=${grade}`);
    console.log(`summary-markdown=${summary}`);
  } else {
    appendFileSync(out, `detection-count=${total}\n`);
    appendFileSync(out, `critical-count=${counts.critical}\n`);
    appendFileSync(out, `high-count=${counts.high}\n`);
    appendFileSync(out, `medium-count=${counts.medium}\n`);
    appendFileSync(out, `low-count=${counts.low}\n`);
    appendFileSync(out, `grade=${grade}\n`);
    // Multi-line output uses delimiter
    const delimiter = `SUMMARY_${Date.now()}`;
    appendFileSync(out, `summary-markdown<<${delimiter}\n${summary}\n${delimiter}\n`);
  }

  console.log(`Trace scan: ${detections.length} detections, grade ${grade}, ${total} at or above ${threshold}`);
} catch (err) {
  console.error(`::error::Failed to compute outputs: ${err.message}`);
  process.exit(1);
}
