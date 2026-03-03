import path from "node:path";
import { existsSync } from "node:fs";
import { Project } from "ts-morph";
import { BACKEND_DIR_HINTS } from "../config.js";
import { classifyFiles } from "../core/file-classifier.js";
import type { FileClassification, ScanContext } from "../types.js";
import { discoverUnitsInFile, type DiscoveredUnit } from "./endpoint-discovery.js";
import { buildCallChain } from "./callgraph.js";

export interface ProjectIndex {
  rootPath: string;
  backendRoot: string;
  files: FileClassification;
  discoveredUnits: DiscoveredUnit[];
  tsProject?: Project;
}

function detectBackendRoot(rootPath: string): string {
  // Best-effort: if user points at monorepo root, try common backend dirs.
  for (const hint of BACKEND_DIR_HINTS) {
    const candidate = path.resolve(rootPath, hint);
    if (existsSync(candidate)) return candidate;
  }
  return rootPath;
}

function tryCreateTsProject(context: ScanContext, backendRoot: string): Project | undefined {
  const tsconfig = context.tsconfigPath;
  if (tsconfig && existsSync(tsconfig)) {
    try {
      return new Project({ tsConfigFilePath: tsconfig });
    } catch {
      // fall through
    }
  }

  // Fallback: attempt a JS/TS project without a config (best-effort).
  try {
    const project = new Project({
      compilerOptions: {
        allowJs: true,
        checkJs: false
      },
      skipAddingFilesFromTsConfig: true
    });
    // Add only backend-root sources; indexing needs symbols, not type perfection.
    project.addSourceFilesAtPaths([
      path.join(backendRoot, "**/*.{ts,tsx,js,jsx}")
    ]);
    return project;
  } catch {
    return undefined;
  }
}

export function buildProjectIndex(context: ScanContext): ProjectIndex {
  const backendRoot = detectBackendRoot(context.rootPath);
  const files = classifyFiles(backendRoot);

  // Discover entrypoints (routes/resolvers). Limit cost by sampling likely files first.
  const candidates = [
    ...files.routes,
    ...files.controllers,
    ...files.services,
    ...files.sourceFiles.slice(0, 200)
  ];
  const seen = new Set<string>();
  const dedupedCandidates = candidates.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  const discoveredUnits: DiscoveredUnit[] = [];
  for (const filePath of dedupedCandidates) {
    try {
      discoveredUnits.push(...discoverUnitsInFile(filePath));
    } catch {
      // ignore parse errors for indexing phase
    }
  }

  const tsProject = tryCreateTsProject(context, backendRoot);
  if (tsProject) {
    for (const unit of discoveredUnits) {
      if (!unit.entrySymbol) continue;
      try {
        unit.callChain = buildCallChain({
          project: tsProject,
          entry: { filePath: unit.filePath, symbol: unit.entrySymbol },
          maxDepth: 6,
          maxNodes: 25
        });
      } catch {
        // ignore call chain failures; still provide unit discovery
      }
    }
  }

  return {
    rootPath: context.rootPath,
    backendRoot,
    files,
    discoveredUnits,
    tsProject
  };
}

