import { describe, expect, it } from "vitest";
import { groupFindingsIntoUnits } from "../src/analysis/issue-grouper.js";
import type { Finding } from "../src/types.js";
import type { DiscoveredUnit } from "../src/indexing/endpoint-discovery.js";

describe("issue-grouper", () => {
    const backendRoot = "/project";

    // ── Basic grouping ────────────────────────────────────────────────────

    it("creates file-based units when no discovered endpoints exist", () => {
        const findings: Finding[] = [
            { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "/project/src/a.ts" },
            { code: "NO_ORDER_BY", severity: "high", message: "y", filePath: "/project/src/b.ts" },
        ];
        const result = groupFindingsIntoUnits({
            backendRoot,
            discoveredUnits: [],
            findings,
        });
        expect(result.units.length).toBeGreaterThanOrEqual(2);
        // Each file should have its own unit
        const unitFiles = result.units.map((u) => u.id);
        expect(unitFiles).toContain("file:/project/src/a.ts");
        expect(unitFiles).toContain("file:/project/src/b.ts");
    });

    it("assigns findings to discovered units by file path", () => {
        const discovered: DiscoveredUnit[] = [{
            id: "http:get:/users:/project/src/routes.ts:5",
            kind: "http",
            name: "GET /users",
            filePath: "/project/src/routes.ts",
            lineRange: [5, 20],
        }];
        const findings: Finding[] = [
            { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "/project/src/routes.ts", lineRange: [10, 10] },
        ];
        const result = groupFindingsIntoUnits({
            backendRoot,
            discoveredUnits: discovered,
            findings,
        });
        const unit = result.units.find((u) => u.id === "http:get:/users:/project/src/routes.ts:5");
        expect(unit).toBeTruthy();
        expect(unit!.findings).toHaveLength(1);
        expect(unit!.findings[0].code).toBe("OFFSET_USED");
    });

    it("respects pre-assigned unitId", () => {
        const discovered: DiscoveredUnit[] = [{
            id: "my-unit",
            kind: "http",
            name: "GET /items",
            filePath: "/project/src/routes.ts",
        }];
        const findings: Finding[] = [
            { code: "NO_ORDER_BY", severity: "high", message: "x", filePath: "/project/src/other.ts", unitId: "my-unit" },
        ];
        const result = groupFindingsIntoUnits({
            backendRoot,
            discoveredUnits: discovered,
            findings,
        });
        const unit = result.units.find((u) => u.id === "my-unit");
        expect(unit!.findings).toHaveLength(1);
    });

    // ── Deduplication ─────────────────────────────────────────────────────

    it("deduplicates findings within a unit (same code+file+line+message)", () => {
        const discovered: DiscoveredUnit[] = [{
            id: "u1",
            kind: "http",
            name: "GET /users",
            filePath: "/project/src/routes.ts",
        }];
        const findings: Finding[] = [
            { code: "OFFSET_USED", severity: "medium", message: "same msg", filePath: "/project/src/routes.ts", lineRange: [5, 5] },
            { code: "OFFSET_USED", severity: "medium", message: "same msg", filePath: "/project/src/routes.ts", lineRange: [5, 5] },
        ];
        const result = groupFindingsIntoUnits({
            backendRoot,
            discoveredUnits: discovered,
            findings,
        });
        const unit = result.units.find((u) => u.id === "u1");
        expect(unit!.findings).toHaveLength(1);
    });

    // ── Layer inference ───────────────────────────────────────────────────

    it("infers route layer from file path", () => {
        const findings: Finding[] = [
            { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "/project/src/routes/users.ts" },
        ];
        groupFindingsIntoUnits({ backendRoot, discoveredUnits: [], findings });
        expect(findings[0].layer).toBe("route");
    });

    it("infers controller layer from file path", () => {
        const findings: Finding[] = [
            { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "/project/src/controllers/users.ts" },
        ];
        groupFindingsIntoUnits({ backendRoot, discoveredUnits: [], findings });
        expect(findings[0].layer).toBe("controller");
    });

    it("infers service layer from file path", () => {
        const findings: Finding[] = [
            { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "/project/src/services/users.ts" },
        ];
        groupFindingsIntoUnits({ backendRoot, discoveredUnits: [], findings });
        expect(findings[0].layer).toBe("service");
    });

    it("infers sql layer from .sql file path", () => {
        const findings: Finding[] = [
            { code: "MISSING_LIMIT", severity: "critical", message: "x", filePath: "/project/src/queries/users.sql" },
        ];
        groupFindingsIntoUnits({ backendRoot, discoveredUnits: [], findings });
        expect(findings[0].layer).toBe("sql");
    });

    it("infers graphql layer from resolvers path", () => {
        const findings: Finding[] = [
            { code: "NO_PAGE_SIZE_CAP", severity: "high", message: "x", filePath: "/project/src/resolvers/feed.ts" },
        ];
        groupFindingsIntoUnits({ backendRoot, discoveredUnits: [], findings });
        expect(findings[0].layer).toBe("graphql");
    });

    it("uses unknown layer for unrecognized paths", () => {
        const findings: Finding[] = [
            { code: "OFFSET_USED", severity: "medium", message: "x", filePath: "/project/src/misc/stuff.ts" },
        ];
        groupFindingsIntoUnits({ backendRoot, discoveredUnits: [], findings });
        expect(findings[0].layer).toBe("unknown");
    });

    // ── Category assignment ───────────────────────────────────────────────

    it("assigns category from rule engine", () => {
        const findings: Finding[] = [
            { code: "MISSING_LIMIT", severity: "critical", message: "x", filePath: "/project/src/a.ts" },
        ];
        groupFindingsIntoUnits({ backendRoot, discoveredUnits: [], findings });
        expect(findings[0].category).toBe("Bounds");
    });

    // ── Empty input ───────────────────────────────────────────────────────

    it("handles empty findings and empty discovered units", () => {
        const result = groupFindingsIntoUnits({
            backendRoot,
            discoveredUnits: [],
            findings: [],
        });
        expect(result.units).toHaveLength(0);
        expect(result.unassigned).toHaveLength(0);
    });
});
