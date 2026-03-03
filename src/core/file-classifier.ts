import { globSync } from "glob";
import { DEFAULT_IGNORES } from "../config.js";
import { loadPreferences } from "../config/index.js";
import type { FileClassification } from "../types.js";

export function classifyFiles(backendRoot: string): FileClassification {
  const prefs = loadPreferences();
  const ignores = [...DEFAULT_IGNORES, ...(prefs.ignorePaths || [])];

  const sourceFiles = globSync("**/*.{ts,tsx,js,jsx}", {
    cwd: backendRoot,
    absolute: true,
    nodir: true,
    ignore: ignores
  });

  const sqlFiles = globSync("**/*.sql", {
    cwd: backendRoot,
    absolute: true,
    nodir: true,
    ignore: ignores
  });

  const byPath = (parts: string[]) =>
    sourceFiles.filter((file) => {
      const normalized = file.replace(/\\/g, "/").toLowerCase();
      return parts.some((p) => normalized.includes(`/${p}/`));
    });

  return {
    sourceFiles,
    sqlFiles,
    controllers: byPath(["controllers"]),
    routes: byPath(["routes"]),
    services: byPath(["services"]),
    models: byPath(["models"]),
    utils: byPath(["utils"])
  };
}
