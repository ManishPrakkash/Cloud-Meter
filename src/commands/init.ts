import fs from "node:fs";
import path from "node:path";
import { input, select, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { defaultPreferences } from "../constants/index.js";

export async function runInitCommand(): Promise<void> {
  console.log(chalk.cyan("Welcome to the cloud-meter configuration wizard!\n"));

  const targetPath = await input({
    message: "What is your default target path to analyze?",
    default: defaultPreferences.defaultPath,
  });

  const outputMode = await select<"pretty" | "json" | "minimal">({
    message: "Which output mode do you prefer?",
    default: defaultPreferences.outputMode,
    choices: [
      { name: "Pretty (Colorful full report)", value: "pretty" },
      { name: "Minimal (Short actionable summary)", value: "minimal" },
      { name: "JSON (Machine-readable)", value: "json" },
    ],
  });

  const maxAllowedSeverity = await select<"critical" | "high" | "medium" | "low">({
    message: "What is the maximum allowed severity for findings?",
    default: defaultPreferences.maxAllowedSeverity,
    choices: [
      { name: "Critical", value: "critical" },
      { name: "High", value: "high" },
      { name: "Medium", value: "medium" },
      { name: "Low", value: "low" },
    ],
  });

  const enforceStrategy = await select<"none" | "cursor" | "offset">({
    message: "Which pagination strategy do you want to enforce?",
    default: defaultPreferences.enforceStrategy ?? "none",
    choices: [
      { name: "None", value: "none" },
      { name: "Cursor-based", value: "cursor" },
      { name: "Offset-based", value: "offset" },
    ],
  });

  const ignorePathsRaw = await input({
    message: "Directories to ignore (comma separated)?",
    default: defaultPreferences.ignorePaths.join(", "),
  });

  const interactive = await confirm({
    message: "Run in interactive mode by default?",
    default: defaultPreferences.interactive,
  });

  const config = {
    defaultPath: targetPath,
    outputMode,
    maxAllowedSeverity,
    enforceStrategy,
    ignorePaths: ignorePathsRaw.split(",").map((p) => p.trim()).filter(Boolean),
    interactive,
  };

  const configPath = path.resolve(process.cwd(), "cloud-meter.config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

  console.log(chalk.green(`\n✔ Config saved → ${configPath}`));
  console.log("");
  console.log(chalk.bold("What's next?"));
  console.log(chalk.dim("─".repeat(52)));
  console.log(`  ${chalk.cyan("1.")}  ${chalk.white("cloud-meter analyze")}  ${chalk.dim("— Run full pagination analysis using your saved config")}`);
  console.log(`  ${chalk.cyan("2.")}  ${chalk.white("cloud-meter doctor")}   ${chalk.dim("— Verify your environment is set up correctly")}`);
  console.log(`  ${chalk.cyan("3.")}  ${chalk.white("cloud-meter config")}   ${chalk.dim("— View your saved defaults anytime")}`);
  console.log("");
  console.log(chalk.dim("Tip: Your config is auto-loaded on every run. No need to pass flags manually."));
}