import { readFileSync } from "node:fs";
import type { Finding } from "../types.js";

export function detectPaginationWrappers(filePath: string): Finding[] {
  const content = readFileSync(filePath, "utf8");
  const findings: Finding[] = [];

  const match = /\bpaginate\s*\(/.exec(content);
  if (match) {
    const hasCap = /Math\.min\s*\(/.test(content) || /max(PageSize|Limit|Take)/i.test(content);
    const hasOrder = /(orderBy|sort|ORDER BY)/.test(content);

    const startIndex = match.index;
    const linesBefore = content.substring(0, startIndex).split('\n');
    const exactLine = linesBefore.length;

    const allLines = content.split('\n');
    const contextStart = Math.max(0, exactLine - 2);
    const contextEnd = Math.min(allLines.length - 1, exactLine);
    const codeSnippet = allLines.slice(contextStart, contextEnd + 1).join('\n');

    if (!hasCap) {
      findings.push({
        code: "NO_PAGE_SIZE_CAP",
        severity: "high",
        message: "Shared paginate() utility found without visible max page size cap.",
        filePath,
        lineRange: [exactLine, exactLine],
        codeSnippet,
        recommendation: "Add hard max cap in the paginate utility."
      });
    }

    if (!hasOrder) {
      findings.push({
        code: "NO_ORDER_BY",
        severity: "medium",
        message: "Shared paginate() utility does not enforce stable order.",
        filePath,
        lineRange: [exactLine, exactLine],
        codeSnippet,
        recommendation: "Always enforce deterministic order in utility layer."
      });
    }
  }

  return findings;
}
