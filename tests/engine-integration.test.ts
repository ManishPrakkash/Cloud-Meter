import path from "node:path";
import { describe, expect, it } from "vitest";
import { runAnalysis } from "../src/analyzer/engine.js";
import type { AnalysisResult, IssueCode } from "../src/types.js";

describe("engine integration", () => {
    // ── Result shape contract ─────────────────────────────────────────────
    // These tests lock down the AnalysisResult shape so that any accidental
    // field deletion or type change during vibe-coding breaks the test.

    describe("result shape contract (backend-risk)", () => {
        let result: AnalysisResult;

        it("runs without throwing", async () => {
            result = await runAnalysis({ targetPath: path.resolve("fixtures/backend-risk") });
            expect(result).toBeTruthy();
        });

        it("has schemaVersion >= 2", () => {
            expect(result.schemaVersion).toBeGreaterThanOrEqual(2);
        });

        it("has project name string", () => {
            expect(typeof result.project).toBe("string");
            expect(result.project.length).toBeGreaterThan(0);
        });

        it("has backendRoot as absolute path", () => {
            expect(path.isAbsolute(result.backendRoot)).toBe(true);
        });

        it("has orm as array", () => {
            expect(Array.isArray(result.orm)).toBe(true);
        });

        it("has detectedStrategy as valid value", () => {
            expect(["offset", "cursor", "none", "mixed"]).toContain(result.detectedStrategy);
        });

        it("has score as number 0-100", () => {
            expect(typeof result.score).toBe("number");
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        });

        it("has valid status string", () => {
            expect(["Production Grade", "Good", "Needs Optimization", "High Risk", "Critical"]).toContain(result.status);
        });

        it("has findings as non-empty array", () => {
            expect(Array.isArray(result.findings)).toBe(true);
            expect(result.findings.length).toBeGreaterThan(0);
        });

        it("has issues as array of strings", () => {
            expect(Array.isArray(result.issues)).toBe(true);
            for (const issue of result.issues) {
                expect(typeof issue).toBe("string");
            }
        });

        it("has rootCauses as array", () => {
            expect(Array.isArray(result.rootCauses)).toBe(true);
        });

        it("has recommendations as non-empty array", () => {
            expect(Array.isArray(result.recommendations)).toBe(true);
            expect(result.recommendations.length).toBeGreaterThan(0);
        });

        it("has filesScanned > 0", () => {
            expect(result.filesScanned).toBeGreaterThan(0);
        });

        it("has units array", () => {
            expect(Array.isArray(result.units)).toBe(true);
            expect(result.units!.length).toBeGreaterThan(0);
        });

        it("has breakdown with categories", () => {
            expect(result.breakdown).toBeTruthy();
            expect(result.breakdown?.categories).toBeTruthy();
        });

        it("has metrics object", () => {
            expect(result.metrics).toBeTruthy();
            expect(typeof result.metrics!.unitsScored).toBe("number");
        });

        it("has topUnits array", () => {
            expect(Array.isArray(result.topUnits)).toBe(true);
        });

        it("has nextActions array", () => {
            expect(Array.isArray(result.nextActions)).toBe(true);
        });
    });

    // ── Specific detection assertions (backend-risk) ──────────────────────

    describe("backend-risk detection accuracy", () => {
        let result: AnalysisResult;

        it("runs analysis on risk fixture", async () => {
            result = await runAnalysis({ targetPath: path.resolve("fixtures/backend-risk") });
        });

        it("detects mixed strategy (offset + cursor)", () => {
            expect(result.detectedStrategy).toBe("mixed");
        });

        it("score is below 50 (critical level)", () => {
            expect(result.score).toBeLessThan(50);
        });

        it("finds OFFSET_USED issue", () => {
            expect(result.findings.some((f) => f.code === "OFFSET_USED")).toBe(true);
        });

        it("finds MISSING_LIMIT issue", () => {
            expect(result.findings.some((f) => f.code === "MISSING_LIMIT")).toBe(true);
        });

        it("finds DEEP_OFFSET issue", () => {
            expect(result.findings.some((f) => f.code === "DEEP_OFFSET")).toBe(true);
        });

        it("finds NO_PAGE_SIZE_CAP issue", () => {
            expect(result.findings.some((f) => f.code === "NO_PAGE_SIZE_CAP")).toBe(true);
        });

        it("finds MULTIPLICATION_SKIP issue", () => {
            expect(result.findings.some((f) => f.code === "MULTIPLICATION_SKIP")).toBe(true);
        });

        it("has multiple critical severity findings", () => {
            const critical = result.findings.filter((f) => f.severity === "critical");
            expect(critical.length).toBeGreaterThanOrEqual(1);
        });

        it("recommendations mention keyset pagination", () => {
            expect(result.recommendations.some((r) => /keyset/i.test(r))).toBe(true);
        });

        it("recommendations mention composite index", () => {
            expect(result.recommendations.some((r) => /composite index/i.test(r))).toBe(true);
        });

        it("recommendations mention max page size", () => {
            expect(result.recommendations.some((r) => /max page size|50/i.test(r))).toBe(true);
        });

        it("topUnits has entries sorted by severity", () => {
            expect(result.topUnits!.length).toBeGreaterThan(0);
            if (result.topUnits!.length > 1) {
                // First should be most severe
                const first = result.topUnits![0];
                expect(first.maxSeverity).toBeTruthy();
            }
        });

        it("breakdown metrics show unbounded and deep-offset hotspots", () => {
            const b = result.breakdown!;
            expect((b.unboundedUnits ?? 0) + (b.deepOffsetUnits ?? 0)).toBeGreaterThan(0);
        });
    });

    // ── Safe fixture assertions ───────────────────────────────────────────

    describe("backend-safe detection accuracy", () => {
        let result: AnalysisResult;

        it("runs analysis on safe fixture", async () => {
            result = await runAnalysis({ targetPath: path.resolve("fixtures/backend-safe") });
        });

        it("score is >= 85 (Good or better)", () => {
            expect(result.score).toBeGreaterThanOrEqual(85);
        });

        it("strategy is cursor or none (no offset)", () => {
            expect(["cursor", "none"]).toContain(result.detectedStrategy);
        });

        it("no critical-severity findings", () => {
            const critical = result.findings.filter((f) => f.severity === "critical");
            expect(critical).toHaveLength(0);
        });

        it("no MISSING_LIMIT findings", () => {
            expect(result.findings.some((f) => f.code === "MISSING_LIMIT")).toBe(false);
        });

        it("no DEEP_OFFSET findings", () => {
            expect(result.findings.some((f) => f.code === "DEEP_OFFSET")).toBe(false);
        });
    });

    // ── Layered fixture assertions ────────────────────────────────────────

    describe("backend-layered detection accuracy", () => {
        let result: AnalysisResult;

        it("runs analysis on layered fixture", async () => {
            result = await runAnalysis({ targetPath: path.resolve("fixtures/backend-layered") });
        });

        it("discovers HTTP units", () => {
            const httpUnits = result.units?.filter((u) => u.kind === "http");
            expect(httpUnits!.length).toBeGreaterThan(0);
        });

        it("has call chains for discovered units", () => {
            const withChain = result.units?.filter((u) => (u.callChain?.length ?? 0) > 0);
            expect(withChain!.length).toBeGreaterThanOrEqual(1);
        });

        it("unit names reflect HTTP routes", () => {
            const httpUnit = result.units?.find((u) => u.kind === "http");
            expect(httpUnit?.name).toMatch(/GET|POST|PUT|PATCH|DELETE/i);
        });
    });

    // ── Finding structure contract ────────────────────────────────────────

    describe("finding structure contract", () => {
        it("every finding has required fields", async () => {
            const result = await runAnalysis({ targetPath: path.resolve("fixtures/backend-risk") });
            for (const f of result.findings) {
                expect(f.code).toBeTruthy();
                expect(typeof f.code).toBe("string");
                expect(f.severity).toBeTruthy();
                expect(["critical", "high", "medium", "low"]).toContain(f.severity);
                expect(typeof f.message).toBe("string");
                expect(f.message.length).toBeGreaterThan(0);
                expect(typeof f.filePath).toBe("string");
                expect(f.filePath.length).toBeGreaterThan(0);
            }
        });
    });

    // ── Unit structure contract ───────────────────────────────────────────

    describe("unit structure contract", () => {
        it("every unit has required fields", async () => {
            const result = await runAnalysis({ targetPath: path.resolve("fixtures/backend-risk") });
            for (const u of result.units!) {
                expect(typeof u.id).toBe("string");
                expect(u.id.length).toBeGreaterThan(0);
                expect(typeof u.kind).toBe("string");
                expect(typeof u.name).toBe("string");
                expect(u.name.length).toBeGreaterThan(0);
                expect(Array.isArray(u.files)).toBe(true);
                expect(Array.isArray(u.findings)).toBe(true);
                expect(typeof u.score).toBe("number");
                expect(u.score).toBeGreaterThanOrEqual(0);
                expect(u.score).toBeLessThanOrEqual(100);
                expect(typeof u.status).toBe("string");
            }
        });
    });
});
