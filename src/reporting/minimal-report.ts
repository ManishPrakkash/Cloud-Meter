import chalk from "chalk";
import type { AnalysisResult } from "../types.js";

export function renderMinimalReport(result: AnalysisResult): string {
  const topIssues = result.issues.slice(0, 4);
  const quickWins = result.recommendations.slice(0, 3);

  const lines: string[] = [];
  lines.push(chalk.bold(`Score: ${result.score}/100 (${result.status})`));
  lines.push(`Strategy: ${result.detectedStrategy} | Files: ${result.filesScanned}`);

  const m = result.metrics ?? result.breakdown;
  if (m) {
    const hotspotParts: string[] = [];
    if ((m.deepOffsetUnits ?? 0) > 0) hotspotParts.push(`${m.deepOffsetUnits} deep-offset units`);
    if ((m.unboundedUnits ?? 0) > 0) hotspotParts.push(`${m.unboundedUnits} unbounded units`);
    if ((m.unsafeSortUnits ?? 0) > 0) hotspotParts.push(`${m.unsafeSortUnits} unsafe-sort units`);
    if (hotspotParts.length > 0) {
      lines.push(`Hotspots: ${hotspotParts.join(" | ")}`);
    }
  }

  const topUnits = result.topUnits ?? [];
  if (topUnits.length > 0) {
    lines.push("Top risky units:");
    for (const u of topUnits.slice(0, 3)) {
      const sev = u.maxSeverity ?? "low";
      const loc =
        u.entryFile && u.entryLine
          ? `${u.entryFile}:${u.entryLine}`
          : "<unknown>";
      lines.push(
        `- ${u.name} [${sev}] issues=${u.issueCount} @ ${loc}`
      );
    }
  }

  if (topIssues.length > 0) {
    lines.push("Issues:");
    for (const issue of topIssues) lines.push(`- ${issue}`);
  }

  if (quickWins.length > 0) {
    lines.push("Quick wins:");
    for (const win of quickWins) lines.push(`- ${win}`);
  }

  return lines.join("\n");
}
