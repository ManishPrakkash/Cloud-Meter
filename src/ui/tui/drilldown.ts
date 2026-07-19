import chalk from "chalk";
import path from "node:path";
import Table from "cli-table3";
import { select } from "@inquirer/prompts";
import type { AnalysisResult, AnalysisUnit, Finding, Severity } from "../../types.js";

function severityRank(s: Severity): number {
  if (s === "critical") return 3;
  if (s === "high") return 2;
  if (s === "medium") return 1;
  return 0;
}

function formatSeverity(s: Severity): string {
  if (s === "critical") return chalk.bgRed.white(" CRITICAL ");
  if (s === "high") return chalk.red.bold(" HIGH ");
  if (s === "medium") return chalk.yellow.bold(" MED ");
  return chalk.gray(" LOW ");
}

function unitLabel(u: AnalysisUnit): string {
  const issues = u.findings.length;
  const score = u.score;
  const scoreText =
    score >= 90 ? chalk.green(`${score}`) :
    score >= 75 ? chalk.cyan(`${score}`) :
    score >= 60 ? chalk.yellow(`${score}`) :
    score >= 40 ? chalk.hex("#ff9f1a")(`${score}`) :
    chalk.red(`${score}`);
  return `${u.name}  ${chalk.dim("|")} Health Score: ${scoreText}/100  ${chalk.dim("|")} Issues: ${issues}`;
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function unitRecommendations(unit: AnalysisUnit): string[] {
  return unique(unit.findings.map((f) => f.recommendation).filter(Boolean) as string[]);
}

function unitRootCauses(unit: AnalysisUnit): string[] {
  return unique(unit.findings.map((f) => f.rootCause).filter(Boolean) as string[]);
}

function renderUnitDetail(unit: AnalysisUnit, backendRoot: string): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(chalk.bold.white(unit.name));
  lines.push(chalk.dim("─".repeat(72)));
  lines.push(`Score: ${chalk.bold(`${unit.score}/100`)}  ${chalk.dim("|")}  Status: ${chalk.bold(unit.status)}`);
  lines.push(`Kind: ${chalk.dim(unit.kind)}  ${chalk.dim("|")}  Files: ${unit.files.length}`);

  if (unit.categories && Object.keys(unit.categories).length > 0) {
    const cat = Object.entries(unit.categories)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${chalk.dim(k)}=${chalk.bold(String(v))}`)
      .join(chalk.dim("  ·  "));
    lines.push(`Breakdown: ${cat}`);
  }

  if (unit.callChain && unit.callChain.length > 0) {
    lines.push("");
    lines.push(chalk.bold("Call chain (best-effort)"));
    for (const step of unit.callChain.slice(0, 10)) {
      const rel = path.relative(backendRoot, step.filePath);
      const at = step.line ? chalk.dim(`:${step.line}`) : "";
      const sym = step.symbol ? chalk.white(step.symbol) : chalk.dim("<anon>");
      lines.push(`- ${sym}  ${chalk.dim("in")} ${chalk.gray(rel)}${at}`);
    }
  }

  const findings = [...unit.findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  lines.push("");
  lines.push(chalk.bold(`Findings (${findings.length})`));

  const table = new Table({
    head: [chalk.bold("Severity"), chalk.bold("Issue"), chalk.bold("Location")],
    colWidths: [10, 44, 28],
    wordWrap: true,
    style: { head: ["cyan"] }
  });

  for (const f of findings.slice(0, 20)) {
    const rel = f.filePath === "<project>" ? "<project>" : path.relative(backendRoot, f.filePath);
    const loc = `${rel}:${f.lineRange?.[0] ?? 1}`;
    const issue = `${chalk.white(f.message)}${f.codeSnippet ? chalk.dim(`\n${f.codeSnippet}`) : ""}`;
    table.push([formatSeverity(f.severity), issue, chalk.gray(loc)]);
  }
  lines.push(table.toString());

  const causes = unitRootCauses(unit);
  if (causes.length > 0) {
    lines.push("");
    lines.push(chalk.bold("Root causes"));
    for (const c of causes.slice(0, 8)) lines.push(`- ${chalk.yellow("⚡")} ${c}`);
  }

  const recs = unitRecommendations(unit);
  if (recs.length > 0) {
    lines.push("");
    lines.push(chalk.bold("Fix recipes"));
    for (const r of recs.slice(0, 8)) lines.push(`- ${chalk.cyan("•")} ${r}`);
  }

  return lines.join("\n");
}

function criticalFirst(units: AnalysisUnit[]): AnalysisUnit[] {
  return [...units].sort((a, b) => {
    const aMax = Math.max(0, ...a.findings.map((f) => severityRank(f.severity)));
    const bMax = Math.max(0, ...b.findings.map((f) => severityRank(f.severity)));
    if (bMax !== aMax) return bMax - aMax;
    return a.score - b.score;
  });
}

export async function runDrilldownTui(result: AnalysisResult): Promise<void> {
  const units = result.units ?? [];
  if (units.length === 0) return;

  while (true) {
    const view = await select<"critical" | "all" | "exit">({
      message: "What would you like to explore?",
      choices: [
        { name: "Critical issues (Recommended)", value: "critical" },
        { name: "All files & endpoints", value: "all" },
        { name: "Exit", value: "exit" }
      ],
      default: "critical"
    });

    if (view === "exit") return;

    const baseList = view === "critical"
      ? criticalFirst(units).filter((u) => u.score < 75 || u.findings.some((f) => f.severity === "critical" || f.severity === "high"))
      : criticalFirst(units);

    if (baseList.length === 0) {
      // eslint-disable-next-line no-console
      console.log(chalk.green("\nNo units match this view.\n"));
      continue;
    }

    const sort = await select<"score" | "bounds" | "depth">({
      message: "Sort findings by",
      choices: [
        { name: "Overall risk score (Worst first) (Recommended)", value: "score" },
        { name: "Missing Limits (Unbounded risk first)", value: "bounds" },
        { name: "Deep Offsets (Performance risk first)", value: "depth" }
      ],
      default: "score"
    });

    const filter = await select<"all" | "critical" | "high" | "unbounded" | "deepOffset" | "unsafeSort">({
      message: "Filter findings",
      choices: [
        { name: "Show all", value: "all" },
        { name: "Critical severity only", value: "critical" },
        { name: "Critical + High severity (Recommended)", value: "high" },
        { name: "Missing limits only", value: "unbounded" },
        { name: "Deep offsets only", value: "deepOffset" },
        { name: "Unsafe sorting only", value: "unsafeSort" }
      ],
      default: "high"
    });

    const sortedBase = [...baseList].sort((a, b) => {
      if (sort === "score") {
        return a.score - b.score;
      }
      const aCat = a.categories ?? {};
      const bCat = b.categories ?? {};
      if (sort === "bounds") {
        const aVal = aCat.Bounds ?? a.score;
        const bVal = bCat.Bounds ?? b.score;
        return aVal - bVal;
      }
      const aVal = aCat.DepthCost ?? a.score;
      const bVal = bCat.DepthCost ?? b.score;
      return aVal - bVal;
    });

    const filtered = sortedBase.filter((u) => {
      const max = Math.max(0, ...u.findings.map((f) => severityRank(f.severity)));
      if (filter === "all") return true;
      if (filter === "critical") return max === severityRank("critical");
      if (filter === "high") return max >= severityRank("high");
      if (filter === "unbounded") {
        return u.findings.some(
          (f) => f.code === "MISSING_LIMIT" || f.code === "NO_PAGE_SIZE_CAP"
        );
      }
      if (filter === "deepOffset") {
        return u.findings.some((f) => f.code === "DEEP_OFFSET");
      }
      if (filter === "unsafeSort") {
        return u.findings.some((f) => f.code === "DYNAMIC_SORT_UNSAFE");
      }
      return true;
    });

    const list = filtered.length > 0 ? filtered : sortedBase;

    const selectedId = await select<string>({
      message: `Select a file or endpoint to view details (${list.length} found)`,
      pageSize: 12,
      choices: list.slice(0, 200).map((u) => ({ name: unitLabel(u), value: u.id }))
    });

    const unit = units.find((u) => u.id === selectedId);
    if (!unit) continue;

    // eslint-disable-next-line no-console
    console.log(renderUnitDetail(unit, result.backendRoot));

    const next = await select<"back" | "exit">({
      message: "Next",
      choices: [
        { name: "Back", value: "back" },
        { name: "Exit", value: "exit" }
      ],
      default: "back"
    });
    if (next === "exit") return;
  }
}

