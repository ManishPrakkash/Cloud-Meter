import path from "node:path";
import fs from "node:fs/promises";
import { scanProject } from "../core/project-scanner.js";
import { detectAstPagination } from "../detectors/ast-pagination-detector.js";
import { detectGraphqlPagination } from "../detectors/graphql-pattern-detector.js";
import { detectSqlPagination } from "../detectors/sql-pagination-detector.js";
import { detectPaginationWrappers } from "../analyzers/pagination-wrapper-analyzer.js";
import { buildSignals, enrichFindings } from "../analyzers/pattern-analyzer.js";
import { computeProjectScoreFromUnits, computeScore } from "../scoring/scoring-engine.js";
import { buildIssueList, buildRecommendations, buildRootCauses } from "../reporting/recommendation-engine.js";
import type {
  AnalysisOptions,
  AnalysisMetrics,
  AnalysisResult,
  Finding,
  PaginationStrategy,
  Severity,
  TopUnitSummary,
} from "../types.js";
import { buildProjectIndex } from "../indexing/project-indexer.js";
import { groupFindingsIntoUnits } from "../analysis/issue-grouper.js";

function inferStrategy(findings: Finding[]): PaginationStrategy | "mixed" {
  const hasOffset = findings.some((f) => f.strategy === "offset" || f.code === "OFFSET_USED");
  const hasCursor = findings.some((f) => f.strategy === "cursor" || f.code === "UNSTABLE_CURSOR");
  if (hasOffset && hasCursor) return "mixed";
  if (hasOffset) return "offset";
  if (hasCursor) return "cursor";
  return "none";
}

function severityRank(s: Severity): number {
  if (s === "critical") return 3;
  if (s === "high") return 2;
  if (s === "medium") return 1;
  return 0;
}

function buildTopUnits(result: AnalysisResult, limit = 5): TopUnitSummary[] {
  const units = result.units ?? [];
  if (units.length === 0) return [];

  const scored = [...units].map<TopUnitSummary>((u) => {
    const issueCount = u.findings.length;
    const severities = u.findings.map((f) => f.severity);
    const maxSeverity =
      severities.length === 0
        ? null
        : severities.reduce((best, s) =>
            severityRank(s) > severityRank(best) ? s : best
          );

    const primaryFinding = [...u.findings].sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity)
    )[0];

    const entryFromFinding =
      primaryFinding && primaryFinding.filePath !== "<project>"
        ? {
            filePath: primaryFinding.filePath,
            line: primaryFinding.lineRange?.[0],
          }
        : undefined;

    const entryFile = u.entry?.filePath ?? entryFromFinding?.filePath;
    const entryLine = u.entry?.lineRange?.[0] ?? entryFromFinding?.line;

    return {
      id: u.id,
      name: u.name,
      kind: u.kind,
      score: u.score,
      status: u.status,
      maxSeverity,
      issueCount,
      primaryRisk: primaryFinding?.message,
      entryFile,
      entryLine,
    };
  });

  const sorted = scored.sort((a, b) => {
    const aRank = a.maxSeverity ? severityRank(a.maxSeverity) : -1;
    const bRank = b.maxSeverity ? severityRank(b.maxSeverity) : -1;
    if (bRank !== aRank) return bRank - aRank;
    if (a.score !== b.score) return a.score - b.score;
    if (b.issueCount !== a.issueCount) return b.issueCount - a.issueCount;
    return a.name.localeCompare(b.name);
  });

  return sorted.slice(0, limit);
}

function buildNextActions(result: AnalysisResult): string[] {
  const metrics = result.metrics ?? result.breakdown;
  if (!metrics) return [];

  const actions: string[] = [];

  if ((metrics.unboundedUnits ?? 0) > 0) {
    actions.push(
      "Add hard cap + default limit (e.g. 50) in shared validation for unbounded endpoints."
    );
  }

  if ((metrics.deepOffsetUnits ?? 0) > 0) {
    actions.push(
      "Move top endpoints from deep OFFSET to keyset pagination using stable unique keys."
    );
  }

  if (
    typeof metrics.stableOrderCoveragePercent === "number" &&
    metrics.stableOrderCoveragePercent < 100
  ) {
    actions.push(
      "Add deterministic ORDER BY with a tie-breaker key (e.g. primary key) on all paginated queries."
    );
  }

  if ((metrics.unsafeSortUnits ?? 0) > 0) {
    actions.push(
      "Whitelist allowed sort keys and map them to indexed columns before building ORDER BY clauses."
    );
  }

  return actions.slice(0, 3);
}

export async function runAnalysis(options: AnalysisOptions): Promise<AnalysisResult> {
  const context = scanProject(options.targetPath);
  const index = buildProjectIndex(context);
  const classified = index.files;

  const findings: Finding[] = [];
  const sourceFindingsArrays = await Promise.all(classified.sourceFiles.map(async sourceFile => {
    return [
      ...detectAstPagination(sourceFile),
      ...detectGraphqlPagination(sourceFile),
      ...detectPaginationWrappers(sourceFile)
    ];
  }));
  findings.push(...sourceFindingsArrays.flat());

  const sqlFindingsArrays = await Promise.all(classified.sqlFiles.map(async sqlFile => {
    return detectSqlPagination(sqlFile);
  }));
  findings.push(...sqlFindingsArrays.flat());

  const signals = buildSignals(findings);
  const finalFindings = enrichFindings(findings, signals);

  const grouped = groupFindingsIntoUnits({
    backendRoot: index.backendRoot,
    discoveredUnits: index.discoveredUnits,
    findings: finalFindings
  });

  // Score units (production model) and then aggregate to a project score.
  for (const unit of grouped.units) {
    const unitScore = computeScore(unit.findings);
    unit.score = unitScore.score;
    unit.status = unitScore.status;
    unit.categories = unitScore.categories;
  }
  const projectScore = computeProjectScoreFromUnits(grouped.units);

  const totalUnits = grouped.units.length;
  const unitsWithIssues = grouped.units.filter((u) => u.findings.length > 0);
  const criticalUnits = unitsWithIssues.filter((u) =>
    u.findings.some((f) => f.severity === "critical")
  );
  const highUnits = unitsWithIssues.filter((u) => {
    return u.findings.some((f) => f.severity === "critical" || f.severity === "high");
  });

  const unitsWithBounds = grouped.units.filter((u) =>
    !u.findings.some((f) => f.code === "MISSING_LIMIT" || f.code === "NO_PAGE_SIZE_CAP")
  );
  const offsetUnits = grouped.units.filter((u) =>
    u.findings.some((f) => f.strategy === "offset" || f.code === "OFFSET_USED" || f.code === "DEEP_OFFSET")
  );
  const cursorUnits = grouped.units.filter((u) =>
    u.findings.some((f) => f.strategy === "cursor" || f.code === "UNSTABLE_CURSOR" || f.code === "INFINITE_SCROLL_UNSAFE")
  );
  const stableOrderUnits = grouped.units.filter((u) =>
    !u.findings.some((f) => f.code === "NO_ORDER_BY")
  );
  const deepOffsetUnits = grouped.units.filter((u) =>
    u.findings.some((f) => f.code === "DEEP_OFFSET")
  );
  const unboundedUnits = grouped.units.filter((u) =>
    u.findings.some((f) => f.code === "MISSING_LIMIT" || f.code === "NO_PAGE_SIZE_CAP")
  );
  const unsafeSortUnits = grouped.units.filter((u) =>
    u.findings.some((f) => f.code === "DYNAMIC_SORT_UNSAFE")
  );

  const pct = (count: number): number | undefined =>
    totalUnits > 0 ? Math.round((count / totalUnits) * 100) : undefined;

  const metrics: AnalysisMetrics = {
    unitsScored: totalUnits,
    unitsWithIssues: unitsWithIssues.length,
    criticalUnits: criticalUnits.length,
    highUnits: highUnits.length,
    unitsWithBounds: unitsWithBounds.length,
    offsetUnits: offsetUnits.length,
    cursorUnits: cursorUnits.length,
    boundsCoveragePercent: pct(unitsWithBounds.length),
    keysetUsagePercent: pct(cursorUnits.length),
    offsetUsagePercent: pct(offsetUnits.length),
    stableOrderCoveragePercent: pct(stableOrderUnits.length),
    deepOffsetUnits: deepOffsetUnits.length,
    unboundedUnits: unboundedUnits.length,
    unsafeSortUnits: unsafeSortUnits.length,
  };

  const result: AnalysisResult = {
    schemaVersion: 2,
    project: path.basename(context.rootPath),
    backendRoot: index.backendRoot,
    orm: context.detectedOrm,
    detectedStrategy: inferStrategy(finalFindings),
    score: projectScore.score,
    status: projectScore.status,
    findings: finalFindings,
    issues: buildIssueList(finalFindings),
    rootCauses: buildRootCauses(finalFindings),
    recommendations: buildRecommendations(finalFindings),
    filesScanned: classified.sourceFiles.length + classified.sqlFiles.length,
    units: grouped.units,
    breakdown: {
      categories: projectScore.categories,
      ...metrics,
    },
    metrics,
  };

  // Precompute top risky units and next actions for all UIs / JSON consumers.
  result.topUnits = buildTopUnits(result);
  result.nextActions = buildNextActions(result);

  const cacheDir = path.resolve(process.cwd(), ".cloud-meter");
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(
    path.join(cacheDir, "cache.json"),
    JSON.stringify(
      {
        schemaVersion: result.schemaVersion,
        findings: result.findings,
        issues: result.issues,
        recommendations: result.recommendations,
        units: result.units,
        breakdown: result.breakdown,
        metrics: result.metrics,
        topUnits: result.topUnits,
        nextActions: result.nextActions,
      },
      null,
      2
    ),
    "utf-8"
  );

  return result;
}
