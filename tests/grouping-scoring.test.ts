import path from "node:path";
import { describe, expect, it } from "vitest";
import { runAnalysis } from "../src/analyzer/engine.js";
import { computeScore } from "../src/scoring/scoring-engine.js";
import type { Finding } from "../src/types.js";

describe("unit grouping + scoring", () => {
  it("produces unit-level output and category breakdown", async () => {
    const targetPath = path.resolve("fixtures/backend-risk");
    const result = await runAnalysis({ targetPath });

    expect(result.schemaVersion).toBeGreaterThanOrEqual(2);
    expect(result.units?.length).toBeGreaterThan(0);
    expect(result.breakdown?.categories).toBeTruthy();
    expect(result.score).toBeGreaterThanOrEqual(15); // capped unit penalties => no runaway 0
  });

  it("discovers layered endpoint units and best-effort call chains", async () => {
    const targetPath = path.resolve("fixtures/backend-layered");
    const result = await runAnalysis({ targetPath });

    expect(result.units?.length).toBeGreaterThan(0);
    const httpUnit = result.units?.find((u) => u.kind === "http");
    expect(httpUnit).toBeTruthy();
    expect(httpUnit?.name).toMatch(/GET\s+\/users/i);
    expect(httpUnit?.callChain?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("dedupes scoring by issue code per unit", () => {
    const findings: Finding[] = [
      { code: "MISSING_LIMIT", severity: "critical", message: "a", filePath: "x" },
      { code: "MISSING_LIMIT", severity: "critical", message: "b", filePath: "x" },
      { code: "NO_ORDER_BY", severity: "high", message: "c", filePath: "x" }
    ];
    const scored = computeScore(findings);
    // MISSING_LIMIT should only be counted once (30) + NO_ORDER_BY (15) => 55 deduction.
    expect(scored.score).toBe(55);
  });
});

