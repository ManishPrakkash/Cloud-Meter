import type { Severity, PaginationStrategy } from "../types.js";
import type { UserPreferences } from "../types.js";

export const defaultPreferences: UserPreferences = {
  defaultPath: ".",
  outputMode: "pretty",
  interactive: true,
  maxAllowedSeverity: "high",
  ignorePaths: ["node_modules", "dist", ".git"]
};