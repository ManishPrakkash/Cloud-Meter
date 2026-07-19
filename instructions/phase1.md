# AI Agent Instruction: Cloud-Meter Topology Discovery Implementation

## 1. Context & Objective
You are acting as a Senior Software Architect and Tooling Engineer. We are building **Cloud-Meter**, a Node.js Command Line Interface (CLI) application. It statically analyzes codebases (without running them) to detect anti-patterns and estimate infrastructure requirements and costs[cite: 2].

**Your Task:** Implement the **Topology Discovery** module. You will create a new detector file at `src/detectors/topology-detector.ts` to scan the target project's file system and Abstract Syntax Tree (AST) to identify the core web framework, ORM, and database engine type.

## 2. Technical Stack & Constraints
*   **Language:** TypeScript (Strict mode).
*   **AST Parsing:** Use `@babel/parser`, `@babel/traverse`, and `ts-morph` for deep, execution-free pattern detection.
*   **Static Analysis Only:** You must NOT execute the target project's code[cite: 1, 2].
*   **Best-Effort Compilation:** When using `ts-morph`, explicitly set `checkJs: false` and ignore compilation errors so the tool parses incomplete or slightly broken projects without failing.
*   **Error Handling:** Analysis failures (e.g., unparseable files) must be swallowed gracefully so the tool doesn't crash on syntax errors in the target codebase.

## 3. Real-World Robustness (ANTI-OVERFITTING)
Your implementation MUST NOT be hardcoded to pass simple unit tests. It must survive real-world, unpredictable codebases. 

**Strict Technical Constraints:**
1. **No Brittle Regex/String Matching:** Do NOT use simple `.includes()` or naive regex to detect frameworks or ORMs in source code. 
2. **Use Deep AST Traversal:** You must use `@babel/traverse` or `ts-morph` to track declarations. For example, if a user writes `import e from 'express'`, and later calls `const app = e()`, your AST visitor must be able to trace that `CallExpression` back to the framework import.
3. **Handle Atypical Project Structures:** Do not assume the backend is at the root directory. Users will run this tool inside monorepos (e.g., Turborepo, Nx). The detector must intelligently scan subdirectories like `apps/api`, `packages/backend`, or `services/core` without timing out.
4. **Resilient Env Parsing:** When hunting for database connection strings, do not assume they are always named `DATABASE_URL`. Look for common patterns (e.g., `DB_URI`, `MONGO_URL`, `POSTGRES_CONNECTION`) across `.env`, `.env.local`, and `.env.production`.

## 4. Detection Requirements
You need to build heuristics to detect the following elements via AST and file structure mapping:

### A. Web Framework
*   **Express:** Search for `import express from 'express'`, `require('express')`, or `express()` initializations using AST traversal.
*   **Next.js:** Detect Next.js by checking for `next` in package dependencies or identifying `app/api/` and `pages/api/` directory structures.
*   **NestJS:** Search for `@nestjs/core` imports or `@Controller()` decorators via AST.

### B. ORM / Data Layer
*   **Prisma:** Detect `new PrismaClient()` in the AST or the existence of a `prisma/schema.prisma` file in the project directory.
*   **Drizzle:** Detect imports from `drizzle-orm` in the AST.
*   **Kysely:** Detect imports from `kysely` or the instantiation of `new Kysely()` via AST.

### C. Database Engine
*   **PostgreSQL, MySQL, MongoDB:** Scan environment variables, `prisma.schema`, or configuration objects for connection string prefixes (`postgres://`, `postgresql://`, `mysql://`, `mongodb://`). 

## 5. Security & Production Guardrails (CRITICAL)
As a tool that operates entirely locally on the user's filesystem[cite: 1], security and stability are paramount:
1.  **Prevent Directory Traversal:** Ensure the directory scanner is strictly bound to the target directory. 
2.  **Ignore Dependencies:** Explicitly ignore `node_modules`, `.git`, `.next`, and `dist` directories.
3.  **Bounded Memory:** Loading large monorepos into `ts-morph` can be memory-intensive, so you must limit the initial source file sampling to mitigate this[cite: 1].
4.  **No Secret Leaks:** When scanning `.env.example` or configuration files for database types, do not capture or log any actual credentials, hostnames, or passwords. Extract ONLY the database engine type.

## 6. Output Schema
Create and export the following TypeScript interfaces in `src/types.ts`[cite: 1], and ensure the detector returns this exact structure:

```typescript
export interface TopologyResult {
  framework: 'express' | 'nextjs' | 'nestjs' | 'unknown';
  orm: 'prisma' | 'drizzle' | 'kysely' | 'none';
  database: 'postgres' | 'mysql' | 'mongodb' | 'unknown';
  confidenceScore: number; // 0 to 100 based on how many signatures matched
}