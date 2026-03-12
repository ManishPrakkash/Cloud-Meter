import chalk, { type ChalkInstance } from "chalk";
import path from "node:path";
import Table from "cli-table3";
import type { AnalysisResult, Finding, Severity, TopUnitSummary } from "../types.js";

const W = 72; // total width of the report

// ─── colour helpers ────────────────────────────────────────────────────────

function scoreColor(score: number): ChalkInstance {
  if (score >= 90) return chalk.green;
  if (score >= 75) return chalk.cyan;
  if (score >= 60) return chalk.yellow;
  if (score >= 40) return chalk.hex("#ff9f1a");
  return chalk.red;
}

function severityIcon(s: Severity): string {
  if (s === "critical") return chalk.bgRed.white(" ✖ CRITICAL ");
  if (s === "high") return chalk.red.bold(" ▲ HIGH     ");
  if (s === "medium") return chalk.yellow.bold(" ◆ MEDIUM   ");
  return chalk.gray(" ℹ  LOW      ");
}

function strategyBadge(s: string): string {
  if (s === "offset") return chalk.bgYellow.black.bold(" OFFSET ");
  if (s === "cursor") return chalk.bgGreen.black.bold(" CURSOR ");
  if (s === "mixed") return chalk.bgMagenta.white.bold(" MIXED  ");
  return chalk.bgGray.white(" NONE  ");
}

// ─── layout primitives ─────────────────────────────────────────────────────

const hr = (c = "─") => chalk.dim(c.repeat(W));
const gap = "";

function sectionHeader(title: string): string {
  return `\n${chalk.bold.white(title)}\n${hr()}`;
}

/** left-pad two columns: label (fixed 14 chars) + value */
function meta(label: string, value: string): string {
  return `  ${chalk.dim(label.padEnd(14))}${chalk.white(value)}`;
}

/** Score progress bar — filled / empty blocks */
function progressBar(score: number, width = 40): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = scoreColor(score);
  return color("█".repeat(filled)) + chalk.dim("░".repeat(empty));
}

/** Top-level banner ─ like create-react-app / vite */
function banner(): string {
  const title = " ☁  Cloud-Meter ";
  const pad = Math.max(0, W - title.length);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return [
    gap,
    chalk.bgHex("#0052cc").bold.white(" ".repeat(left) + title + " ".repeat(right)),
    gap
  ].join("\n");
}

/**
 * Truncate a string to `max` visible chars, appending "…" if trimmed.
 */
function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/**
 * Clean a code snippet for table display:
 * - collapse whitespace
 * - limit to 2 lines, each ≤50 chars
 */
function formatSnippet(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 2)
    .map((l) => truncate(l, 50));
  return lines.join("\n");
}

/**
 * Grouped, severity-sorted findings.
 * Shows file path relative to process.cwd() and line number.
 * Deduplicates by (code + file path) so we don't flood the screen.
 */
function findingsBlock(findings: Finding[]): string {
  if (findings.length === 0) {
    return `  ${chalk.green("✔")}  No pagination issues detected.`;
  }

  const order: Severity[] = ["critical", "high", "medium", "low"];
  const sorted = [...findings]
    .filter(f => f.filePath !== "<project>")
    .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  // dedupe per code+file
  const seen = new Set<string>();
  const deduped = sorted.filter(f => {
    const key = `${f.code}|${f.filePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const lines: string[] = [];
  const table = new Table({
    head: [chalk.bold("Severity"), chalk.bold("Issue"), chalk.bold("Location")],
    colWidths: [14, 40, 22],
    wordWrap: true,
    wrapOnWordBoundary: true,
    style: { head: ["cyan"] }
  });

  for (const f of deduped) {
    const rel = path.relative(process.cwd(), f.filePath);
    const lineNum = f.lineRange?.[0] ?? 1;
    const loc = chalk.dim(truncate(rel, 18) + `:${lineNum}`);

    // Build issue cell: message + optional line range (no raw code dump)
    let issueText = chalk.white(f.message);
    if (f.lineRange) {
      issueText += chalk.dim(`\nL${f.lineRange[0]}–${f.lineRange[1]}`);
    }
    if (f.codeSnippet) {
      const clean = formatSnippet(f.codeSnippet);
      issueText += chalk.dim(`\n${clean}`);
    }

    table.push([severityIcon(f.severity), issueText, loc]);
  }

  lines.push(table.toString());
  lines.push("");

  // aggregate-level issues (filePath === "<project>")
  const project = findings.filter(f => f.filePath === "<project>");
  for (const f of project) {
    lines.push(`  ${severityIcon(f.severity)}  ${chalk.white(f.message)}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── score block ───────────────────────────────────────────────────────────

function scoreBlock(score: number, status: string): string {
  const color = scoreColor(score);
  const bar = progressBar(score);
  const label = color.bold(`${score}/100`);
  const badge = color.bold(`${status}`);
  return [
    `  ${label}  ${chalk.dim("|")}  ${badge}`,
    `  ${bar}`,
  ].join("\n");
}

function categoryScoreBlock(categories?: Record<string, number>): string | undefined {
  if (!categories) return undefined;
  const entries = Object.entries(categories);
  if (entries.length === 0) return undefined;

  const table = new Table({
    head: [chalk.bold("Category"), chalk.bold("Score")],
    colWidths: [32, 38],
    wordWrap: true,
    style: { head: ["cyan"] }
  });

  for (const [cat, score] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
    table.push([chalk.white(cat), `${scoreColor(score).bold(`${score}/100`)}  ${progressBar(score, 22)}`]);
  }
  return table.toString();
}

function riskOverviewBlock(result: AnalysisResult): string | undefined {
  const b = result.breakdown;
  if (!b || !b.unitsScored) {
    if (result.detectedStrategy === "none") {
      return meta(
        "Summary",
        "No endpoints detected (likely library code). Score reflects only pattern scans; treat as informational."
      );
    }
    return undefined;
  }

  const lines: string[] = [];
  const total = b.unitsScored;
  const withIssues = b.unitsWithIssues ?? 0;
  const critical = b.criticalUnits ?? 0;
  const high = b.highUnits ?? 0;

  lines.push(meta("Units", `${total} total | ${critical} critical | ${high} high | ${withIssues} with issues`));

  if (typeof b.boundsCoveragePercent === "number") {
    lines.push(
      meta(
        "Bounds",
        `${b.boundsCoveragePercent}% ${progressBar(b.boundsCoveragePercent, 24)}`
      )
    );
  }

  if (typeof b.keysetUsagePercent === "number" || typeof b.offsetUsagePercent === "number") {
    const keyset = b.keysetUsagePercent ?? 0;
    const offset = b.offsetUsagePercent ?? 0;
    lines.push(
      meta(
        "Patterns",
        `Keyset ${keyset}%  |  Offset ${offset}%`
      )
    );
  }

  if (typeof b.stableOrderCoveragePercent === "number") {
    lines.push(
      meta(
        "Ordering",
        `${b.stableOrderCoveragePercent}% stable ORDER BY`
      )
    );
  }

  const hotspotParts: string[] = [];
  if (b.deepOffsetUnits) hotspotParts.push(`${b.deepOffsetUnits} deep-offset units`);
  if (b.unboundedUnits) hotspotParts.push(`${b.unboundedUnits} unbounded units`);
  if (b.unsafeSortUnits) hotspotParts.push(`${b.unsafeSortUnits} unsafe-sort units`);
  if (hotspotParts.length > 0) {
    lines.push(meta("Hotspots", hotspotParts.join(chalk.dim("  ·  "))));
  }

  return lines.join("\n");
}

function topUnitsBlock(result: AnalysisResult): string | undefined {
  const topUnits: TopUnitSummary[] = result.topUnits ?? [];
  if (!topUnits.length) return undefined;

  const table = new Table({
    head: [
      chalk.bold("Unit"),
      chalk.bold("Max severity"),
      chalk.bold("Issues"),
      chalk.bold("Primary risk"),
      chalk.bold("Location"),
    ],
    colWidths: [20, 14, 8, 20, 24],
    wordWrap: true,
    style: { head: ["cyan"] },
  });

  for (const u of topUnits) {
    const unitLabel = chalk.white(u.name);
    const severityLabel = u.maxSeverity
      ? severityIcon(u.maxSeverity)
      : chalk.gray(" ℹ  NONE     ");
    const issues = `${u.issueCount}`;
    const primaryRisk = u.primaryRisk
      ? chalk.white(u.primaryRisk)
      : chalk.dim("No issues detected");

    let location = chalk.dim("<unknown>");
    if (u.entryFile) {
      const rel = path.relative(process.cwd(), u.entryFile);
      const line = u.entryLine ?? 1;
      location = chalk.dim(`${rel}:${line}`);
    }

    table.push([unitLabel, severityLabel, issues, primaryRisk, location]);
  }

  return table.toString();
}

function nextActionsBlock(result: AnalysisResult): string | undefined {
  const actions = result.nextActions ?? [];
  if (actions.length === 0) return undefined;

  return actions
    .slice(0, 3)
    .map((a, i) => `  ${chalk.cyan.bold(`${String(i + 1).padStart(2)}.`)}  ${a}`)
    .join("\n");
}

// ─── recommendations numbered list ────────────────────────────────────────

function recommendationsList(recs: string[]): string {
  if (recs.length === 0) return `  ${chalk.green("✔")}  No recommendations at this time.`;
  return recs
    .slice(0, 10)
    .map((r, i) => `  ${chalk.cyan.bold(`${String(i + 1).padStart(2)}.`)}  ${r}`)
    .join("\n");
}

// ─── public entry point ────────────────────────────────────────────────────

export function renderConsoleReport(result: AnalysisResult): string {
  const segments: string[] = [];

  // ── Header banner
  segments.push(banner());

  // ── Project metadata panel
  segments.push(sectionHeader("Project"));
  const projectName = path.basename(result.backendRoot);
  const projectTable = new Table({
    colWidths: [18, 52],
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: " "
    }
  });
  projectTable.push(
    [chalk.dim("Name"), projectName],
    [chalk.dim("Backend"), result.backendRoot],
    [chalk.dim("ORM"), result.orm.length > 0 ? result.orm.join(", ") : "Unknown"],
    [chalk.dim("Strategy"), strategyBadge(result.detectedStrategy)],
    [chalk.dim("Files"), `${result.filesScanned} scanned`]
  );
  segments.push(projectTable.toString());

  // ── Risk overview + hotspots (primary view)
  const overview = riskOverviewBlock(result);
  if (overview) {
    segments.push(sectionHeader("Risk Overview"));
    segments.push(overview);
  }

  // ── Top risky units
  const topUnits = topUnitsBlock(result);
  if (topUnits) {
    segments.push(sectionHeader("Top Risky Units"));
    segments.push(topUnits);
  }

  // ── Next actions
  const nextActions = nextActionsBlock(result);
  if (nextActions) {
    segments.push(sectionHeader("Next Actions (do this now)"));
    segments.push(nextActions);
  }

  // ── Score (demoted, but still visible)
  segments.push(sectionHeader("Score"));
  segments.push(scoreBlock(result.score, result.status));
  const breakdown = categoryScoreBlock(
    result.breakdown?.categories as Record<string, number> | undefined
  );
  if (breakdown) {
    segments.push("");
    segments.push(chalk.bold.white("Score Breakdown"));
    segments.push(chalk.dim("─".repeat(W)));
    segments.push(breakdown);
  }

  // ── Issues
  const issueCount = result.findings.length;
  segments.push(sectionHeader(`Issues  ${chalk.dim(`(${issueCount} detected)`)}`));
  segments.push(findingsBlock(result.findings));

  // ── Root Causes
  if (result.rootCauses.length > 0) {
    segments.push(sectionHeader("Root Causes"));
    for (const c of result.rootCauses) {
      segments.push(`  ${chalk.yellow("⚡")}  ${c}`);
    }
  }

  // ── Recommendations
  segments.push(sectionHeader("Recommendations"));
  segments.push(recommendationsList(result.recommendations));

  // ── Footer
  segments.push("");
  segments.push(hr());
  segments.push(
    `  ${chalk.dim("Run")} ${chalk.cyan("cloud-meter recommend")} ${chalk.dim("for code fix recipes.")}`
  );
  segments.push(
    `  ${chalk.dim("Run")} ${chalk.cyan("cloud-meter analyze --json")} ${chalk.dim("for machine-readable output.")}`
  );
  segments.push("");

  return segments.join("\n");
}
