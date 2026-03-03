import { describe, expect, it } from "vitest";
import { buildIssueList, buildRecommendations, buildRootCauses } from "../src/reporting/recommendation-engine.js";
import type { Finding } from "../src/types.js";

describe("recommendation-engine", () => {
    // ── buildIssueList ────────────────────────────────────────────────────

    describe("buildIssueList", () => {
        it("returns empty array for no findings", () => {
            expect(buildIssueList([])).toEqual([]);
        });

        it("returns unique messages", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "offset used", filePath: "a.ts" },
                { code: "OFFSET_USED", severity: "medium", message: "offset used", filePath: "b.ts" },
                { code: "NO_ORDER_BY", severity: "high", message: "no order", filePath: "a.ts" },
            ];
            const issues = buildIssueList(findings);
            expect(issues).toContain("offset used");
            expect(issues).toContain("no order");
            expect(issues).toHaveLength(2); // deduped
        });
    });

    // ── buildRootCauses ───────────────────────────────────────────────────

    describe("buildRootCauses", () => {
        it("returns empty array for no findings", () => {
            expect(buildRootCauses([])).toEqual([]);
        });

        it("extracts unique root causes", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "a.ts", rootCause: "rc1" },
                { code: "OFFSET_USED", severity: "medium", message: "y", filePath: "b.ts", rootCause: "rc1" },
                { code: "NO_ORDER_BY", severity: "high", message: "z", filePath: "a.ts", rootCause: "rc2" },
            ];
            const causes = buildRootCauses(findings);
            expect(causes).toContain("rc1");
            expect(causes).toContain("rc2");
            expect(causes).toHaveLength(2);
        });

        it("skips findings without rootCause", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "a.ts" },
            ];
            const causes = buildRootCauses(findings);
            expect(causes).toHaveLength(0);
        });
    });

    // ── buildRecommendations ──────────────────────────────────────────────

    describe("buildRecommendations", () => {
        it("returns empty array for no findings", () => {
            expect(buildRecommendations([])).toEqual([]);
        });

        it("adds keyset recommendation for OFFSET_USED", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "a.ts" },
            ];
            const recs = buildRecommendations(findings);
            expect(recs.some((r) => /keyset/i.test(r))).toBe(true);
        });

        it("adds keyset recommendation for DEEP_OFFSET", () => {
            const findings: Finding[] = [
                { code: "DEEP_OFFSET", severity: "high", message: "x", filePath: "a.ts" },
            ];
            const recs = buildRecommendations(findings);
            expect(recs.some((r) => /keyset/i.test(r))).toBe(true);
        });

        it("adds composite index recommendation for UNSTABLE_CURSOR", () => {
            const findings: Finding[] = [
                { code: "UNSTABLE_CURSOR", severity: "high", message: "x", filePath: "a.ts" },
            ];
            const recs = buildRecommendations(findings);
            expect(recs.some((r) => /composite index/i.test(r))).toBe(true);
        });

        it("adds composite index recommendation for NO_ORDER_BY", () => {
            const findings: Finding[] = [
                { code: "NO_ORDER_BY", severity: "high", message: "x", filePath: "a.ts" },
            ];
            const recs = buildRecommendations(findings);
            expect(recs.some((r) => /composite index/i.test(r))).toBe(true);
        });

        it("adds max page size recommendation for NO_PAGE_SIZE_CAP", () => {
            const findings: Finding[] = [
                { code: "NO_PAGE_SIZE_CAP", severity: "high", message: "x", filePath: "a.ts" },
            ];
            const recs = buildRecommendations(findings);
            expect(recs.some((r) => /max page size|50/i.test(r))).toBe(true);
        });

        it("adds max page size recommendation for MISSING_LIMIT", () => {
            const findings: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "x", filePath: "a.ts" },
            ];
            const recs = buildRecommendations(findings);
            expect(recs.some((r) => /max page size|50/i.test(r))).toBe(true);
        });

        it("includes per-finding recommendations", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "a.ts", recommendation: "custom rec" },
            ];
            const recs = buildRecommendations(findings);
            expect(recs).toContain("custom rec");
        });

        it("deduplicates recommendations", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "a", filePath: "a.ts", recommendation: "same rec" },
                { code: "OFFSET_USED", severity: "medium", message: "b", filePath: "b.ts", recommendation: "same rec" },
            ];
            const recs = buildRecommendations(findings);
            const count = recs.filter((r) => r === "same rec").length;
            expect(count).toBe(1);
        });
    });
});
