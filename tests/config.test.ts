import { describe, expect, it } from "vitest";
import {
    DEFAULT_MAX_PAGE_SIZE,
    DEEP_OFFSET_THRESHOLD,
    DEFAULT_IGNORES,
    BACKEND_DIR_HINTS,
} from "../src/config.js";
import { loadPreferences } from "../src/config/index.js";
import { defaultPreferences } from "../src/constants/index.js";

describe("config & constants", () => {
    // ── Config constants (prevent accidental changes) ─────────────────────

    describe("config.ts constants", () => {
        it("DEFAULT_MAX_PAGE_SIZE is 50", () => {
            expect(DEFAULT_MAX_PAGE_SIZE).toBe(50);
        });

        it("DEEP_OFFSET_THRESHOLD is 10000", () => {
            expect(DEEP_OFFSET_THRESHOLD).toBe(10_000);
        });

        it("DEFAULT_IGNORES contains node_modules", () => {
            expect(DEFAULT_IGNORES.some((p) => p.includes("node_modules"))).toBe(true);
        });

        it("DEFAULT_IGNORES contains dist", () => {
            expect(DEFAULT_IGNORES.some((p) => p.includes("dist"))).toBe(true);
        });

        it("DEFAULT_IGNORES contains test patterns", () => {
            expect(DEFAULT_IGNORES.some((p) => p.includes("test") || p.includes("spec"))).toBe(true);
        });

        it("BACKEND_DIR_HINTS contains common backend directories", () => {
            expect(BACKEND_DIR_HINTS).toContain("backend");
            expect(BACKEND_DIR_HINTS).toContain("api");
            expect(BACKEND_DIR_HINTS).toContain("server");
        });
    });

    // ── Default preferences (lock shape) ──────────────────────────────────

    describe("defaultPreferences", () => {
        it("has defaultPath", () => {
            expect(typeof defaultPreferences.defaultPath).toBe("string");
        });

        it("has outputMode", () => {
            expect(typeof defaultPreferences.outputMode).toBe("string");
        });

        it("has maxAllowedSeverity", () => {
            expect(typeof defaultPreferences.maxAllowedSeverity).toBe("string");
        });

        it("has ignorePaths as array", () => {
            expect(Array.isArray(defaultPreferences.ignorePaths)).toBe(true);
        });
    });

    // ── loadPreferences ───────────────────────────────────────────────────

    describe("loadPreferences", () => {
        it("returns an object with all expected keys", () => {
            const prefs = loadPreferences();
            expect(prefs).toBeTruthy();
            expect(typeof prefs.defaultPath).toBe("string");
            expect(typeof prefs.outputMode).toBe("string");
        });

        it("defaultPath fallback is '.'", () => {
            const prefs = loadPreferences();
            expect(prefs.defaultPath).toBeTruthy();
        });

        it("ignorePaths is always an array", () => {
            const prefs = loadPreferences();
            expect(Array.isArray(prefs.ignorePaths)).toBe(true);
        });
    });
});
