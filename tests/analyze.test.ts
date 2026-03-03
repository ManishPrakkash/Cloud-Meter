import path from "node:path";
import { describe, expect, it } from "vitest";
import { runAnalysis } from "../src/analyzer/engine.js";

describe("pagination analyzer", () => {
  it("detects high-risk offset and unbounded patterns", async () => {
    const targetPath = path.resolve("fixtures/backend-risk");
    const result = await runAnalysis({ targetPath });

    expect(result.detectedStrategy).toBe("mixed");
    expect(result.score).toBeLessThan(80);
    expect(result.issues.join(" ")).toMatch(/Deep OFFSET|page size|order|Offset/i);
    expect(result.recommendations.join(" ")).toMatch(/keyset|max page size|composite index/i);
  });

  it("keeps score high for capped keyset patterns", async () => {
    const targetPath = path.resolve("fixtures/backend-safe");
    const result = await runAnalysis({ targetPath });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.detectedStrategy === "cursor" || result.detectedStrategy === "none").toBe(true);
  });
});
