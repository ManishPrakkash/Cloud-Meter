import { cosmiconfigSync } from "cosmiconfig";
import type { AnalysisOptions, UserPreferences } from "../types.js";
import { defaultPreferences } from "../constants/index.js";

export function loadPreferences(): UserPreferences {
  const explorer = cosmiconfigSync("cloud-meter");
  const result = explorer.search();
  if (result && !result.isEmpty) {
    return { ...defaultPreferences, ...result.config };
  }
  return defaultPreferences;
}

export function persistPreferences(input: Partial<UserPreferences>): void {
  // Not used directly anymore, replaced by init command
}

export function mergeOptions(base: AnalysisOptions): AnalysisOptions {
  const prefs = loadPreferences();
  return {
    ...base,
    targetPath: base.targetPath || prefs.defaultPath,
    outputMode: base.outputMode ?? (base.asJson ? "json" : prefs.outputMode),
    interactive: base.interactive ?? prefs.interactive
  };
}
