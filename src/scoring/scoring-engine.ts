import type { AnalysisUnit, Finding, IssueCode, RiskStatus, ScoreBreakdown, ScoreCategory } from "../types.js";
import { RULES } from "../analysis/rule-engine.js";

const DEDUCTIONS: Record<IssueCode, number> = {
  MISSING_LIMIT: 30,
  DEEP_OFFSET: 20,
  NO_ORDER_BY: 15,
  OFFSET_USED: 10,
  NO_PAGE_SIZE_CAP: 15,
  UNSTABLE_CURSOR: 10,
  MULTIPLICATION_SKIP: 10,
  MULTIPLE_UNBOUNDED_ENDPOINTS: 20,
  ORDER_BY_WITHOUT_INDEX_HINT: 8,
  CONCURRENT_WRITES_RISK: 12,
  INCONSISTENT_PAGE_SIZE_CONTROL: 8,
  INFINITE_SCROLL_UNSAFE: 12,
  POTENTIAL_FULL_COLLECTION_SCAN: -25,
  DYNAMIC_SORT_UNSAFE: -25,
  UNBOUNDED_FRONTEND_FETCH: -15,
};

const UNIT_DEDUCTION_CAP = 85;

function classifyStatus(score: number): RiskStatus {
  if (score >= 90) return "Production Grade";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs Optimization";
  if (score >= 40) return "High Risk";
  return "Critical";
}

export function computeScore(findings: Finding[]): ScoreBreakdown {
  const bestByCode = new Map<IssueCode, { points: number; reason: string; category?: ScoreCategory }>();

  // Category deductions are computed from unique codes (per unit).
  const categoryDeductions: Partial<Record<ScoreCategory, number>> = {};

  for (const finding of findings) {
    const base = DEDUCTIONS[finding.code] ?? 0;
    if (base <= 0) continue;

    const confidence = Math.max(0, Math.min(1, finding.confidence ?? 1));
    const points = base * confidence;

    const existing = bestByCode.get(finding.code);
    if (!existing || points > existing.points) {
      const category = finding.category ?? RULES[finding.code]?.category;
      bestByCode.set(finding.code, { points, reason: finding.message, category });
    }
  }

  let totalDeduction = 0;
  for (const entry of bestByCode.values()) {
    totalDeduction += entry.points;
    if (entry.category) {
      categoryDeductions[entry.category] = (categoryDeductions[entry.category] ?? 0) + entry.points;
    }
  }

  totalDeduction = Math.min(totalDeduction, UNIT_DEDUCTION_CAP);
  const score = Math.max(0, Math.round(100 - totalDeduction));

  const deductions: ScoreBreakdown["deductions"] = [...bestByCode.entries()].map(([code, v]) => ({
    code,
    points: Math.round(v.points),
    reason: v.reason
  }));

  const categories: Partial<Record<ScoreCategory, number>> = {};
  for (const [category, ded] of Object.entries(categoryDeductions) as Array<[ScoreCategory, number]>) {
    categories[category] = Math.max(0, Math.round(100 - Math.min(100, ded)));
  }

  return {
    score,
    status: classifyStatus(score),
    deductions,
    categories
  };
}

function unitWeight(unit: AnalysisUnit): number {
  const max = unit.findings.reduce<"critical" | "high" | "medium" | "low">((acc, f) => {
    const order = ["low", "medium", "high", "critical"] as const;
    return order.indexOf(f.severity) > order.indexOf(acc) ? f.severity : acc;
  }, "low");
  if (max === "critical") return 1.5;
  if (max === "high") return 1.25;
  return 1;
}

export function computeProjectScoreFromUnits(units: AnalysisUnit[]): {
  score: number;
  status: RiskStatus;
  categories: Partial<Record<ScoreCategory, number>>;
} {
  if (units.length === 0) {
    return { score: 100, status: "Production Grade", categories: {} };
  }

  let totalWeight = 0;
  let weightedScore = 0;

  const categoryTotals: Partial<Record<ScoreCategory, number>> = {};
  const categoryWeights: Partial<Record<ScoreCategory, number>> = {};

  for (const u of units) {
    const w = u.weight ?? unitWeight(u);
    totalWeight += w;
    weightedScore += w * u.score;

    if (u.categories) {
      for (const [cat, val] of Object.entries(u.categories) as Array<[ScoreCategory, number]>) {
        categoryTotals[cat] = (categoryTotals[cat] ?? 0) + w * val;
        categoryWeights[cat] = (categoryWeights[cat] ?? 0) + w;
      }
    }
  }

  const score = Math.round(weightedScore / Math.max(1e-9, totalWeight));
  const categories: Partial<Record<ScoreCategory, number>> = {};
  for (const [cat, sum] of Object.entries(categoryTotals) as Array<[ScoreCategory, number]>) {
    const w = categoryWeights[cat] ?? 0;
    if (w > 0) categories[cat] = Math.round(sum / w);
  }

  return { score, status: classifyStatus(score), categories };
}
