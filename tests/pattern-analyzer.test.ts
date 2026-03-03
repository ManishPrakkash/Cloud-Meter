import { describe, expect, it } from "vitest";
import { buildSignals, enrichFindings } from "../src/analyzers/pattern-analyzer.js";
import type { Finding } from "../src/types.js";

describe("pattern-analyzer", () => {
    // ── buildSignals ──────────────────────────────────────────────────────

    describe("buildSignals", () => {
        it("detects hasOffset from OFFSET_USED code", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "a.ts" },
            ];
            const signals = buildSignals(findings);
            expect(signals.hasOffset).toBe(true);
            expect(signals.hasCursor).toBe(false);
        });

        it("detects hasOffset from offset strategy", () => {
            const findings: Finding[] = [
                { code: "NO_ORDER_BY", severity: "high", message: "x", filePath: "a.ts", strategy: "offset" },
            ];
            const signals = buildSignals(findings);
            expect(signals.hasOffset).toBe(true);
        });

        it("detects hasCursor from cursor strategy", () => {
            const findings: Finding[] = [
                { code: "UNSTABLE_CURSOR", severity: "high", message: "x", filePath: "a.ts", strategy: "cursor" },
            ];
            const signals = buildSignals(findings);
            expect(signals.hasCursor).toBe(true);
            expect(signals.hasOffset).toBe(false);
        });

        it("detects hasAnyPagination when pagination-related codes exist", () => {
            const findings: Finding[] = [
                { code: "NO_ORDER_BY", severity: "high", message: "x", filePath: "a.ts" },
            ];
            const signals = buildSignals(findings);
            expect(signals.hasAnyPagination).toBe(true);
        });

        it("counts unbounded endpoints from MISSING_LIMIT", () => {
            const findings: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "a.ts" },
                { code: "MISSING_LIMIT", severity: "critical", message: "b", filePath: "b.ts" },
            ];
            const signals = buildSignals(findings);
            expect(signals.unboundedEndpoints).toBe(2);
        });

        it("returns zeros for empty findings", () => {
            const signals = buildSignals([]);
            expect(signals.hasOffset).toBe(false);
            expect(signals.hasCursor).toBe(false);
            expect(signals.hasAnyPagination).toBe(false);
            expect(signals.filesWithCap).toBe(0);
            expect(signals.filesWithoutCap).toBe(0);
            expect(signals.unboundedEndpoints).toBe(0);
        });
    });

    // ── enrichFindings ────────────────────────────────────────────────────

    describe("enrichFindings", () => {
        it("adds MULTIPLE_UNBOUNDED_ENDPOINTS when >1 MISSING_LIMIT", () => {
            const findings: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "a.ts" },
                { code: "MISSING_LIMIT", severity: "critical", message: "b", filePath: "b.ts" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            expect(enriched.some((f) => f.code === "MULTIPLE_UNBOUNDED_ENDPOINTS")).toBe(true);
        });

        it("does NOT add MULTIPLE_UNBOUNDED_ENDPOINTS for single MISSING_LIMIT", () => {
            const findings: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "a.ts" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            expect(enriched.some((f) => f.code === "MULTIPLE_UNBOUNDED_ENDPOINTS")).toBe(false);
        });

        it("adds CONCURRENT_WRITES_RISK when UNSTABLE_CURSOR exists", () => {
            const findings: Finding[] = [
                { code: "UNSTABLE_CURSOR", severity: "high", message: "x", filePath: "a.ts", strategy: "cursor" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            expect(enriched.some((f) => f.code === "CONCURRENT_WRITES_RISK")).toBe(true);
        });

        it("adds CONCURRENT_WRITES_RISK when OFFSET+NO_ORDER_BY exists", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "a.ts" },
                { code: "NO_ORDER_BY", severity: "high", message: "y", filePath: "a.ts" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            expect(enriched.some((f) => f.code === "CONCURRENT_WRITES_RISK")).toBe(true);
        });

        it("adds ORDER_BY_WITHOUT_INDEX_HINT when NO_ORDER_BY present", () => {
            const findings: Finding[] = [
                { code: "NO_ORDER_BY", severity: "high", message: "x", filePath: "a.ts" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            expect(enriched.some((f) => f.code === "ORDER_BY_WITHOUT_INDEX_HINT")).toBe(true);
        });

        it("adds ORDER_BY_WITHOUT_INDEX_HINT when DYNAMIC_SORT_UNSAFE present", () => {
            const findings: Finding[] = [
                { code: "DYNAMIC_SORT_UNSAFE", severity: "medium", message: "x", filePath: "a.ts" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            expect(enriched.some((f) => f.code === "ORDER_BY_WITHOUT_INDEX_HINT")).toBe(true);
        });

        it("adds INCONSISTENT_PAGE_SIZE_CONTROL when mixed cap/no-cap files", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "a", filePath: "a.ts" },
                { code: "NO_PAGE_SIZE_CAP", severity: "high", message: "b", filePath: "a.ts" },
                { code: "OFFSET_USED", severity: "medium", message: "c", filePath: "b.ts" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            expect(enriched.some((f) => f.code === "INCONSISTENT_PAGE_SIZE_CONTROL")).toBe(true);
        });

        it("deduplicates identical findings (code+file+message)", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "same", filePath: "a.ts" },
                { code: "OFFSET_USED", severity: "medium", message: "same", filePath: "a.ts" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            const offsetFindings = enriched.filter((f) => f.code === "OFFSET_USED");
            expect(offsetFindings).toHaveLength(1);
        });

        it("keeps findings from different files even if same code", () => {
            const findings: Finding[] = [
                { code: "OFFSET_USED", severity: "medium", message: "same", filePath: "a.ts" },
                { code: "OFFSET_USED", severity: "medium", message: "same", filePath: "b.ts" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            const offsetFindings = enriched.filter((f) => f.code === "OFFSET_USED");
            expect(offsetFindings).toHaveLength(2);
        });

        it("project-level findings use <project> as filePath", () => {
            const findings: Finding[] = [
                { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "a.ts" },
                { code: "MISSING_LIMIT", severity: "critical", message: "b", filePath: "b.ts" },
            ];
            const signals = buildSignals(findings);
            const enriched = enrichFindings(findings, signals);
            const projectFindings = enriched.filter((f) => f.filePath === "<project>");
            expect(projectFindings.length).toBeGreaterThan(0);
        });
    });
});
