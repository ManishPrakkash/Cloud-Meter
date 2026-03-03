import type { AnalysisResult } from "../types.js";

export function renderJsonReport(result: AnalysisResult): string {
  return JSON.stringify(
    {
      schemaVersion: result.schemaVersion,
      project: result.project,
      backendRoot: result.backendRoot,
      orm: result.orm,
      detectedStrategy: result.detectedStrategy,
      score: result.score,
      status: result.status,
      findings: result.findings,
      issues: result.issues,
      rootCauses: result.rootCauses,
      recommendations: result.recommendations,
      filesScanned: result.filesScanned,
      units: result.units,
      breakdown: result.breakdown,
      metrics: result.metrics,
      topUnits: result.topUnits,
      nextActions: result.nextActions,
      runtime: result.runtime,
    },
    null,
    2
  );
}
