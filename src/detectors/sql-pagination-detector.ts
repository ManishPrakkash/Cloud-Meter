import { readFileSync } from "node:fs";
import { DEEP_OFFSET_THRESHOLD } from "../config.js";
import type { Finding } from "../types.js";

export function detectSqlPagination(filePath: string): Finding[] {
  const sql = readFileSync(filePath, "utf8");
  const findings: Finding[] = [];

  const hasLimit = /\bLIMIT\b/i.test(sql);
  const hasOffset = /\bOFFSET\b/i.test(sql);
  const hasOrder = /\bORDER\s+BY\b/i.test(sql);
  const hasWindow = /\bROW_NUMBER\s*\(/i.test(sql) || /\bDENSE_RANK\s*\(/i.test(sql);
  const hasOffsetFetch = /\bOFFSET\s+\d+\s+ROWS?\s+FETCH\s+NEXT\s+\d+\s+ROWS?\s+ONLY\b/i.test(sql);

  if (hasOffset) {
    findings.push({
      code: "OFFSET_USED",
      severity: "medium",
      message: "Offset pagination detected in raw SQL.",
      filePath,
      lineRange: [1, 1], codeSnippet: sql.split('\n')[0],
      strategy: "offset",
      recommendation: "Prefer keyset pagination for deep pages."
    });
  }

  if (hasOffsetFetch) {
    findings.push({
      code: "OFFSET_USED",
      severity: "high",
      message: "OFFSET/FETCH pagination pattern detected.",
      filePath,
      lineRange: [1, 1],
      codeSnippet: sql.split("\n")[0],
      strategy: "offset",
      recommendation: "Consider keyset pagination for large result sets."
    });
  }

  if (!hasLimit && /\bSELECT\b/i.test(sql)) {
    findings.push({
      code: "MISSING_LIMIT",
      severity: "critical",
      message: "SELECT query appears without LIMIT.",
      filePath,
      lineRange: [1, 1], codeSnippet: sql.split('\n')[0],
      rootCause: "Unbounded SQL result set risk.",
      recommendation: "Add LIMIT with strict maximum control."
    });
  }

  if (hasOffset && !hasOrder) {
    findings.push({
      code: "NO_ORDER_BY",
      severity: "high",
      message: "OFFSET used without ORDER BY in SQL.",
      filePath,
      lineRange: [1, 1], codeSnippet: sql.split('\n')[0],
      strategy: "offset",
      recommendation: "Use stable ORDER BY to avoid page drift."
    });
  }

  const deepOffsetMatch = sql.match(/\bOFFSET\s+(\d+)\b/i);
  if (deepOffsetMatch && Number(deepOffsetMatch[1]) > DEEP_OFFSET_THRESHOLD) {
    findings.push({
      code: "DEEP_OFFSET",
      severity: "high",
      message: `Deep OFFSET usage detected (offset > ${DEEP_OFFSET_THRESHOLD}).`,
      filePath,
      lineRange: [1, 1], codeSnippet: sql.split('\n')[0],
      strategy: "offset",
      recommendation: "Move to cursor/keyset pagination."
    });
  }

  if (/SELECT\s+\*\s+FROM\s+\w+/i.test(sql) && !hasLimit) {
    findings.push({
      code: "POTENTIAL_FULL_COLLECTION_SCAN",
      severity: "high",
      message: "Potential full collection scan in raw SQL.",
      filePath,
      lineRange: [1, 1], codeSnippet: sql.split('\n')[0],
      rootCause: "Query can read full table without bounds.",
      recommendation: "Add indexed filters plus LIMIT."
    });
  }

  if (hasWindow && !hasLimit) {
    findings.push({
      code: "POTENTIAL_FULL_COLLECTION_SCAN",
      severity: "medium",
      message: "Window-function pagination without LIMIT detected.",
      filePath,
      lineRange: [1, 1],
      codeSnippet: sql.split("\n")[0],
      rootCause: "Windowed result may still scan large row sets without explicit LIMIT.",
      recommendation: "Combine window pagination with LIMIT and indexed partition/order keys."
    });
  }

  return findings;
}
