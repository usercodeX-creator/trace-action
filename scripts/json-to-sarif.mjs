import { readFileSync, writeFileSync } from "fs";

const jsonPath = process.env.TRACE_JSON;
const sarifPath = process.env.SARIF_OUT || jsonPath.replace(/\.json$/, ".sarif");

if (!jsonPath) {
  console.error("::error::TRACE_JSON environment variable not set");
  process.exit(1);
}

const SEVERITY_TO_LEVEL = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
};

const SEVERITY_TO_RANK = {
  critical: 90,
  high: 70,
  medium: 50,
  low: 25,
};

function toPascalCase(str) {
  return str
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function humanize(str) {
  return str
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

try {
  const raw = readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw);
  const detections = data.detections || [];
  const version = data.version || "unknown";

  // Deduplicate rules by detector id
  const rulesMap = new Map();
  for (const d of detections) {
    if (!rulesMap.has(d.detector)) {
      rulesMap.set(d.detector, {
        id: d.detector,
        name: toPascalCase(d.detector),
        shortDescription: { text: humanize(d.detector) },
        helpUri: `https://tracecheck.dev/about#${d.detector}`,
        defaultConfiguration: {
          level: SEVERITY_TO_LEVEL[d.severity] || "warning",
        },
        properties: {
          "security-severity": String(SEVERITY_TO_RANK[d.severity] || 50),
        },
      });
    }
  }

  const results = detections.map((d) => {
    const result = {
      ruleId: d.detector,
      level: SEVERITY_TO_LEVEL[d.severity] || "warning",
      message: { text: d.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: d.file || "unknown" },
            region: {
              startLine: d.line || 1,
              ...(d.column ? { startColumn: d.column } : {}),
            },
          },
        },
      ],
    };

    if (d.suggestedFix) {
      result.fixes = [{ description: { text: d.suggestedFix } }];
    }

    return result;
  });

  const sarif = {
    $schema:
      "https://docs.oasis-open.org/sarif/sarif/v2.1.0/cos02/schemas/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "Trace",
            version,
            informationUri: "https://tracecheck.dev",
            rules: [...rulesMap.values()],
          },
        },
        results,
      },
    ],
  };

  writeFileSync(sarifPath, JSON.stringify(sarif, null, 2));
  console.log(`SARIF written to ${sarifPath} (${results.length} results, ${rulesMap.size} rules)`);
} catch (err) {
  console.error(`::error::Failed to convert JSON to SARIF: ${err.message}`);
  process.exit(1);
}
