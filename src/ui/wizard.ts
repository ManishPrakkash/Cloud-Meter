import { confirm, input, select } from "@inquirer/prompts";
import type { AnalysisOptions } from "../types.js";
import { persistPreferences } from "../config/index.js";

export async function runAnalyzeWizard(seed: AnalysisOptions): Promise<AnalysisOptions> {
  const targetPath = await input({
    message: "Which path do you want to analyze?",
    default: seed.targetPath || ".",
    validate: (value) => (value.trim().length === 0 ? "Please provide a valid path" : true)
  });

  const outputMode = await select<"pretty" | "json" | "minimal">({
    message: "Choose output mode",
    default: seed.outputMode ?? "pretty",
    choices: [
      { name: "Pretty report (recommended)", value: "pretty", description: "Colorful full report" },
      { name: "Minimal", value: "minimal", description: "Short actionable summary" },
      { name: "JSON", value: "json", description: "CI/CD friendly machine output" }
    ]
  });

  const verbose = await confirm({
    message: "Enable verbose debug logs?",
    default: Boolean(seed.verbose)
  });

  const remember = await confirm({
    message: "Remember these defaults for next run?",
    default: true
  });

  if (remember) {
    persistPreferences({
      defaultPath: targetPath,
      outputMode,
      interactive: true
    });
  }

  return {
    ...seed,
    targetPath,
    outputMode,
    asJson: outputMode === "json",
    verbose,
    interactive: true
  };
}
