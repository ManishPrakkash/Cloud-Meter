import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectSqlPagination } from "../src/detectors/sql-pagination-detector.js";
import { detectAstPagination } from "../src/detectors/ast-pagination-detector.js";
import { detectGraphqlPagination } from "../src/detectors/graphql-pattern-detector.js";
import { detectPaginationWrappers } from "../src/analyzers/pagination-wrapper-analyzer.js";

// ── SQL Detector ────────────────────────────────────────────────────────

describe("sql-pagination-detector", () => {
    const riskSql = path.resolve("fixtures/backend-risk/src/services/users.sql");

    it("detects OFFSET_USED in raw SQL", () => {
        const findings = detectSqlPagination(riskSql);
        expect(findings.some((f) => f.code === "OFFSET_USED")).toBe(true);
    });

    it("detects MISSING_LIMIT when SELECT has no LIMIT", () => {
        const findings = detectSqlPagination(riskSql);
        expect(findings.some((f) => f.code === "MISSING_LIMIT")).toBe(true);
    });

    it("detects DEEP_OFFSET when offset > 10000", () => {
        const findings = detectSqlPagination(riskSql);
        expect(findings.some((f) => f.code === "DEEP_OFFSET")).toBe(true);
    });

    it("detects POTENTIAL_FULL_COLLECTION_SCAN for SELECT * without LIMIT", () => {
        const findings = detectSqlPagination(riskSql);
        expect(findings.some((f) => f.code === "POTENTIAL_FULL_COLLECTION_SCAN")).toBe(true);
    });

    it("sets correct filePath on all findings", () => {
        const findings = detectSqlPagination(riskSql);
        for (const f of findings) {
            expect(f.filePath).toBe(riskSql);
        }
    });

    it("every finding has a severity", () => {
        const findings = detectSqlPagination(riskSql);
        for (const f of findings) {
            expect(["critical", "high", "medium", "low"]).toContain(f.severity);
        }
    });

    it("every finding has a valid issue code", () => {
        const findings = detectSqlPagination(riskSql);
        for (const f of findings) {
            expect(f.code).toBeTruthy();
            expect(typeof f.code).toBe("string");
        }
    });
});

// ── AST Detector ────────────────────────────────────────────────────────

describe("ast-pagination-detector", () => {
    const riskController = path.resolve("fixtures/backend-risk/src/controllers/userController.ts");

    it("detects OFFSET_USED from .skip() chain", () => {
        const findings = detectAstPagination(riskController);
        expect(findings.some((f) => f.code === "OFFSET_USED")).toBe(true);
    });

    it("detects MULTIPLICATION_SKIP from page*limit pattern", () => {
        const findings = detectAstPagination(riskController);
        expect(findings.some((f) => f.code === "MULTIPLICATION_SKIP")).toBe(true);
    });

    it("attaches codeSnippet to findings", () => {
        const findings = detectAstPagination(riskController);
        const withSnippet = findings.filter((f) => f.codeSnippet);
        expect(withSnippet.length).toBeGreaterThan(0);
    });

    it("attaches lineRange to findings", () => {
        const findings = detectAstPagination(riskController);
        const withRange = findings.filter((f) => f.lineRange && f.lineRange[0] > 0);
        expect(withRange.length).toBeGreaterThan(0);
    });

    it("returns empty array for safe file", () => {
        const safePath = path.resolve("fixtures/backend-safe/src/services/userService.ts");
        const findings = detectAstPagination(safePath);
        // Safe file uses Math.min + keyset, so no offset/skip findings from AST
        const offsetFindings = findings.filter((f) => f.code === "OFFSET_USED" || f.code === "MULTIPLICATION_SKIP");
        expect(offsetFindings).toHaveLength(0);
    });
});

// ── GraphQL Detector ────────────────────────────────────────────────────

describe("graphql-pattern-detector", () => {
    const feedResolver = path.resolve("fixtures/backend-risk/src/services/feedResolver.ts");

    it("detects NO_PAGE_SIZE_CAP for GraphQL 'first' without Math.min", () => {
        const findings = detectGraphqlPagination(feedResolver);
        expect(findings.some((f) => f.code === "NO_PAGE_SIZE_CAP")).toBe(true);
    });

    it("detects INFINITE_SCROLL_UNSAFE for 'after' without stable ordering", () => {
        const findings = detectGraphqlPagination(feedResolver);
        expect(findings.some((f) => f.code === "INFINITE_SCROLL_UNSAFE")).toBe(true);
    });

    it("sets strategy to cursor when after is present", () => {
        const findings = detectGraphqlPagination(feedResolver);
        const cursorFindings = findings.filter((f) => f.strategy === "cursor");
        expect(cursorFindings.length).toBeGreaterThan(0);
    });

    it("returns empty for safe keyset file", () => {
        const safePath = path.resolve("fixtures/backend-safe/src/services/userService.ts");
        const findings = detectGraphqlPagination(safePath);
        expect(findings).toHaveLength(0);
    });
});

// ── Wrapper Analyzer ────────────────────────────────────────────────────

describe("pagination-wrapper-analyzer", () => {
    it("returns empty for file without paginate() call", () => {
        const safePath = path.resolve("fixtures/backend-safe/src/services/userService.ts");
        const findings = detectPaginationWrappers(safePath);
        expect(findings).toHaveLength(0);
    });

    it("returns empty for controller without paginate() call", () => {
        const riskController = path.resolve("fixtures/backend-risk/src/controllers/userController.ts");
        const findings = detectPaginationWrappers(riskController);
        expect(findings).toHaveLength(0);
    });
});
