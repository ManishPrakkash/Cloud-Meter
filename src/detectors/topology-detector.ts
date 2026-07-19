import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "@babel/parser";
import { createRequire } from "node:module";
import type { TopologyResult } from "../types.js";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default;

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
]);

interface TopologySignals {
  express: number;
  nextjs: number;
  nestjs: number;
  prisma: number;
  drizzle: number;
  kysely: number;
  postgres: number;
  mysql: number;
  mongodb: number;
}

export async function detectTopology(rootPath: string): Promise<TopologyResult> {
  const signals: TopologySignals = {
    express: 0,
    nextjs: 0,
    nestjs: 0,
    prisma: 0,
    drizzle: 0,
    kysely: 0,
    postgres: 0,
    mysql: 0,
    mongodb: 0,
  };

  await scanDirectory(rootPath, rootPath, signals, 0);

  const result: TopologyResult = {
    framework: "unknown",
    orm: "none",
    database: "unknown",
    confidenceScore: 0,
  };

  let maxFramework = 0;
  if (signals.express > maxFramework) {
    maxFramework = signals.express;
    result.framework = "express";
  }
  if (signals.nextjs > maxFramework) {
    maxFramework = signals.nextjs;
    result.framework = "nextjs";
  }
  if (signals.nestjs > maxFramework) {
    maxFramework = signals.nestjs;
    result.framework = "nestjs";
  }

  let maxOrm = 0;
  if (signals.prisma > maxOrm) {
    maxOrm = signals.prisma;
    result.orm = "prisma";
  }
  if (signals.drizzle > maxOrm) {
    maxOrm = signals.drizzle;
    result.orm = "drizzle";
  }
  if (signals.kysely > maxOrm) {
    maxOrm = signals.kysely;
    result.orm = "kysely";
  }

  let maxDb = 0;
  if (signals.postgres > maxDb) {
    maxDb = signals.postgres;
    result.database = "postgres";
  }
  if (signals.mysql > maxDb) {
    maxDb = signals.mysql;
    result.database = "mysql";
  }
  if (signals.mongodb > maxDb) {
    maxDb = signals.mongodb;
    result.database = "mongodb";
  }

  // Calculate a basic confidence score (0-100)
  const totalMatches = maxFramework + maxOrm + maxDb;
  result.confidenceScore = Math.min(100, totalMatches * 20);

  return result;
}

async function scanDirectory(
  dir: string,
  rootPath: string,
  signals: TopologySignals,
  depth: number
): Promise<void> {
  if (depth > 10) return; // Prevent excessive deep traversal

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    // Pre-check for specific Next.js folder patterns
    if (path.basename(dir) === "api") {
      const parentDir = path.basename(path.dirname(dir));
      if (parentDir === "app" || parentDir === "pages") {
        signals.nextjs += 2;
      }
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, rootPath, signals, depth + 1);
      } else if (entry.isFile()) {
        await analyzeFile(fullPath, signals);
      }
    }
  } catch (error) {
    // Swallow access errors
  }
}

async function analyzeFile(filePath: string, signals: TopologySignals): Promise<void> {
  const ext = path.extname(filePath);
  const basename = path.basename(filePath);

  if (basename === "package.json") {
    await analyzePackageJson(filePath, signals);
    return;
  }

  if (basename.startsWith(".env")) {
    await analyzeEnvFile(filePath, signals);
    return;
  }

  if (basename === "schema.prisma") {
    signals.prisma += 5;
    return;
  }

  if (ext === ".ts" || ext === ".js" || ext === ".tsx" || ext === ".jsx") {
    await analyzeSourceFile(filePath, signals);
  }
}

async function analyzePackageJson(filePath: string, signals: TopologySignals): Promise<void> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const pkg = JSON.parse(content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.express) signals.express += 1;
    if (deps.next) signals.nextjs += 2;
    if (deps["@nestjs/core"]) signals.nestjs += 2;
    if (deps["@prisma/client"]) signals.prisma += 2;
    if (deps["drizzle-orm"]) signals.drizzle += 2;
    if (deps.kysely) signals.kysely += 2;
  } catch {
    // ignore
  }
}

async function analyzeEnvFile(filePath: string, signals: TopologySignals): Promise<void> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const [key, ...rest] = trimmed.split("=");
      const val = rest.join("=").toLowerCase();
      
      const upperKey = key.toUpperCase();
      
      // Look for common connection string formats safely
      if (
        upperKey.includes("DATABASE_URL") ||
        upperKey.includes("DB_URI") ||
        upperKey.includes("MONGO_URL") ||
        upperKey.includes("POSTGRES_CONNECTION")
      ) {
        if (val.includes("postgres://") || val.includes("postgresql://")) signals.postgres += 3;
        else if (val.includes("mysql://")) signals.mysql += 3;
        else if (val.includes("mongodb://") || val.includes("mongodb+srv://")) signals.mongodb += 3;
      }
    }
  } catch {
    // ignore
  }
}

async function analyzeSourceFile(filePath: string, signals: TopologySignals): Promise<void> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const ast = parse(content, {
      sourceType: "unambiguous",
      plugins: ["typescript", "jsx", "decorators-legacy"],
      errorRecovery: true,
    });

    let hasExpressImport = false;
    let expressIdentifier = "";

    traverse(ast, {
      ImportDeclaration(pathNode: any) {
        const source = pathNode.node.source.value;
        if (source === "express") {
          signals.express += 1;
          hasExpressImport = true;
          // Track the local name of the import (e.g. `import e from 'express'`)
          const defaultSpecifier = pathNode.node.specifiers.find(
             (s: any) => s.type === "ImportDefaultSpecifier"
          );
          if (defaultSpecifier) {
              expressIdentifier = defaultSpecifier.local.name;
          }
        }
        if (source.includes("@nestjs/core")) signals.nestjs += 1;
        if (source.includes("drizzle-orm")) signals.drizzle += 1;
        if (source === "kysely") signals.kysely += 1;
        if (source === "@prisma/client") signals.prisma += 1;
      },
      CallExpression(pathNode: any) {
        const callee = pathNode.node.callee;
        if (callee.type === "Identifier") {
          if (callee.name === "require") {
            const arg = pathNode.node.arguments[0];
            if (arg && arg.type === "StringLiteral") {
              if (arg.value === "express") signals.express += 1;
            }
          } else if (hasExpressImport && expressIdentifier && callee.name === expressIdentifier) {
            // Found `const app = express()` where `express` matched the import
            signals.express += 2;
          }
        }
      },
      NewExpression(pathNode: any) {
        const callee = pathNode.node.callee;
        if (callee.type === "Identifier") {
          if (callee.name === "PrismaClient") signals.prisma += 2;
          if (callee.name === "Kysely") signals.kysely += 2;
        }
      },
      Decorator(pathNode: any) {
        const expr = pathNode.node.expression;
        if (expr.type === "CallExpression" && expr.callee.type === "Identifier" && expr.callee.name === "Controller") {
            signals.nestjs += 2;
        }
      }
    });
  } catch (error) {
    // Swallow parse errors
  }
}
