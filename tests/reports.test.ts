import { describe, expect, it } from "vitest";
import { renderMinimalReport } from "../src/reporting/minimal-report.js";
import { renderJsonReport } from "../src/reporting/json-report.js";
import type { AnalysisResult } from "../src/types.js";

function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
    return {
        schemaVersion: 2,
        project: "test-project",
        backendRoot: "/test",
        orm: [],
        detectedStrategy: "offset",
        score: 65,
        status: "Needs Optimization",
        findings: [],
        issues: ["Issue 1", "Issue 2", "Issue 3", "Issue 4", "Issue 5"],
        rootCauses: ["root cause 1"],
        recommendations: ["rec 1", "rec 2", "rec 3", "rec 4"],
        filesScanned: 10,
        units: [],
        breakdown: {
            categories: {},
            unitsScored: 2,
            unitsWithIssues: 1,
            criticalUnits: 0,
            highUnits: 1,
            deepOffsetUnits: 1,
            unboundedUnits: 1,
            unsafeSortUnits: 0,
        },
        metrics: {
            unitsScored: 2,
            unitsWithIssues: 1,
            criticalUnits: 0,
            highUnits: 1,
            deepOffsetUnits: 1,
            unboundedUnits: 1,
            unsafeSortUnits: 0,
        },
        topUnits: [
            {
                id: "u1",
                name: "GET /users",
                kind: "http",
                score: 40,
                status: "High Risk",
                maxSeverity: "high",
                issueCount: 3,
                primaryRisk: "deep offset",
                entryFile: "src/routes.ts",
                entryLine: 5,
            },
        ],
        ...overrides,
    };
}

describe("report renderers", () => {
    // ── Minimal Report ────────────────────────────────────────────────────

    describe("renderMinimalReport", () => {
        it("includes score and status", () => {
            const output = renderMinimalReport(makeResult());
            expect(output).toContain("65/100");
            expect(output).toContain("Needs Optimization");
        });

        it("includes strategy and file count", () => {
            const output = renderMinimalReport(makeResult());
            expect(output).toContain("offset");
            expect(output).toContain("10");
        });

        it("lists top issues (max 4)", () => {
            const output = renderMinimalReport(makeResult());
            expect(output).toContain("Issue 1");
            expect(output).toContain("Issue 4");
            // Issue 5 should be truncated (only top 4)
            expect(output).not.toContain("Issue 5");
        });

        it("lists quick wins (max 3)", () => {
            const output = renderMinimalReport(makeResult());
            expect(output).toContain("rec 1");
            expect(output).toContain("rec 3");
            // rec 4 should be truncated
            expect(output).not.toContain("rec 4");
        });

        it("shows hotspots when metrics available", () => {
            const output = renderMinimalReport(makeResult());
            expect(output).toContain("deep-offset");
            expect(output).toContain("unbounded");
        });

        it("shows top risky units", () => {
            const output = renderMinimalReport(makeResult());
            expect(output).toContain("GET /users");
        });

        it("handles no issues gracefully", () => {
            const output = renderMinimalReport(makeResult({ issues: [], recommendations: [] }));
            expect(output).toContain("65/100");
            expect(output).not.toContain("Issues:");
        });
    });

    // ── JSON Report ───────────────────────────────────────────────────────

    describe("renderJsonReport", () => {
        it("returns valid JSON", () => {
            const output = renderJsonReport(makeResult());
            expect(() => JSON.parse(output)).not.toThrow();
        });

        it("includes all required fields", () => {
            const output = renderJsonReport(makeResult());
            const parsed = JSON.parse(output);
            expect(parsed.schemaVersion).toBe(2);
            expect(parsed.project).toBe("test-project");
            expect(parsed.backendRoot).toBe("/test");
            expect(parsed.score).toBe(65);
            expect(parsed.status).toBe("Needs Optimization");
            expect(parsed.detectedStrategy).toBe("offset");
            expect(parsed.filesScanned).toBe(10);
            expect(Array.isArray(parsed.findings)).toBe(true);
            expect(Array.isArray(parsed.issues)).toBe(true);
            expect(Array.isArray(parsed.recommendations)).toBe(true);
            expect(Array.isArray(parsed.units)).toBe(true);
        });

        it("includes breakdown and metrics", () => {
            const output = renderJsonReport(makeResult());
            const parsed = JSON.parse(output);
            expect(parsed.breakdown).toBeTruthy();
            expect(parsed.metrics).toBeTruthy();
        });

        it("includes topUnits and nextActions", () => {
            const output = renderJsonReport(makeResult({ nextActions: ["action 1"] }));
            const parsed = JSON.parse(output);
            expect(Array.isArray(parsed.topUnits)).toBe(true);
            expect(Array.isArray(parsed.nextActions)).toBe(true);
        });

        it("is pretty-printed (indented JSON)", () => {
            const output = renderJsonReport(makeResult());
            // Pretty-printed JSON contains newlines and indentation
            expect(output).toContain("\n");
            expect(output).toContain("  ");
        });
    });
});
