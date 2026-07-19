import type { IssueCode, ScoreCategory } from "../types.js";

export interface RuleInfo {
  code: IssueCode;
  category: ScoreCategory;
  /** Default points used by scoring when not overridden. */
  points: number;
}

export const RULES: Record<IssueCode, RuleInfo> = {
  MISSING_LIMIT: { code: "MISSING_LIMIT", category: "Bounds", points: 30 },
  NO_PAGE_SIZE_CAP: { code: "NO_PAGE_SIZE_CAP", category: "Bounds", points: 15 },
  MULTIPLE_UNBOUNDED_ENDPOINTS: { code: "MULTIPLE_UNBOUNDED_ENDPOINTS", category: "Bounds", points: 20 },

  NO_ORDER_BY: { code: "NO_ORDER_BY", category: "Ordering", points: 15 },
  ORDER_BY_WITHOUT_INDEX_HINT: { code: "ORDER_BY_WITHOUT_INDEX_HINT", category: "Ordering", points: 8 },

  UNSTABLE_CURSOR: { code: "UNSTABLE_CURSOR", category: "CursorStability", points: 10 },
  INFINITE_SCROLL_UNSAFE: { code: "INFINITE_SCROLL_UNSAFE", category: "CursorStability", points: 12 },

  OFFSET_USED: { code: "OFFSET_USED", category: "DepthCost", points: 10 },
  DEEP_OFFSET: { code: "DEEP_OFFSET", category: "DepthCost", points: 20 },
  MULTIPLICATION_SKIP: { code: "MULTIPLICATION_SKIP", category: "DepthCost", points: 10 },
  POTENTIAL_FULL_COLLECTION_SCAN: { code: "POTENTIAL_FULL_COLLECTION_SCAN", category: "DepthCost", points: 12 },

  CONCURRENT_WRITES_RISK: { code: "CONCURRENT_WRITES_RISK", category: "Consistency", points: 12 },
  INCONSISTENT_PAGE_SIZE_CONTROL: { code: "INCONSISTENT_PAGE_SIZE_CONTROL", category: "Consistency", points: 8 },

  DYNAMIC_SORT_UNSAFE: { code: "DYNAMIC_SORT_UNSAFE", category: "InputSafety", points: 8 },
  UNBOUNDED_FRONTEND_FETCH: { code: "UNBOUNDED_FRONTEND_FETCH", category: "Bounds", points: -15 }
};

export function categoryFor(code: IssueCode): ScoreCategory | undefined {
  return RULES[code]?.category;
}

