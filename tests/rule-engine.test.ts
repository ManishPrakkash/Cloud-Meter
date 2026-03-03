import { describe, expect, it } from "vitest";
import { RULES, categoryFor } from "../src/analysis/rule-engine.js";
import type { IssueCode, ScoreCategory } from "../src/types.js";

describe("rule-engine", () => {
    // These tests lock down the rule-engine so that rules can't be accidentally
    // deleted or miscategorized during vibe coding.

    const ALL_ISSUE_CODES: IssueCode[] = [
        "MISSING_LIMIT",
        "DEEP_OFFSET",
        "NO_ORDER_BY",
        "OFFSET_USED",
        "NO_PAGE_SIZE_CAP",
        "UNSTABLE_CURSOR",
        "MULTIPLICATION_SKIP",
        "MULTIPLE_UNBOUNDED_ENDPOINTS",
        "ORDER_BY_WITHOUT_INDEX_HINT",
        "CONCURRENT_WRITES_RISK",
        "INCONSISTENT_PAGE_SIZE_CONTROL",
        "INFINITE_SCROLL_UNSAFE",
        "POTENTIAL_FULL_COLLECTION_SCAN",
        "DYNAMIC_SORT_UNSAFE",
    ];

    it("has a rule entry for every IssueCode", () => {
        for (const code of ALL_ISSUE_CODES) {
            expect(RULES[code]).toBeTruthy();
            expect(RULES[code].code).toBe(code);
        }
    });

    it("every rule has a category", () => {
        for (const code of ALL_ISSUE_CODES) {
            expect(RULES[code].category).toBeTruthy();
            expect(typeof RULES[code].category).toBe("string");
        }
    });

    it("every rule has positive points", () => {
        for (const code of ALL_ISSUE_CODES) {
            expect(RULES[code].points).toBeGreaterThan(0);
        }
    });

    // ── Category assignments (prevents miscategorization) ──

    it("MISSING_LIMIT is categorized as Bounds", () => {
        expect(RULES.MISSING_LIMIT.category).toBe("Bounds");
    });

    it("NO_PAGE_SIZE_CAP is categorized as Bounds", () => {
        expect(RULES.NO_PAGE_SIZE_CAP.category).toBe("Bounds");
    });

    it("MULTIPLE_UNBOUNDED_ENDPOINTS is categorized as Bounds", () => {
        expect(RULES.MULTIPLE_UNBOUNDED_ENDPOINTS.category).toBe("Bounds");
    });

    it("NO_ORDER_BY is categorized as Ordering", () => {
        expect(RULES.NO_ORDER_BY.category).toBe("Ordering");
    });

    it("ORDER_BY_WITHOUT_INDEX_HINT is categorized as Ordering", () => {
        expect(RULES.ORDER_BY_WITHOUT_INDEX_HINT.category).toBe("Ordering");
    });

    it("UNSTABLE_CURSOR is categorized as CursorStability", () => {
        expect(RULES.UNSTABLE_CURSOR.category).toBe("CursorStability");
    });

    it("INFINITE_SCROLL_UNSAFE is categorized as CursorStability", () => {
        expect(RULES.INFINITE_SCROLL_UNSAFE.category).toBe("CursorStability");
    });

    it("OFFSET_USED is categorized as DepthCost", () => {
        expect(RULES.OFFSET_USED.category).toBe("DepthCost");
    });

    it("DEEP_OFFSET is categorized as DepthCost", () => {
        expect(RULES.DEEP_OFFSET.category).toBe("DepthCost");
    });

    it("MULTIPLICATION_SKIP is categorized as DepthCost", () => {
        expect(RULES.MULTIPLICATION_SKIP.category).toBe("DepthCost");
    });

    it("CONCURRENT_WRITES_RISK is categorized as Consistency", () => {
        expect(RULES.CONCURRENT_WRITES_RISK.category).toBe("Consistency");
    });

    it("DYNAMIC_SORT_UNSAFE is categorized as InputSafety", () => {
        expect(RULES.DYNAMIC_SORT_UNSAFE.category).toBe("InputSafety");
    });

    // ── Point values (prevents accidental changes) ──

    it("MISSING_LIMIT costs 30 points", () => {
        expect(RULES.MISSING_LIMIT.points).toBe(30);
    });

    it("DEEP_OFFSET costs 20 points", () => {
        expect(RULES.DEEP_OFFSET.points).toBe(20);
    });

    it("NO_ORDER_BY costs 15 points", () => {
        expect(RULES.NO_ORDER_BY.points).toBe(15);
    });

    it("OFFSET_USED costs 10 points", () => {
        expect(RULES.OFFSET_USED.points).toBe(10);
    });

    it("MULTIPLE_UNBOUNDED_ENDPOINTS costs 20 points", () => {
        expect(RULES.MULTIPLE_UNBOUNDED_ENDPOINTS.points).toBe(20);
    });

    // ── categoryFor helper ──

    it("categoryFor returns correct category", () => {
        expect(categoryFor("MISSING_LIMIT")).toBe("Bounds");
        expect(categoryFor("DEEP_OFFSET")).toBe("DepthCost");
        expect(categoryFor("NO_ORDER_BY")).toBe("Ordering");
        expect(categoryFor("DYNAMIC_SORT_UNSAFE")).toBe("InputSafety");
    });
});
