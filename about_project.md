# Cloud-Meter

## 1. Project Overview

**Cloud-Meter** is a production-grade backend pagination analyzer built as a Node.js Command Line Interface (CLI) application. 

**Problem it solves:** Most backend performance issues in production arise from poorly implemented pagination—such as unbounded database queries, deep offsets that scan too many rows, missing limits, and unstable sorting patterns. Cloud-Meter statically analyzes codebases (without running them) to detect these anti-patterns before they reach production.

**Main purpose and use cases:**
- **Code Audits:** Developers can scan their backend code to catch scaling risks.
- **CI/CD Integration:** Pipelines can run the tool in non-interactive mode to block merges that introduce critical pagination vulnerabilities.
- **Guided Fixes:** The CLI provides actionable recommendations and code diffs to fix detected issues.

**Implementation Status:** The project is fully functional, robustly tested, and actively handles multi-framework architectures (Express, Next.js, React Server Actions, NestJS, etc.) alongside modern ORMs (Drizzle, Kysely, Prisma).

---

## 2. Complete Project Architecture

The application is purely a **CLI tool** executed in a Node.js environment. It has no frontend web UI, no database of its own, and does not expose external web APIs.

### System Architecture
1. **CLI Layer (`src/bin.ts`, `src/commands/`):** Handles argument parsing, routing to commands, and bootstrapping the user interface.
2. **Scanner & Indexer (`src/core/`, `src/indexing/`):** Recursively traverses the target directory, classifies files (TypeScript, JavaScript, SQL), and uses AST tools to identify endpoints (routes, resolvers, server actions).
3. **Detector Engine (`src/detectors/`, `src/analyzers/`):** The core analysis engine. It uses `@babel/parser` and `ts-morph` to walk the Abstract Syntax Tree (AST) of the target project, matching specific patterns (e.g., `req.query.limit`, `.offset()`, `fetch()`).
4. **Scoring Engine (`src/scoring/`):** Evaluates detected findings and assigns a risk score out of 100 based on severity deductions.
5. **Reporting & UI (`src/reporting/`, `src/ui/`):** Generates actionable recipes and handles the interactive Terminal User Interface (TUI) for data exploration.

**Data Flow Communication:**
User Command -> CLI Parser -> Analyzer Engine -> Project Indexer -> Detectors -> Findings Array -> Grouper & Scorer -> Cache Storage -> UI Renderer.

---

## 3. Complete Project Structure

The project is structured logically around the analysis lifecycle:

- `package.json` / `tsconfig.json`: Node.js and TypeScript configurations.
- `bin/`: Contains the compiled executable entry script.
- `src/`
  - `bin.ts`: The primary entry point. Configures the `commander` CLI.
  - `config/`: Handles loading and merging `cloud-meter.config.json` preferences.
  - `commands/`: Contains the entry points for the CLI commands (`analyze.ts`, `doctor.ts`, `init.ts`, `recommend.ts`).
  - `core/`: File classification and project scanning utilities.
  - `indexing/`: Discovers endpoints (`endpoint-discovery.ts`) and builds call chains (`callgraph.ts`) using `ts-morph`.
  - `detectors/`: The heart of the analysis. Contains rule-sets for matching bad code patterns via AST:
    - `ast-pagination-detector.ts`: Detects framework and ORM pagination logic.
    - `graphql-pattern-detector.ts`: Detects GraphQL Relay-style risks.
    - `sql-pagination-detector.ts`: Detects raw SQL risks.
  - `analyzers/`: Aggregates and enriches findings from detectors.
  - `analysis/`: Groups raw findings into logical "Units" (e.g., grouping a controller and service issue into one endpoint unit).
  - `scoring/`: Implements the 0-100 scoring model (`scoring-engine.ts`).
  - `reporting/`: Generates human-readable fixes and recommendations.
  - `ui/`: Terminal UI components (spinners, tables, banners) and the interactive drill-down menus (`tui/drilldown.ts`).
  - `types.ts`: Centralized TypeScript interfaces representing the domain model (Findings, Units, Metrics).
- `tests/`: Contains a comprehensive suite of `vitest` unit and integration tests.

---

## 4. Current Working Flow

**End-to-End Analysis Flow:**
1. **Start:** The user runs `cloud-meter analyze <path>`.
2. **Boot:** `src/bin.ts` parses the command, loads saved preferences from `cloud-meter.config.json`, and invokes `runAnalyzeCommand`.
3. **Scan:** The analyzer `engine.ts` scans the path, classifying files into types (source code, SQL, etc.).
4. **Index:** `project-indexer.ts` parses the files to find entry points (e.g., Express routes, Next.js API routes). It attempts to build a call chain bridging the route down to database operations using `ts-morph`.
5. **Detect:** The `detectors/` iterate over every classified file. By analyzing the AST, they look for specific patterns (e.g., checking if `.offset()` is called without `.limit()`). Each matched pattern produces a `Finding`.
6. **Score:** Findings are grouped into `AnalysisUnit`s. The `scoring-engine` applies point deductions to a starting score of 100 based on the severity of the findings (e.g., Critical = -30 points).
7. **Cache:** The final `AnalysisResult` is saved to `.cloud-meter/cache.json`.
8. **Render:** The CLI displays the score. If in interactive mode, it launches the drill-down TUI for the user to explore the issues file-by-file.

---

## 5. Detailed Feature Implementation

### 1. Doctor Command (`cloud-meter doctor`)
- **How it works:** Diagnoses the local environment to ensure smooth analysis.
- **Implementation:** `src/commands/doctor.ts`. It parses `package.json` to detect the tech stack (Next.js, Express, etc.), checks for monorepo structures (`lerna.json`, `turbo.json`), and validates TypeScript alias configurations (`tsconfig.json`).

### 2. Init Command (`cloud-meter init`)
- **How it works:** Bootstraps project settings using interactive prompts.
- **Implementation:** `src/commands/init.ts` uses `@inquirer/prompts` to ask questions and writes answers to `cloud-meter.config.json`.

### 3. Analyze Command (`cloud-meter analyze`)
- **How it works:** The core scanner.
- **Implementation:** Orchestrated by `src/analyzer/engine.ts`. Uses `@babel/parser` and `@babel/traverse` to parse JavaScript/TypeScript files into ASTs, allowing deep inspection of function calls, variable declarations, and logic flow without executing the code.

### 4. Recommend Command (`cloud-meter recommend`)
- **How it works:** Suggests code fixes based on the last scan.
- **Implementation:** Reads from `.cloud-meter/cache.json`. Uses `src/commands/recommend.ts` to output context-aware colored code diffs (e.g., showing how to cap a pagination limit).

---

## 6. Frontend Implementation
*N/A: This project is a Node.js CLI tool. It does not have a frontend web application.*

---

## 7. Backend Implementation

While this is a CLI, its internal architecture resembles a layered backend:
- **Controllers (Commands):** `src/commands/*.ts` handle user input options and output presentation.
- **Services (Engine):** `src/analyzer/engine.ts` orchestrates the heavy lifting.
- **Business Logic (Detectors/Scoring):** The specific rules for what constitutes a "pagination risk" live purely in `src/detectors/` and `src/scoring/`.
- **Error Handling:** Graceful CLI exits. Analysis failures (e.g., unparseable files) are swallowed during indexing so the tool doesn't crash on syntax errors in the target codebase.

---

## 8. Database and Data Flow

- **Database:** None. The application is stateless across runs, persisting only configuration and cache to local JSON files.
- **State Storage:** 
  - `cloud-meter.config.json`: User preferences.
  - `.cloud-meter/cache.json`: Stores the `AnalysisResult` (metrics, findings, units) generated by the last `analyze` run, allowing the `recommend` command to work instantly without re-analyzing.

---

## 9. API Documentation
*N/A: This project does not expose any web APIs.*

---

## 10. Authentication and Security
*N/A: This is a local developer tool. It requires no authentication and operates entirely locally on the user's filesystem.*

---

## 11. Configuration and Environment

**Important Configuration Files:**
- `cloud-meter.config.json`: The project-level configuration file. 
  - `defaultPath`: Directory to analyze if none is provided.
  - `outputMode`: `pretty`, `minimal`, or `json`.
  - `maxAllowedSeverity`: Threshold for failing CI builds.
  - `ignorePaths`: Directories to skip (e.g., `node_modules`).

**Environment Variables:**
No specific `.env` variables are required for standard operation.

---

## 12. Dependencies and Technologies

- **TypeScript:** Primary language for type safety and modern JS features.
- **Commander:** `^14.0.1` - Robust command-line interface parsing.
- **@babel/parser & @babel/traverse:** `^7.28.0` - Used to parse target codebases into ASTs for deep, execution-free pattern detection.
- **ts-morph:** `^25.0.1` - Used to construct complex call chains across files in the target project.
- **@inquirer/prompts:** `^7.8.4` - Powers the interactive CLI menus and wizard flows.
- **cli-table3 & chalk & gradient-string:** For beautiful terminal UI rendering.
- **Vitest:** `^3.0.8` - Fast unit and integration testing framework.

---

## 13. Setup and Running the Project

**Prerequisites:** Node.js >= 18.0.0

**Installation:**
```bash
npm install
```

**Development Commands:**
```bash
npm run dev             # Runs 'cloud-meter analyze .' locally using tsx
npm run build           # Compiles TS to JS in the dist/ folder
npm run typecheck       # Validates TypeScript types
npm test                # Runs the full vitest suite
```

**Global Usage (Production):**
```bash
npm link                # Links the local package globally
cloud-meter             # Runs the CLI menu
```

---

## 14. Current Implementation Status

**Fully Implemented Features:**
- CLI routing and interactive menus.
- AST parsing for JS/TS, detecting raw `req.query`, standard `searchParams`, ORM chains (Prisma, Drizzle, Kysely), and frontend `fetch()` calls.
- Scoring models with defined point deductions.
- Result caching and context-aware diff recommendations.
- Interactive TUI for exploring findings.

**Placeholder/TODOs:**
- There are no visible placeholders or stubs. The codebase is complete regarding its core stated features.
- The `impact` property on `Finding` is defined in `types.ts` as "Kept intentionally vague for now", indicating a potential future expansion for tracking specific performance or abuse risks numerically.

---

## 15. Important Technical Decisions and Patterns

1. **Static Analysis over Runtime Hooks:** The tool analyzes code statically via AST rather than monkey-patching database drivers. This makes it framework-agnostic, safer, and entirely local.
2. **Best-Effort Compilation:** When using `ts-morph` in `project-indexer.ts`, the engine explicitly sets `checkJs: false` and ignores compilation errors. This is crucial because it allows the tool to parse incomplete or slightly broken projects without failing.
3. **Layered Discovery:** The tool categorizes findings via `Unit` grouping. If it finds an unbounded limit in a database repository, and a route that calls that repository, it groups them into a single "Endpoint Unit" for a cleaner developer experience.

---

## 16. Known Limitations and Technical Debt

- **Dynamic Property Tracking:** Static AST analysis has inherent limitations. If a pagination limit is constructed dynamically via heavily abstracted utility functions, or passed through complex generic layers, the AST parser might lose the trail and miss the finding.
- **Call Chain Limitations:** `callgraph.ts` limits depth to 6 and nodes to 25. Extremely deeply nested architectures might truncate before a database call is mapped to an endpoint.
- **Memory Consumption:** Loading large monorepos into `ts-morph` can be memory-intensive, though the project limits the initial source file sampling to mitigate this.

---

## 17. End-to-End System Summary

**Cloud-Meter** is a specialized static analysis tool designed for backend engineers. 

When a user executes `cloud-meter analyze`, the tool traverses their codebase, locating API endpoints (Routes, Controllers, Resolvers) and SQL files. It uses advanced AST parsing tools (`@babel` and `ts-morph`) to read the codebase exactly like a compiler would, searching specifically for pagination logic.

It checks if offset queries have hard limits, if cursors use unique tie-breaker columns, and if frontend APIs request bounded datasets. It takes every infraction it finds, groups them by the API endpoint they belong to, and deducts points from a starting score of 100. 

Finally, it presents the user with a beautiful terminal interface highlighting their critical risks, providing visual code diffs on exactly how to fix the issues, and allowing them to enforce pagination best-practices automatically via CI/CD pipelines.
