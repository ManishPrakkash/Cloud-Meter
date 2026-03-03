import type { AggregatedSignals, Finding } from "../types.js";

export function buildSignals(findings: Finding[]): AggregatedSignals {
  const fileToCap = new Map<string, boolean>();
  const fileToPagination = new Map<string, boolean>();

  for (const finding of findings) {
    if (["OFFSET_USED", "UNSTABLE_CURSOR", "NO_ORDER_BY", "MISSING_LIMIT"].includes(finding.code)) {
      fileToPagination.set(finding.filePath, true);
    }
    if (finding.code === "NO_PAGE_SIZE_CAP") {
      fileToCap.set(finding.filePath, false);
    } else if (!fileToCap.has(finding.filePath)) {
      fileToCap.set(finding.filePath, true);
    }
  }

  const hasOffset = findings.some((f) => f.strategy === "offset" || f.code === "OFFSET_USED");
  const hasCursor = findings.some((f) => f.strategy === "cursor" || f.code === "UNSTABLE_CURSOR");
  const hasAnyPagination = hasOffset || hasCursor || fileToPagination.size > 0;

  let filesWithCap = 0;
  let filesWithoutCap = 0;
  for (const [file, hasPagination] of fileToPagination.entries()) {
    if (!hasPagination) continue;
    if (fileToCap.get(file) === false) {
      filesWithoutCap += 1;
    } else {
      filesWithCap += 1;
    }
  }

  const unboundedEndpoints = findings.filter((f) => f.code === "MISSING_LIMIT").length;

  return {
    hasOffset,
    hasCursor,
    hasAnyPagination,
    filesWithCap,
    filesWithoutCap,
    unboundedEndpoints
  };
}

export function enrichFindings(findings: Finding[], signals: AggregatedSignals): Finding[] {
  const enriched = [...findings];

  if (signals.filesWithCap > 0 && signals.filesWithoutCap > 0) {
    enriched.push({
      code: "INCONSISTENT_PAGE_SIZE_CONTROL",
      severity: "medium",
      message: "Inconsistent page size control detected across pagination endpoints.",
      filePath: "<project>",
      lineRange: [1, 1],
      rootCause: "Some endpoints enforce caps while others don't.",
      recommendation: "Centralize pagination validation in shared middleware/utility."
    });
  }

  if (signals.unboundedEndpoints > 1) {
    enriched.push({
      code: "MULTIPLE_UNBOUNDED_ENDPOINTS",
      severity: "critical",
      message: "Multiple unbounded pagination endpoints detected.",
      filePath: "<project>",
      lineRange: [1, 1],
      rootCause: "Repeated missing-limit patterns can cause systemic load risk.",
      recommendation: "Apply global max page-size guard and endpoint-level limits."
    });
  }

  const hasUnstableCursor = enriched.some((f) => f.code === "UNSTABLE_CURSOR");
  const hasOffsetNoOrder = enriched.some((f) => f.code === "OFFSET_USED") && enriched.some((f) => f.code === "NO_ORDER_BY");
  if (hasUnstableCursor || hasOffsetNoOrder) {
    enriched.push({
      code: "CONCURRENT_WRITES_RISK",
      severity: "high",
      message: "Pagination consistency risk under concurrent writes detected.",
      filePath: "<project>",
      lineRange: [1, 1],
      rootCause: "Unstable ordering/cursor can shift boundaries while data mutates.",
      recommendation: "Use stable, unique ordering and keyset pagination."
    });
  }

  const hasOrderWarnings = enriched.some((f) => f.code === "NO_ORDER_BY" || f.code === "DYNAMIC_SORT_UNSAFE");
  if (hasOrderWarnings) {
    enriched.push({
      code: "ORDER_BY_WITHOUT_INDEX_HINT",
      severity: "medium",
      message: "ORDER BY may not map to indexed columns (best-effort heuristic).",
      filePath: "<project>",
      lineRange: [1, 1],
      recommendation: "Add/verify composite index for ordered cursor fields (e.g. createdAt, _id)."
    });
  }

  return dedupeFindings(enriched);
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.code}|${f.filePath}||${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
