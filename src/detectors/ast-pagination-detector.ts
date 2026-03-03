import fs, { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parse } from "@babel/parser";
import type {
  CallExpression,
  MemberExpression,
  Node,
  ObjectExpression,
  ObjectProperty
} from "@babel/types";
import { DEEP_OFFSET_THRESHOLD } from "../config.js";
import type { Finding } from "../types.js";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default as (
  ast: unknown,
  visitors: Record<string, (...args: any[]) => void>
) => void;

function getPropertyName(node: ObjectProperty): string | undefined {
  const key = node.key;
  if (key.type === "Identifier") return key.name;
  if (key.type === "StringLiteral") return key.value;
  return undefined;
}

function createFinding(input: Omit<Finding, "severity"> & { severity?: Finding["severity"] }): Finding {
  return {
    severity: input.severity ?? "high",
    ...input
  };
}

function isReqQueryLimit(node: Node): boolean {
  if (node.type !== "MemberExpression") return false;
  const n = node as MemberExpression;
  if (n.object.type !== "MemberExpression") return false;
  const left = n.object;
  if (left.object.type !== "Identifier" || left.object.name !== "req") return false;
  const prop = left.property;
  const rightProp = n.property;
  const q = prop.type === "Identifier" ? prop.name : prop.type === "StringLiteral" ? prop.value : "";
  const l = rightProp.type === "Identifier" ? rightProp.name : rightProp.type === "StringLiteral" ? rightProp.value : "";
  return q === "query" && ["limit", "pageSize", "first", "take"].includes(l);
}

function getObjectProperty(obj: ObjectExpression, name: string): ObjectProperty | undefined {
  return obj.properties.find(
    (p): p is ObjectProperty => p.type === "ObjectProperty" && getPropertyName(p) === name
  );
}

function isMathMinWithLimit(node: Node): boolean {
  if (node.type !== "CallExpression") return false;
  const call = node as CallExpression;
  if (call.callee.type !== "MemberExpression") return false;
  const callee = call.callee;
  if (callee.object.type !== "Identifier" || callee.object.name !== "Math") return false;
  if (callee.property.type !== "Identifier" || callee.property.name !== "min") return false;
  return call.arguments.some((arg) => {
    if (arg.type === "Identifier") {
      return ["limit", "pageSize", "first", "take"].includes(arg.name);
    }
    return isReqQueryLimit(arg);
  });
}

function getCallChain(node: CallExpression): string[] {
  const chain: string[] = [];
  let current: CallExpression | undefined = node;
  while (current) {
    if (current.callee.type !== "MemberExpression") break;
    const prop = current.callee.property;
    if (prop.type === "Identifier") {
      chain.unshift(prop.name);
    } else if (prop.type === "StringLiteral") {
      chain.unshift(prop.value);
    }
    const calleeObject: Node = current.callee.object as Node;
    current = calleeObject.type === "CallExpression" ? (calleeObject as CallExpression) : undefined;
  }
  return chain;
}

export function detectAstPagination(filePath: string): Finding[] {
  const content = readFileSync(filePath, "utf8");
  const findings: Finding[] = [];
  const hasCap = { value: false };

  const ast = parse(content, {
    sourceType: "unambiguous",
    plugins: ["typescript", "jsx"]
  });

  traverse(ast, {
    CallExpression(callPath: any) {
      const node = callPath.node;
      const loc = node.loc?.start.line ?? 1;

      if (isMathMinWithLimit(node)) {
        hasCap.value = true;
      }

      const chain = getCallChain(node);
      if (chain.length > 0) {
        const hasSkip = chain.includes("skip") || chain.includes("offset");
        const hasLimit = chain.includes("limit") || chain.includes("take");
        const hasOrder = chain.includes("sort") || chain.includes("order") || chain.includes("orderBy");

        if (hasSkip) {
          findings.push(
            createFinding({
              code: "OFFSET_USED",
              message: "Offset pagination usage detected.",
              filePath,
              lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
              strategy: "offset",
              rootCause: "Offset/skip scales linearly with large page depth.",
              recommendation: "Prefer keyset pagination for large datasets.",
              evidence: chain.join(" -> ")
            })
          );

          if (!hasLimit) {
            findings.push(
              createFinding({
                code: "MISSING_LIMIT",
                severity: "critical",
                message: "Pagination query appears to have no limit/take cap.",
                filePath,
                lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
                strategy: "offset",
                rootCause: "Unbounded query may return huge result set.",
                recommendation: "Add hard max page size and default limit."
              })
            );
          }

          if (!hasOrder) {
            findings.push(
              createFinding({
                code: "NO_ORDER_BY",
                message: "Offset pagination detected without explicit order.",
                filePath,
                lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
                strategy: "offset",
                rootCause: "Unstable ordering causes page drift and duplicates.",
                recommendation: "Add deterministic ORDER BY or sort()."
              })
            );
          }

          if (chain.includes("skip")) {
            const firstArg = node.arguments[0];
            if (firstArg?.type === "NumericLiteral" && firstArg.value > DEEP_OFFSET_THRESHOLD) {
              findings.push(
                createFinding({
                  code: "DEEP_OFFSET",
                  message: `Deep OFFSET usage detected (skip > ${DEEP_OFFSET_THRESHOLD}).`,
                  filePath,
                  lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
                  strategy: "offset",
                  rootCause: "Large offset requires scanning/discarding many rows.",
                  recommendation: "Switch to cursor/keyset pagination."
                })
              );
            }
            if (firstArg?.type === "BinaryExpression" && firstArg.operator === "*") {
              findings.push(
                createFinding({
                  code: "MULTIPLICATION_SKIP",
                  message: "Multiplication-based skip detected (e.g., page * limit).",
                  filePath,
                  lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
                  strategy: "offset",
                  rootCause: "Page-depth grows scan cost rapidly.",
                  recommendation: "Use keyset cursor and hard cap limit."
                })
              );
            }
          }
        }
      }

      // Prisma / Sequelize style object args in findMany/findAll calls
      if (node.callee.type === "MemberExpression") {
        const prop = node.callee.property;
        const methodName = prop.type === "Identifier" ? prop.name : prop.type === "StringLiteral" ? prop.value : "";
        if (["findMany", "findAll"].includes(methodName)) {
          const firstArg = node.arguments[0];
          if (firstArg?.type === "ObjectExpression") {
            const obj = firstArg;
            const skipProp = getObjectProperty(obj, "skip") ?? getObjectProperty(obj, "offset");
            const takeProp = getObjectProperty(obj, "take") ?? getObjectProperty(obj, "limit");
            const orderProp = getObjectProperty(obj, "orderBy") ?? getObjectProperty(obj, "order");
            const cursorProp = getObjectProperty(obj, "cursor");
            const whereProp = getObjectProperty(obj, "where");

            if (skipProp) {
              findings.push(
                createFinding({
                  code: "OFFSET_USED",
                  message: "Offset pagination object pattern detected.",
                  filePath,
                  lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
                  strategy: "offset",
                  recommendation: "Move heavy endpoints to keyset pagination."
                })
              );
            }
            if (skipProp && !takeProp) {
              findings.push(
                createFinding({
                  code: "MISSING_LIMIT",
                  severity: "critical",
                  message: "skip/offset used without take/limit.",
                  filePath,
                  lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
                  strategy: "offset",
                  recommendation: "Always pair skip/offset with strict limit/take."
                })
              );
            }
            if (skipProp && !orderProp) {
              findings.push(
                createFinding({
                  code: "NO_ORDER_BY",
                  message: "Offset query object missing orderBy/order.",
                  filePath,
                  lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
                  strategy: "offset",
                  recommendation: "Add stable order and index support."
                })
              );
            }

            if (cursorProp || whereProp) {
              const hasOrder = Boolean(orderProp);
              const whereText = whereProp ? content.slice(whereProp.start ?? 0, whereProp.end ?? 0) : "";
              const usesCreatedAtCursor = /createdAt\s*:\s*\{\s*(gt|lt)/.test(whereText);
              const usesIdTiebreaker = /(_id|id)\s*:\s*\{\s*(gt|lt)/.test(whereText);
              if (!hasOrder || (usesCreatedAtCursor && !usesIdTiebreaker)) {
                findings.push(
                  createFinding({
                    code: "UNSTABLE_CURSOR",
                    message: "Cursor pattern appears unstable (missing unique tie-breaker/order).",
                    filePath,
                    lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
                    strategy: "cursor",
                    rootCause: "Non-unique cursor fields can duplicate/skip records under writes.",
                    recommendation: "Use cursor on (createdAt, id/_id) with matching composite order."
                  })
                );
              }
            }
          }
        }
      }

      // Dynamic sort risk
      if (node.callee.type === "MemberExpression") {
        const property = node.callee.property;
        const calleeName = property.type === "Identifier" ? property.name : "";
        if (["sort", "orderBy", "order"].includes(calleeName) && node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (firstArg.type === "MemberExpression" || firstArg.type === "Identifier") {
            const raw = content.slice(firstArg.start ?? 0, firstArg.end ?? 0);
            if (/req\.query\.(sort|order|sortBy)/.test(raw)) {
              findings.push(
                createFinding({
                  code: "DYNAMIC_SORT_UNSAFE",
                  severity: "medium",
                  message: "Dynamic sorting from request input detected.",
                  filePath,
                  lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
                  recommendation: "Whitelist sortable columns and map to indexed fields.",
                  rootCause: "Unbounded dynamic sorting may bypass indexes and be unsafe."
                })
              );
            }
          }
        }
      }
    },
    VariableDeclarator(varPath: any) {
      const node = varPath.node;
      if (node.id.type === "Identifier" && ["limit", "pageSize", "first", "take"].includes(node.id.name)) {
        const init = node.init;
        if (!init) return;
        const raw = content.slice(init.start ?? 0, init.end ?? 0);
        if (/req\.query\.(limit|pageSize|first|take)/.test(raw) && !/Math\.min\(/.test(raw)) {
          findings.push(
            createFinding({
              code: "NO_PAGE_SIZE_CAP",
              message: "Page size appears sourced from query params without explicit max cap.",
              filePath,
              lineRange: [node.loc?.start.line ?? 1, node.loc?.end.line ?? 1],
              codeSnippet: content.slice(node.start, node.end),
              severity: "high",
              recommendation: "Enforce Math.min(limit, 50) style upper bound."
            })
          );
        }
      }
    }
  });

  if (!hasCap.value) {
    const limitFromQueryRegex = /req\.query\.(limit|pageSize|first|take)/;
    if (limitFromQueryRegex.test(content)) {
      findings.push(
        createFinding({
          code: "NO_PAGE_SIZE_CAP",
          message: "No max page size enforcement pattern detected.",
          filePath,
          lineRange: [1, 1],
          codeSnippet: '',
          severity: "high",
          recommendation: "Apply strict upper limit (e.g. 50)."
        })
      );
    }
  }

  return findings;
}
