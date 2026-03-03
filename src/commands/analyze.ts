import chalk from "chalk";
import { SingleBar, Presets } from "cli-progress";
import { createSpinner, succeedSpinner, failSpinner } from "../ui/spinner.js";
import { runAnalysis } from "../analyzer/engine.js";
import { log, setVerboseMode } from "../utils/logger.js";
import { mergeOptions, loadPreferences } from "../config/index.js";
import { runAnalyzeWizard } from "../ui/wizard.js";
import { renderBrandBanner } from "../ui/banner.js";
import { renderConsoleReport } from "../ui/table.js";
import { renderJsonReport } from "../reporting/json-report.js";
import { renderMinimalReport } from "../reporting/minimal-report.js";
import { runDrilldownTui } from "../ui/tui/drilldown.js";
import type { AnalysisOptions, AnalysisResult } from "../types.js";

export async function runAnalyzeCommand(options: AnalysisOptions): Promise<void> {
  let resolvedOptions = mergeOptions(options);

  // Derive sensible defaults from mode if not explicitly set.
  if (resolvedOptions.mode === "ci") {
    if (resolvedOptions.interactive === undefined) resolvedOptions.interactive = false;
  }
  if (resolvedOptions.mode === "deep") {
    // For now, deep mode behaves like dev but may enable heavier analysis later.
    if (resolvedOptions.interactive === undefined) resolvedOptions.interactive = true;
  }

  if (
    resolvedOptions.mode !== "ci" &&
    resolvedOptions.interactive !== false &&
    !resolvedOptions.asJson &&
    !resolvedOptions.outputMode &&
    !resolvedOptions.summaryOnly
  ) {
    // eslint-disable-next-line no-console
    console.log(renderBrandBanner());
    resolvedOptions = await runAnalyzeWizard(resolvedOptions);
  }

  setVerboseMode(Boolean(resolvedOptions.verbose));

  const spinner = createSpinner({
    text: chalk.dim("Detecting backend root...")
  }).start();

  const progress = new SingleBar(
    {
      format: `${chalk.cyan("Progress")} |{bar}| {percentage}% | {task}`,
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
      clearOnComplete: true
    },
    Presets.shades_classic
  );

  try {
    const startTime = process.hrtime.bigint();
    const startCpu = process.cpuUsage();
    const startMem = process.memoryUsage().rss;
    progress.start(4, 0, { task: "Initializing" });

    await tick(() => {
      spinner.text = chalk.dim("Detecting backend root...");
      progress.update(1, { task: "Backend detected" });
    });

    await tick(() => { spinner.text = chalk.dim("Detecting ORM..."); });
    progress.update(2, { task: "ORM inspected" });

    await tick(() => { spinner.text = chalk.dim("Scanning pagination patterns..."); });
    progress.update(3, { task: "Patterns analyzed" });

    const result = await runAnalysis(resolvedOptions);

    const endTime = process.hrtime.bigint();
    const endCpu = process.cpuUsage(startCpu);
    const endMem = process.memoryUsage().rss;

    const durationMs = Number(endTime - startTime) / 1_000_000;
    const cpuUserMs = endCpu.user / 1000;
    const cpuSystemMs = endCpu.system / 1000;
    const memoryDeltaBytes = endMem - startMem;

    result.runtime = {
      durationMs: Math.round(durationMs),
      cpuUserMs: Math.round(cpuUserMs),
      cpuSystemMs: Math.round(cpuSystemMs),
      memoryDeltaBytes,
    };

    await tick(() => { spinner.text = chalk.dim("Computing efficiency score..."); });
    progress.update(4, { task: "Score computed" });
    progress.stop();

    succeedSpinner(spinner, "Analysis completed");

    const outputMode = resolvedOptions.outputMode ?? (resolvedOptions.asJson ? "json" : resolvedOptions.summaryOnly ? "minimal" : "pretty");

    if (resolvedOptions.summaryOnly && outputMode !== "json") {
      printSummaryOnly(result);
    } else if (outputMode === "json") {
      console.log(renderJsonReport(result));
    } else if (outputMode === "minimal") {
      console.log(renderMinimalReport(result));
      printSuccessSummary(result);
    } else {
      console.log(renderConsoleReport(result));
      printSuccessSummary(result);
      if (resolvedOptions.interactive !== false && resolvedOptions.mode !== "ci") {
        await runDrilldownTui(result);
      }
    }

    const prefs = loadPreferences();
    const severities = ["low", "medium", "high", "critical"];
    const maxIndex = severities.indexOf(prefs.maxAllowedSeverity);

    // Fail process if there are constraint violations
    const violation = result.findings.find(f => severities.indexOf(f.severity) > maxIndex);
    const strategyViolation = prefs.enforceStrategy && result.detectedStrategy !== "none" && result.detectedStrategy !== prefs.enforceStrategy;

    if (violation || strategyViolation) {
      if (violation && outputMode !== "json") {
        // eslint-disable-next-line no-console
        console.error(chalk.red.bold(`\nConstraint Violation: Found finding with "${violation.severity}" severity, violating maxAllowedSeverity of "${prefs.maxAllowedSeverity}"`));
      }
      if (strategyViolation && outputMode !== "json") {
        // eslint-disable-next-line no-console
        console.error(chalk.red.bold(`\nConstraint Violation: Project uses "${result.detectedStrategy}" pagination, but strictly enforces "${prefs.enforceStrategy}"`));
      }
      process.exitCode = 1;
    }
  } catch (error) {
    progress.stop();
    failSpinner(spinner, "Analysis failed");

    const message = error instanceof Error ? error.message : String(error);
    log.error(`What failed: ${message}`);
    // eslint-disable-next-line no-console
    console.error(chalk.yellow("Why: An unexpected runtime error interrupted analysis."));
    // eslint-disable-next-line no-console
    console.error(chalk.cyan("How to fix: run `cloud-meter analyze --verbose` and verify path access."));

    process.exitCode = 1;
  }
}

/** Yields to the event loop so the spinner re-renders before we run `fn`. */
function tick(fn: () => void): Promise<void> {
  return new Promise((resolve) =>
    setImmediate(() => { fn(); resolve(); })
  );
}

function printSummaryOnly(result: {
  score: number;
  status: string;
  breakdown?: AnalysisResult["breakdown"];
  runtime?: AnalysisResult["runtime"];
}): void {
  // eslint-disable-next-line no-console
  console.log(chalk.bold("\nSummary"));
  // eslint-disable-next-line no-console
  console.log(chalk.dim("─".repeat(52)));
  // eslint-disable-next-line no-console
  console.log(`${chalk.green("Score:")} ${result.score}/100 (${result.status})`);

  const categories = result.breakdown?.categories;
  if (categories) {
    const ordered = Object.entries(categories).sort((a, b) => a[0].localeCompare(b[0]));
    // eslint-disable-next-line no-console
    console.log(chalk.yellow("Categories:"));
    for (const [name, value] of ordered) {
      // eslint-disable-next-line no-console
      console.log(`- ${name}: ${value}/100`);
    }
  }

  if (result.breakdown?.unitsScored !== undefined) {
    const b = result.breakdown;
    const critical = b.criticalUnits ?? 0;
    const high = b.highUnits ?? 0;
    const withIssues = b.unitsWithIssues ?? 0;
    // eslint-disable-next-line no-console
    console.log(
      chalk.cyan(
        `Units: ${b.unitsScored} total | ${critical} critical | ${high} high | ${withIssues} with issues`
      )
    );
  }

  if (result.runtime) {
    // eslint-disable-next-line no-console
    console.log(
      chalk.dim(
        `Tool runtime: ${result.runtime.durationMs} ms | analyzer CPU (user/system): ${result.runtime.cpuUserMs}/${result.runtime.cpuSystemMs} ms | analyzer RSS delta: ${result.runtime.memoryDeltaBytes} bytes`
      )
    );
  }
}

function printSuccessSummary(result: { score: number; status: string; issues: string[] }): void {
  const quickIssues = result.issues.slice(0, 3);

  // eslint-disable-next-line no-console
  console.log(chalk.bold("\nSuccess Summary"));
  // eslint-disable-next-line no-console
  console.log(chalk.dim("─".repeat(52)));
  // eslint-disable-next-line no-console
  console.log(`${chalk.green("Overall score:")} ${result.score}/100 (${result.status})`);

  if (quickIssues.length > 0) {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow("Key issues:"));
    for (const issue of quickIssues) {
      // eslint-disable-next-line no-console
      console.log(`- ${issue}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(chalk.bold("What's next?"));
  // eslint-disable-next-line no-console
  console.log(chalk.dim("─".repeat(52)));
  // eslint-disable-next-line no-console
  console.log(`  ${chalk.cyan("→")}  ${chalk.white("cloud-meter recommend")}   ${chalk.dim("— View code fix recipes from this analysis")}`);
  // eslint-disable-next-line no-console
  console.log(`  ${chalk.cyan("→")}  ${chalk.white("cloud-meter analyze --json")}  ${chalk.dim("— Export results for CI/CD pipelines")}`);
  if (quickIssues.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`  ${chalk.cyan("→")}  ${chalk.white("cloud-meter doctor")}      ${chalk.dim("— Diagnose environment & config issues")}`);
  }
}
