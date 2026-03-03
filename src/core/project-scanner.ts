import path from "node:path";
import { existsSync } from "node:fs";
import { globSync } from "glob";
import { loadPreferences } from "../config/index.js";
import { BACKEND_DIR_HINTS, DEFAULT_IGNORES } from "../config.js";
import type { ScanContext } from "../types.js";

function toAbsolute(inputPath: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function detectOrm(root: string): string[] {
  const prefs = loadPreferences();
  const options = {
    cwd: root,
    ignore: [...DEFAULT_IGNORES, ...(prefs.ignorePaths || [])],
    absolute: true,
    nodir: true
  };
  
  const files = globSync("**/*.{ts,tsx,js,jsx}", options).slice(0, 250);

  const orm = new Set<string>();
  for (const file of files) {
    const lower = file.toLowerCase();
    if (lower.includes("prisma")) orm.add("Prisma");
    if (lower.includes("mongoose") || lower.includes("model")) orm.add("Mongoose");
    if (lower.includes("sequelize")) orm.add("Sequelize");
  }

  return [...orm];
}

export function scanProject(targetPath: string): ScanContext {
  const rootPath = toAbsolute(targetPath);
  const backendRoot = rootPath;

  const packageJsonPath = path.join(backendRoot, "package.json");
  const tsconfigPath = path.join(backendRoot, "tsconfig.json");

  return {
    rootPath,
    backendRoot,
    packageJsonPath: existsSync(packageJsonPath) ? packageJsonPath : undefined,
    tsconfigPath: existsSync(tsconfigPath) ? tsconfigPath : undefined,
    detectedOrm: detectOrm(backendRoot)
  };
}
