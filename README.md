# Trace Action

**AI can write. Trace can read.** Static analyzer for AI-generated code, in your CI.

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Trace-red?logo=github)](https://github.com/marketplace/actions/trace)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## What it does

Trace detects the 24 failure patterns that only LLMs produce: hallucinated imports, credential leaks, silent exceptions, fake type safety, missing awaits, and more. This Action runs Trace on every push and PR, posts a summary comment, and uploads results to GitHub Code Scanning.

One line in your workflow. No install, no token, no Docker.

## Quick start

```yaml
- uses: usercodeX-creator/trace-action@v1
  with:
    path: src/
```

## Usage

```yaml
name: Trace
on: [push, pull_request]

permissions:
  contents: read
  security-events: write
  pull-requests: write

jobs:
  trace:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: usercodeX-creator/trace-action@v1
        with:
          path: src/
          severity-threshold: low       # low | medium | high | critical
          fail-on-detection: 'false'    # set 'true' to block the PR
          comment-on-pr: 'true'         # post summary as PR comment
          upload-sarif: 'true'          # upload to Code Scanning tab
```

See [`examples/`](examples/) for more workflow patterns:
- [`basic.yml`](examples/basic.yml) — scan on every push and PR
- [`pr-only.yml`](examples/pr-only.yml) — scan only on PRs, comment + SARIF
- [`strict-blocking.yml`](examples/strict-blocking.yml) — fail the check on medium+ findings

## Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | Directory or file to scan |
| `severity-threshold` | `low` | Minimum severity to report |
| `fail-on-detection` | `false` | Fail the action when detections are found |
| `comment-on-pr` | `true` | Post summary comment on PRs |
| `upload-sarif` | `true` | Upload SARIF to Code Scanning |
| `trace-version` | `latest` | Pin a specific trace-core version |
| `github-token` | `${{ github.token }}` | Token for API calls |

## Outputs

| Output | Description |
|---|---|
| `detection-count` | Total detections at or above threshold |
| `critical-count` | Critical severity count |
| `high-count` | High severity count |
| `medium-count` | Medium severity count |
| `low-count` | Low severity count |
| `grade` | Letter grade: A (clean) through F |
| `summary-markdown` | Markdown summary for downstream use |
| `sarif-path` | Path to generated SARIF file |
| `json-path` | Path to raw Trace JSON output |

## How it works

1. Runs `npx trace-core@latest` on your code
2. Converts JSON output to SARIF 2.1.0 for GitHub Code Scanning
3. Posts a one-comment summary on each PR (updated on subsequent pushes)

## License

MIT
