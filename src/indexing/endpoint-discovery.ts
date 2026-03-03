import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parse } from "@babel/parser";
import type { CallExpression, Node, ObjectExpression, ObjectProperty } from "@babel/types";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default as (
  ast: unknown,
  visitors: Record<string, (...args: any[]) => void>
) => void;

export type DiscoveredUnitKind = "http" | "graphql" | "nest-http" | "nest-graphql";

export interface DiscoveredUnit {
  id: string;
  kind: DiscoveredUnitKind;
  name: string;
  filePath: string;
  lineRange?: [number, number];
  /** Best-effort handler symbol name (for call chain attempts). */
  entrySymbol?: string;
  /** Best-effort cross-file call chain (when available). */
  callChain?: Array<{ filePath: string; symbol?: string; line?: number }>;
  /** Extra details for display/debugging. */
  meta?: Record<string, string>;
}

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head"
]);

function safeSlice(content: string, node: { start?: number | null; end?: number | null }): string {
  const start = node.start ?? 0;
  const end = node.end ?? 0;
  if (typeof start !== "number" || typeof end !== "number") return "";
  return content.slice(start, end);
}

function getPropName(node: ObjectProperty): string | undefined {
  const key = node.key;
  if (key.type === "Identifier") return key.name;
  if (key.type === "StringLiteral") return key.value;
  return undefined;
}

function getObjProp(obj: ObjectExpression, name: string): ObjectProperty | undefined {
  return obj.properties.find(
    (p): p is ObjectProperty => p.type === "ObjectProperty" && getPropName(p) === name
  );
}

function discoverHttpUnits(filePath: string, content: string): DiscoveredUnit[] {
  const units: DiscoveredUnit[] = [];
  const ast = parse(content, { sourceType: "unambiguous", plugins: ["typescript", "jsx"] });

  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node as CallExpression;
      if (node.callee.type !== "MemberExpression") return;
      const prop = node.callee.property;
      const method = prop.type === "Identifier" ? prop.name : prop.type === "StringLiteral" ? prop.value : "";
      if (!HTTP_METHODS.has(method)) return;

      const firstArg = node.arguments[0];
      if (!firstArg || firstArg.type !== "StringLiteral") return;
      const routePath = firstArg.value;

      const handlerArg = node.arguments[1];
      let entrySymbol: string | undefined;
      let handlerLabel = "<inline>";
      if (handlerArg) {
        if (handlerArg.type === "Identifier") {
          entrySymbol = handlerArg.name;
          handlerLabel = handlerArg.name;
        } else if (handlerArg.type === "MemberExpression") {
          handlerLabel = safeSlice(content, handlerArg);
        } else if (handlerArg.type === "FunctionExpression" || handlerArg.type === "ArrowFunctionExpression") {
          handlerLabel = "<inline>";
        }
      }

      const locStart = node.loc?.start.line ?? 1;
      const locEnd = node.loc?.end.line ?? locStart;

      units.push({
        id: `http:${method}:${routePath}:${filePath}:${locStart}`,
        kind: "http",
        name: `${method.toUpperCase()} ${routePath}`,
        filePath,
        lineRange: [locStart, locEnd],
        entrySymbol,
        meta: {
          method,
          path: routePath,
          handler: handlerLabel
        }
      });
    }
  });

  return units;
}

function discoverGraphqlObjectUnits(filePath: string, content: string): DiscoveredUnit[] {
  const units: DiscoveredUnit[] = [];
  if (!/resolvers|Query|Mutation/.test(content)) return units;

  const ast = parse(content, { sourceType: "unambiguous", plugins: ["typescript", "jsx"] });

  traverse(ast, {
    ObjectExpression(path: any) {
      const node = path.node as ObjectExpression;
      const queryProp = getObjProp(node, "Query");
      const mutationProp = getObjProp(node, "Mutation");
      const parents: Array<{ type: "Query" | "Mutation"; prop?: ObjectProperty }> = [];
      if (queryProp) parents.push({ type: "Query", prop: queryProp });
      if (mutationProp) parents.push({ type: "Mutation", prop: mutationProp });

      for (const parent of parents) {
        const value = parent.prop?.value;
        if (!value || value.type !== "ObjectExpression") continue;

        for (const prop of value.properties) {
          if (prop.type !== "ObjectProperty") continue;
          const fieldName = getPropName(prop);
          if (!fieldName) continue;

          const locStart = prop.loc?.start.line ?? 1;
          const locEnd = prop.loc?.end.line ?? locStart;

          let entrySymbol: string | undefined;
          if (prop.value.type === "Identifier") entrySymbol = prop.value.name;

          units.push({
            id: `graphql:${parent.type}.${fieldName}:${filePath}:${locStart}`,
            kind: "graphql",
            name: `${parent.type}.${fieldName}`,
            filePath,
            lineRange: [locStart, locEnd],
            entrySymbol,
            meta: { parentType: parent.type }
          });
        }
      }
    }
  });

  return units;
}

function discoverNestHttpUnits(filePath: string, content: string): DiscoveredUnit[] {
  const units: DiscoveredUnit[] = [];
  if (!/@(Get|Post|Put|Patch|Delete|Options|Head)\(/.test(content)) return units;

  const ast = parse(content, { sourceType: "unambiguous", plugins: ["typescript", "jsx", "decorators-legacy"] });

  traverse(ast, {
    MethodDefinition(path: any) {
      const node = path.node;
      const decorators = node.decorators ?? [];
      for (const dec of decorators) {
        const expr = dec.expression;
        if (expr.type !== "CallExpression") continue;
        if (expr.callee.type !== "Identifier") continue;
        const name = expr.callee.name;
        if (!["Get", "Post", "Put", "Patch", "Delete", "Options", "Head"].includes(name)) continue;

        const arg = expr.arguments[0];
        const routePath = arg && arg.type === "StringLiteral" ? arg.value : "/";
        const methodName = node.key.type === "Identifier" ? node.key.name : "<method>";
        const locStart = node.loc?.start.line ?? 1;
        const locEnd = node.loc?.end.line ?? locStart;

        units.push({
          id: `nest-http:${name}:${routePath}:${filePath}:${locStart}`,
          kind: "nest-http",
          name: `${name.toUpperCase()} ${routePath} (${methodName})`,
          filePath,
          lineRange: [locStart, locEnd],
          entrySymbol: methodName,
          meta: { decorator: name, path: routePath }
        });
      }
    }
  });

  return units;
}

function discoverNestGraphqlUnits(filePath: string, content: string): DiscoveredUnit[] {
  const units: DiscoveredUnit[] = [];
  if (!/@(Query|Mutation)\(/.test(content)) return units;

  const ast = parse(content, { sourceType: "unambiguous", plugins: ["typescript", "jsx", "decorators-legacy"] });

  traverse(ast, {
    MethodDefinition(path: any) {
      const node = path.node;
      const decorators = node.decorators ?? [];
      for (const dec of decorators) {
        const expr = dec.expression;
        if (expr.type !== "CallExpression") continue;
        if (expr.callee.type !== "Identifier") continue;
        const name = expr.callee.name;
        if (!["Query", "Mutation"].includes(name)) continue;

        const arg = expr.arguments[0];
        const fieldName =
          (arg && arg.type === "StringLiteral" && arg.value) ||
          (node.key.type === "Identifier" ? node.key.name : "<field>");
        const locStart = node.loc?.start.line ?? 1;
        const locEnd = node.loc?.end.line ?? locStart;
        const methodName = node.key.type === "Identifier" ? node.key.name : "<method>";

        units.push({
          id: `nest-graphql:${name}.${fieldName}:${filePath}:${locStart}`,
          kind: "nest-graphql",
          name: `${name}.${fieldName}`,
          filePath,
          lineRange: [locStart, locEnd],
          entrySymbol: methodName,
          meta: { decorator: name }
        });
      }
    }
  });

  return units;
}

export function discoverUnitsInFile(filePath: string): DiscoveredUnit[] {
  const content = readFileSync(filePath, "utf8");
  return [
    ...discoverHttpUnits(filePath, content),
    ...discoverGraphqlObjectUnits(filePath, content),
    ...discoverNestHttpUnits(filePath, content),
    ...discoverNestGraphqlUnits(filePath, content)
  ];
}

