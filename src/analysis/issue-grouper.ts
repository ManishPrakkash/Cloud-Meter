import path from "node:path";
import type { AnalysisUnit, Finding, Layer, ScoreCategory } from "../types.js";
import { categoryFor } from "./rule-engine.js";
import type { DiscoveredUnit } from "../indexing/endpoint-discovery.js";

function normalize(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

function inferLayerFromPath(filePath: string): Layer {
  const p = normalize(filePath);
  if (p.includes("/routes/")) return "route";
  if (p.includes("/controllers/")) return "controller";
  if (p.includes("/services/")) return "service";
  if (p.includes("/repositories/") || p.includes("/repo/")) return "repository";
  if (p.includes("/models/") || p.includes("/entities/")) return "model";
  if (p.endsWith(".sql") || p.includes("/sql/")) return "sql";
  if (p.includes("/graphql/") || p.includes("/resolvers/")) return "graphql";
  if (p.includes("/utils/") || p.includes("/lib/")) return "utility";
  return "unknown";
}

function unitFromDiscovered(u: DiscoveredUnit): AnalysisUnit {
  return {
    id: u.id,
    kind: u.kind,
    name: u.name,
    entry: { filePath: u.filePath, lineRange: u.lineRange },
    callChain: u.callChain,
    files: [u.filePath],
    findings: [],
    score: 100,
    status: "Production Grade"
  };
}

function fallbackUnitForFile(filePath: string, backendRoot: string): AnalysisUnit {
  const rel = path.relative(backendRoot, filePath);
  const id = `file:${filePath}`;
  return {
    id,
    kind: "function",
    name: rel.length > 0 ? rel : path.basename(filePath),
    entry: { filePath },
    files: [filePath],
    findings: [],
    score: 100,
    status: "Production Grade"
  };
}

function assignCategory(finding: Finding): ScoreCategory | undefined {
  return finding.category ?? categoryFor(finding.code);
}

export interface GroupingResult {
  units: AnalysisUnit[];
  unassigned: Finding[];
}

/**
 * Groups raw findings into endpoint/resolver "units" when possible.
 * - Uses discovered units by file + lineRange proximity.
 * - Falls back to one unit per file when no entrypoints were discovered.
 */
export function groupFindingsIntoUnits(params: {
  backendRoot: string;
  discoveredUnits: DiscoveredUnit[];
  findings: Finding[];
}): GroupingResult {
  const units = params.discoveredUnits.map(unitFromDiscovered);
  const fileToUnits = new Map<string, AnalysisUnit[]>();
  for (const u of units) {
    const fp = u.entry?.filePath ?? u.files[0];
    const list = fileToUnits.get(fp) ?? [];
    list.push(u);
    fileToUnits.set(fp, list);
  }

  const unassigned: Finding[] = [];

  for (const finding of params.findings) {
    finding.layer = finding.layer ?? inferLayerFromPath(finding.filePath);
    finding.category = assignCategory(finding);

    // If already assigned upstream, respect it.
    if (finding.unitId) {
      const target = units.find((u) => u.id === finding.unitId);
      if (target) {
        target.findings.push(finding);
        if (!target.files.includes(finding.filePath)) target.files.push(finding.filePath);
        continue;
      }
    }

    const candidates = fileToUnits.get(finding.filePath) ?? [];
    if (candidates.length === 0) {
      // If we have a discovered entrypoint with a call chain, try to attach downstream findings.
      const downstream = units.find((u) =>
        (u.callChain ?? []).some((step) => normalize(step.filePath) === normalize(finding.filePath))
      );
      if (downstream) {
        finding.unitId = downstream.id;
        downstream.findings.push(finding);
        if (!downstream.files.includes(finding.filePath)) downstream.files.push(finding.filePath);
        continue;
      }

      // Create or reuse a file unit.
      let fileUnit = units.find((u) => u.id === `file:${finding.filePath}`);
      if (!fileUnit) {
        fileUnit = fallbackUnitForFile(finding.filePath, params.backendRoot);
        units.push(fileUnit);
        fileToUnits.set(finding.filePath, [fileUnit]);
      }
      finding.unitId = fileUnit.id;
      fileUnit.findings.push(finding);
      continue;
    }

    // Try best match by line range containment.
    const fLine = finding.lineRange?.[0] ?? 1;
    const matched =
      candidates.find((u) => {
        const r = u.entry?.lineRange;
        if (!r) return false;
        return fLine >= r[0] && fLine <= r[1];
      }) ?? candidates[0];

    finding.unitId = matched.id;
    matched.findings.push(finding);
    if (!matched.files.includes(finding.filePath)) matched.files.push(finding.filePath);
  }

  // Dedupe within unit (avoid score flooding + noisy UIs).
  for (const u of units) {
    const seen = new Set<string>();
    u.findings = u.findings.filter((f) => {
      const key = `${f.code}|${f.filePath}|${f.lineRange?.[0] ?? 1}|${f.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Keep all discovered units for drilldown UIs; empty units score as 100.
  const finalUnits = units;

  // Any finding that somehow did not get a unitId.
  for (const f of params.findings) {
    if (!f.unitId) unassigned.push(f);
  }

  return { units: finalUnits, unassigned };
}

