#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { runAnalyzeCommand } from "./commands/analyze.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runInitCommand } from "./commands/init.js";
import { runRecommendCommand } from "./commands/recommend.js";
import { loadPreferences } from "./config/index.js";

const program = new Command();
const prefs = loadPreferences();

program
  .name("cloud-meter")
  .description("Production-grade backend pagination efficiency analyzer")
  .version("0.1.1", "-v, --version", "Show version number");

program
  .command("init")
  .description("Create a cloud-meter.config.json with saved defaults (output mode, severity, strategy)")
  .addHelpText(
    "after",
    `
Use this to configure project-level settings so you don't need flags every time.
Your config is auto-loaded by analyze, doctor, and other commands.

Examples:
  $ cloud-meter init
`
  )
  .action(runInitCommand);

program
  .command("recommend")
  .description("View code fix recipes and suggestions from your last analysis run")
  .addHelpText(
    "after",
    `
Recommendations are cached after each 'analyze' run. If no cache exists,
you'll be guided to run an analysis first.

Examples:
  $ cloud-meter recommend
`
  )
  .action(runRecommendCommand);

program
  .command("analyze")
  .argument("[path]", "path to analyze", prefs.defaultPath)
  .option("--json", "output machine-readable JSON")
  .option("-o, --output <mode>", "output mode: pretty|json|minimal")
  .option("--mode <mode>", "mode: dev|ci|deep")
  .option("--summary-only", "print a short summary instead of full report")
  .option("--interactive", "run guided workflow prompts")
  .option("--no-interactive", "skip guided prompts")
  .option("--verbose", "include additional debug details")
  .addHelpText(
    "after",
    `
Examples:
  $ cloud-meter analyze                          # Guided interactive mode
  $ cloud-meter analyze ./backend                # Scan specific directory
  $ cloud-meter analyze ./apps/api --interactive # Explicit guided mode
  $ cloud-meter analyze . --output minimal       # Short summary
  $ cloud-meter analyze . --json                 # CI/CD-friendly JSON
  $ cloud-meter analyze . --mode ci              # Non-interactive CI mode
`
  )
  .action(
    async (
      path: string,
      options: {
        json?: boolean;
        verbose?: boolean;
        output?: "pretty" | "json" | "minimal";
        interactive?: boolean;
        mode?: "dev" | "ci" | "deep";
        summaryOnly?: boolean;
      }
    ) => {
      await runAnalyzeCommand({
        targetPath: path,
        asJson: options.json,
        outputMode: options.output,
        interactive: options.interactive,
        verbose: options.verbose,
        mode: options.mode,
        summaryOnly: options.summaryOnly
      });
    }
  );

program
  .command("config")
  .description("Print saved CLI defaults (from cloud-meter.config.json)")
  .addHelpText(
    "after",
    `
Shows merged configuration from your config file and built-in defaults.

Examples:
  $ cloud-meter config
`
  )
  .action(() => {
    const p = loadPreferences();
    // eslint-disable-next-line no-console
    console.log("");
    // eslint-disable-next-line no-console
    console.log(chalk.bold("☁  Cloud-Meter Config"));
    // eslint-disable-next-line no-console
    console.log(chalk.dim("─".repeat(52)));
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(p, null, 2));
    // eslint-disable-next-line no-console
    console.log("");
    // eslint-disable-next-line no-console
    console.log(chalk.dim("  To change these defaults, run:") + " " + chalk.white("cloud-meter init"));
    // eslint-disable-next-line no-console
    console.log("");
  });

program
  .command("doctor")
  .description("Diagnose local setup, validate config, and suggest fixes")
  .argument("[path]", "path to validate", ".")
  .addHelpText(
    "after",
    `
Checks Node.js version, workspace structure, read permissions,
built artifacts, saved preferences, and runtime info.

Examples:
  $ cloud-meter doctor
  $ cloud-meter doctor ./backend
`
  )
  .action(async (path: string) => {
    await runDoctorCommand(path);
  });

// Custom no-args handler: show a friendly welcome instead of raw help
if (process.argv.length <= 2) {
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(chalk.bold("☁  Welcome to Cloud-Meter!"));
  // eslint-disable-next-line no-console
  console.log(chalk.dim("   Production-grade backend pagination efficiency analyzer"));
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(chalk.bold("Getting started:"));
  // eslint-disable-next-line no-console
  console.log(chalk.dim("─".repeat(52)));
  // eslint-disable-next-line no-console
  console.log(`  ${chalk.cyan("1.")}  ${chalk.white("cloud-meter init")}               ${chalk.dim("— Set up project config (optional)")}`);
  // eslint-disable-next-line no-console
  console.log(`  ${chalk.cyan("2.")}  ${chalk.white("cloud-meter analyze <path>")}     ${chalk.dim("— Scan your backend for pagination issues")}`);
  // eslint-disable-next-line no-console
  console.log(`  ${chalk.cyan("3.")}  ${chalk.white("cloud-meter recommend")}          ${chalk.dim("— View fix suggestions from analysis")}`);
  // eslint-disable-next-line no-console
  console.log(`  ${chalk.cyan("4.")}  ${chalk.white("cloud-meter doctor")}             ${chalk.dim("— Diagnose your setup")}`);
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(chalk.dim("  Run any command with --help for detailed options."));
  // eslint-disable-next-line no-console
  console.log(`  ${chalk.dim("Example:")} ${chalk.white("cloud-meter analyze --help")}`);
  // eslint-disable-next-line no-console
  console.log("");
  process.exit(0);
}

program.parseAsync(process.argv).catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

