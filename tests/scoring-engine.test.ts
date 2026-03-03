import { describe, expect, it } from "vitest";
import { computeScore, computeProjectScoreFromUnits } from "../src/scoring/scoring-engine.js";
import type { AnalysisUnit, Finding, IssueCode, ScoreCategory } from "../src/types.js";

describe("scoring-engine", () => {
    // ── computeScore ──────────────────────────────────────────────────────

    describe("computeScore", () => {
        it("returns 100 for empty findings", () => {
            const result = computeScore([]);
            expect(result.score).toBe(100);
            expect(result.status).toBe("Production Grade");
            expect(result.deductions).toHaveLength(0);
        });

        it("deduces MISSING_LIMIT = -30", () => {
            const findings: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "no limit", filePath: "x" },
            ];
            const result = computeScore(findings);
            expect(result.score).toBe(70);
            expect(result.deductions.find((d) => d.code === "MISSING_LIMIT")?.points).toBe(30);
        });

        it("deduces DEEP_OFFSET = -20", () => {
            const findings: Finding[] = [
                { code: "DEEP_OFFSET", severity: "high", message: "deep skip", filePath: "x" },
            ];
            const result = computeScore(findings);
            expect(result.score).toBe(80);
        });

        it("deduces NO_ORDER_BY = -15", () => {
            const findings: Finding[] = [
                { code: "NO_ORDER_BY", severity: "high", message: "no order", filePath: "x" },
            ];
            const result = computeScore(findings);
            expect(result.score).toBe(85);
        });

        it("deduces OFFSET_USED = -10", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "offset", filePath: "x" },
            ];
            const result = computeScore(findings);
            expect(result.score).toBe(90);
        });

        it("deduces UNSTABLE_CURSOR = -10", () => {
            const findings: Finding[] = [
                { code: "UNSTABLE_CURSOR", severity: "high", message: "unstable cursor", filePath: "x" },
            ];
            const result = computeScore(findings);
            expect(result.score).toBe(90);
        });

        it("deduces MULTIPLICATION_SKIP = -10", () => {
            const findings: Finding[] = [
                { code: "MULTIPLICATION_SKIP", severity: "medium", message: "mult skip", filePath: "x" },
            ];
            const result = computeScore(findings);
            expect(result.score).toBe(90);
        });

        it("deduces MULTIPLE_UNBOUNDED_ENDPOINTS = -20", () => {
            const findings: Finding[] = [
                { code: "MULTIPLE_UNBOUNDED_ENDPOINTS", severity: "critical", message: "many endpoints", filePath: "x" },
            ];
            const result = computeScore(findings);
            expect(result.score).toBe(80);
        });

        it("deduces NO_PAGE_SIZE_CAP = -15", () => {
            const findings: Finding[] = [
                { code: "NO_PAGE_SIZE_CAP", severity: "high", message: "no cap", filePath: "x" },
            ];
            const result = computeScore(findings);
            expect(result.score).toBe(85);
        });

        it("deduplicates same issue code (only counts once)", () => {
            const findings: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "x" },
                { code: "MISSING_LIMIT", severity: "critical", message: "b", filePath: "y" },
                { code: "MISSING_LIMIT", severity: "critical", message: "c", filePath: "z" },
            ];
            const result = computeScore(findings);
            // MISSING_LIMIT counted once = -30
            expect(result.score).toBe(70);
        });

        it("stacks deductions from different issue codes", () => {
            const findings: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "x" },
                { code: "DEEP_OFFSET", severity: "high", message: "b", filePath: "x" },
                { code: "NO_ORDER_BY", severity: "high", message: "c", filePath: "x" },
            ];
            const result = computeScore(findings);
            // -30 + -20 + -15 = -65
            expect(result.score).toBe(35);
        });

        it("caps total deduction at 85 (floor is 15)", () => {
            const findings: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "x" },
                { code: "DEEP_OFFSET", severity: "high", message: "b", filePath: "x" },
                { code: "NO_ORDER_BY", severity: "high", message: "c", filePath: "x" },
                { code: "MULTIPLE_UNBOUNDED_ENDPOINTS", severity: "critical", message: "d", filePath: "x" },
                { code: "NO_PAGE_SIZE_CAP", severity: "high", message: "e", filePath: "x" },
                { code: "UNSTABLE_CURSOR", severity: "high", message: "f", filePath: "x" },
            ];
            const result = computeScore(findings);
            // Sum > 85 => score = max(0, 100-85) = 15
            expect(result.score).toBe(15);
        });

        it("applies confidence multiplier to deductions", () => {
            const findings: Finding[] = [
                { code: "DEEP_OFFSET", severity: "high", message: "x", filePath: "x", confidence: 0.5 },
            ];
            const result = computeScore(findings);
            // base 20 * 0.5 = 10 => score = 90
            expect(result.score).toBe(90);
        });

        // ── Status classification ──

        it("classifies 100 as Production Grade", () => {
            expect(computeScore([]).status).toBe("Production Grade");
        });

        it("classifies 90 as Production Grade", () => {
            const f: Finding[] = [{ code: "OFFSET_USED", severity: "medium", message: "x", filePath: "x" }];
            expect(computeScore(f).status).toBe("Production Grade");
        });

        it("classifies 85 as Good", () => {
            const f: Finding[] = [{ code: "NO_ORDER_BY", severity: "high", message: "x", filePath: "x" }];
            expect(computeScore(f).status).toBe("Good");
        });

        it("classifies 70 as Needs Optimization", () => {
            const f: Finding[] = [{ code: "MISSING_LIMIT", severity: "critical", message: "x", filePath: "x" }];
            expect(computeScore(f).status).toBe("Needs Optimization");
        });

        it("classifies 55 as High Risk", () => {
            const f: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "x" },
                { code: "NO_ORDER_BY", severity: "high", message: "b", filePath: "x" },
            ];
            expect(computeScore(f).status).toBe("High Risk");
        });

        it("classifies 15 as Critical", () => {
            const f: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "x" },
                { code: "DEEP_OFFSET", severity: "high", message: "b", filePath: "x" },
                { code: "NO_ORDER_BY", severity: "high", message: "c", filePath: "x" },
                { code: "MULTIPLE_UNBOUNDED_ENDPOINTS", severity: "critical", message: "d", filePath: "x" },
                { code: "NO_PAGE_SIZE_CAP", severity: "high", message: "e", filePath: "x" },
                { code: "UNSTABLE_CURSOR", severity: "high", message: "f", filePath: "x" },
            ];
            expect(computeScore(f).status).toBe("Critical");
        });

        // ── Category breakdown ──

        it("produces Bounds category from MISSING_LIMIT", () => {
            const f: Finding[] = [{ code: "MISSING_LIMIT", severity: "critical", message: "x", filePath: "x" }];
            const result = computeScore(f);
            expect(result.categories?.Bounds).toBeDefined();
            expect(result.categories!.Bounds).toBe(70); // 100 - 30
        });

        it("produces Ordering category from NO_ORDER_BY", () => {
            const f: Finding[] = [{ code: "NO_ORDER_BY", severity: "high", message: "x", filePath: "x" }];
            const result = computeScore(f);
            expect(result.categories?.Ordering).toBe(85); // 100 - 15
        });

        it("produces DepthCost category from DEEP_OFFSET", () => {
            const f: Finding[] = [{ code: "DEEP_OFFSET", severity: "high", message: "x", filePath: "x" }];
            const result = computeScore(f);
            expect(result.categories?.DepthCost).toBe(80); // 100 - 20
        });
    });

    // ── computeProjectScoreFromUnits ──────────────────────────────────────

    describe("computeProjectScoreFromUnits", () => {
        it("returns 100 for empty units array", () => {
            const result = computeProjectScoreFromUnits([]);
            expect(result.score).toBe(100);
            expect(result.status).toBe("Production Grade");
        });

        it("returns exact unit score when only one unit", () => {
            const units: AnalysisUnit[] = [{
                id: "u1", kind: "http", name: "GET /users",
                files: [], findings: [], score: 70, status: "Needs Optimization",
            }];
            const result = computeProjectScoreFromUnits(units);
            expect(result.score).toBe(70);
        });

        it("averages scores across multiple clean units", () => {
            const units: AnalysisUnit[] = [
                { id: "u1", kind: "http", name: "GET /a", files: [], findings: [], score: 100, status: "Production Grade" },
                { id: "u2", kind: "http", name: "GET /b", files: [], findings: [], score: 100, status: "Production Grade" },
            ];
            const result = computeProjectScoreFromUnits(units);
            expect(result.score).toBe(100);
        });

        it("weights critical units higher (1.5x weight)", () => {
            const units: AnalysisUnit[] = [
                {
                    id: "u1", kind: "http", name: "GET /a", files: [],
                    findings: [{ code: "MISSING_LIMIT", severity: "critical", message: "x", filePath: "x" }],
                    score: 30, status: "Critical",
                },
                {
                    id: "u2", kind: "http", name: "GET /b", files: [],
                    findings: [],
                    score: 100, status: "Production Grade",
                },
            ];
            const result = computeProjectScoreFromUnits(units);
            // critical weight = 1.5, clean weight = 1 => (1.5*30 + 1*100) / 2.5 = 58
            expect(result.score).toBe(58);
        });

        it("aggregates category scores across units", () => {
            const units: AnalysisUnit[] = [
                {
                    id: "u1", kind: "http", name: "G1", files: [],
                    findings: [], score: 80, status: "Good",
                    categories: { Bounds: 60 },
                },
                {
                    id: "u2", kind: "http", name: "G2", files: [],
                    findings: [], score: 90, status: "Production Grade",
                    categories: { Bounds: 100 },
                },
            ];
            const result = computeProjectScoreFromUnits(units);
            expect(result.categories.Bounds).toBeDefined();
            // Both weight 1 => (60 + 100) / 2 = 80
            expect(result.categories.Bounds).toBe(80);
        });
    });
});
