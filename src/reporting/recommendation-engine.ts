import type { Finding } from "../types.js";

export function buildIssueList(findings: Finding[]): string[] {
  const unique = new Set<string>();
  for (const finding of findings) {
    unique.add(finding.message);
  }
  return [...unique];
}

export function buildRootCauses(findings: Finding[]): string[] {
  const causes = new Set<string>();
  for (const finding of findings) {
    if (finding.rootCause) causes.add(finding.rootCause);
  }
  return [...causes];
}

export function buildRecommendations(findings: Finding[]): string[] {
  const recommendations = new Set<string>();

  for (const finding of findings) {
    if (finding.recommendation) recommendations.add(finding.recommendation);
  }

  if (findings.some((f) => f.code === "OFFSET_USED" || f.code === "DEEP_OFFSET")) {
    recommendations.add("Switch to keyset pagination where endpoints are high-volume.");
  }

  if (findings.some((f) => f.code === "UNSTABLE_CURSOR" || f.code === "NO_ORDER_BY")) {
    recommendations.add("Add composite index for stable cursor sort keys (e.g. createdAt, _id).");
  }

  if (findings.some((f) => f.code === "NO_PAGE_SIZE_CAP" || f.code === "MISSING_LIMIT")) {
    recommendations.add("Enforce max page size = 50 at validation layer.");
  }

  return [...recommendations];
}
