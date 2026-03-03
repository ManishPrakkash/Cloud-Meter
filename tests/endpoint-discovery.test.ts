import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverUnitsInFile } from "../src/indexing/endpoint-discovery.js";

describe("endpoint-discovery", () => {
    // ── HTTP route discovery ──────────────────────────────────────────────

    describe("HTTP route discovery", () => {
        const routesFile = path.resolve("fixtures/backend-layered/src/routes/usersRoutes.ts");

        it("discovers HTTP units from express-style routes", () => {
            const units = discoverUnitsInFile(routesFile);
            const httpUnits = units.filter((u) => u.kind === "http");
            expect(httpUnits.length).toBeGreaterThan(0);
        });

        it("unit name includes HTTP method and path", () => {
            const units = discoverUnitsInFile(routesFile);
            const httpUnit = units.find((u) => u.kind === "http");
            expect(httpUnit).toBeTruthy();
            expect(httpUnit!.name).toMatch(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\//);
        });

        it("unit has lineRange", () => {
            const units = discoverUnitsInFile(routesFile);
            const httpUnit = units.find((u) => u.kind === "http");
            expect(httpUnit!.lineRange).toBeTruthy();
            expect(httpUnit!.lineRange![0]).toBeGreaterThan(0);
        });

        it("unit has filePath matching input", () => {
            const units = discoverUnitsInFile(routesFile);
            for (const u of units) {
                expect(u.filePath).toBe(routesFile);
            }
        });

        it("unit has unique id", () => {
            const units = discoverUnitsInFile(routesFile);
            const ids = units.map((u) => u.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });
    });

    // ── GraphQL resolver discovery ────────────────────────────────────────

    describe("GraphQL resolver discovery", () => {
        const feedResolver = path.resolve("fixtures/backend-risk/src/services/feedResolver.ts");

        it("discovers GraphQL query units", () => {
            const units = discoverUnitsInFile(feedResolver);
            const gqlUnits = units.filter((u) => u.kind === "graphql");
            expect(gqlUnits.length).toBeGreaterThan(0);
        });

        it("unit name includes Query type and field", () => {
            const units = discoverUnitsInFile(feedResolver);
            const gqlUnit = units.find((u) => u.kind === "graphql");
            expect(gqlUnit).toBeTruthy();
            expect(gqlUnit!.name).toMatch(/Query\.feed/);
        });

        it("unit id starts with graphql:", () => {
            const units = discoverUnitsInFile(feedResolver);
            const gqlUnit = units.find((u) => u.kind === "graphql");
            expect(gqlUnit!.id).toMatch(/^graphql:/);
        });
    });

    // ── Safe file (no routes) ─────────────────────────────────────────────

    describe("file without routes", () => {
        const safePath = path.resolve("fixtures/backend-safe/src/services/userService.ts");

        it("returns empty for service file without express routes", () => {
            const units = discoverUnitsInFile(safePath);
            const httpUnits = units.filter((u) => u.kind === "http");
            expect(httpUnits).toHaveLength(0);
        });
    });
});
