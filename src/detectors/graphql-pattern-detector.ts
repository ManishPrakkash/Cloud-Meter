import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parse } from "@babel/parser";
import type { Finding } from "../types.js";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default as (
  ast: unknown,
  visitors: Record<string, (...args: any[]) => void>
) => void;

export function detectGraphqlPagination(filePath: string): Finding[] {
  const content = readFileSync(filePath, "utf8");
  const findings: Finding[] = [];

  if (!/(first|after|before|last)/.test(content)) {
    return findings;
  }

  const ast = parse(content, {
    sourceType: "unambiguous",
    plugins: ["typescript", "jsx"]
  });

  let hasFirst = false;
  let hasAfter = false;
  let hasCap = false;

  traverse(ast, {
    Identifier(path: any) {
      const name = path.node.name;
      if (name === "first") hasFirst = true;
      if (name === "after") hasAfter = true;
    },
    CallExpression(path: any) {
      const node = path.node;
      if (node.callee.type === "MemberExpression") {
        const prop = node.callee.property;
        const propName = prop.type === "Identifier" ? prop.name : "";
        if (propName === "min") {
          const object = node.callee.object;
          if (object.type === "Identifier" && object.name === "Math") {
            hasCap = true;
          }
        }
      }
    }
  });

  if (hasFirst && !hasCap) {
    findings.push({
      code: "NO_PAGE_SIZE_CAP",
      severity: "high",
      message: "GraphQL pagination uses 'first' without max cap enforcement.",
      filePath,
      lineRange: [1, 1], codeSnippet: content.split('\n')[0],
      strategy: hasAfter ? "cursor" : "none",
      recommendation: "Clamp first: Math.min(first, 50)."
    });
  }

  if (hasAfter && !/orderBy|sort/.test(content)) {
    findings.push({
      code: "INFINITE_SCROLL_UNSAFE",
      severity: "high",
      message: "Infinite-scroll style cursor ('after') without stable ordering.",
      filePath,
      lineRange: [1, 1], codeSnippet: content.split('\n')[0],
      strategy: "cursor",
      rootCause: "Cursor progression can become inconsistent under writes.",
      recommendation: "Use deterministic order + unique tie-breaker key."
    });
  }

  return findings;
}
