<p align="center">
  <h1 align="center">☁️ Cloud Meter</h1>
  <p align="center">
    <strong>Production-grade backend pagination analyzer CLI</strong>
  </p>
  <p align="center">
    Catch pagination anti-patterns, unbounded queries, and database scaling risks<br/>
    before they hit production.
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/cloud-meter"><img src="https://img.shields.io/npm/v/cloud-meter.svg?style=flat-square" alt="npm version" /></a>
    <a href="https://github.com/ManishPrakkash/Cloud-Meter/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/cloud-meter.svg?style=flat-square" alt="license" /></a>
    <img src="https://img.shields.io/node/v/cloud-meter.svg?style=flat-square" alt="node version" />
  </p>
</p>

---

## Why Cloud Meter?

Most backend performance issues in production come from **poorly implemented pagination** — unbounded queries, deep offsets, missing limits, and unstable sorting. Cloud Meter statically analyzes your codebase (no runtime needed) and gives you an actionable score with fix recommendations.

## Quick Start

```bash
# Install globally
npm install -g cloud-meter

# Run it — the CLI will guide you
cloud-meter
```

That's it. The CLI is fully self-guiding. Every command tells you what to run next.

## How It Works

```
cloud-meter analyze ./backend
```

Cloud Meter will:

1. **Scan** your backend directory for JS/TS files, SQL queries, and ORM patterns
2. **Detect** pagination strategies (offset, cursor, GraphQL relay, raw SQL)
3. **Analyze** patterns using AST parsing — no code execution required
4. **Score** your codebase from 0–100 based on severity of detected issues
5. **Report** findings with root causes, fix recipes, and next actions

## Commands

### `cloud-meter` (no args)

Shows a friendly **getting started** guide with numbered steps:

```
☁  Welcome to Cloud-Meter!
   Production-grade backend pagination efficiency analyzer

Getting started:
────────────────────────────────────────────────────
  1.  cloud-meter init            — Set up project config (optional)
  2.  cloud-meter analyze <path>  — Scan your backend for pagination issues
  3.  cloud-meter recommend       — View fix suggestions from analysis
  4.  cloud-meter doctor          — Diagnose your setup
```

---

### `cloud-meter init`

Sets up a `cloud-meter.config.json` in your project root via an interactive wizard. Configure once, skip flags forever.

```bash
cloud-meter init
```

**What it configures:**
- Default analysis target path
- Output mode (pretty / minimal / JSON)
- Max allowed severity threshold (for CI gates)
- Enforced pagination strategy (cursor / offset / none)
- Directories to ignore

After setup, it suggests what to do next:
```
✔ Config saved → ./cloud-meter.config.json

What's next?
────────────────────────────────────────────────────
  1.  cloud-meter analyze  — Run analysis using your saved config
  2.  cloud-meter doctor   — Verify your environment
  3.  cloud-meter config   — View your saved defaults anytime
```

> **When to use `init`:** Use it when you want to save project-level defaults — e.g., always analyze `./src/api` with minimal output and fail CI on critical findings. Your config is auto-loaded by all commands.

---

### `cloud-meter analyze [path]`

The core scanner. Runs the full pattern rulebook against your codebase.

```bash
# Interactive guided mode (recommended for first run)
cloud-meter analyze

# Direct scan
cloud-meter analyze ./backend

# Non-interactive CI mode
cloud-meter analyze ./src --mode ci --json

# Short summary
cloud-meter analyze . --output minimal

# Full colorful report
cloud-meter analyze . --output pretty
```

**Options:**
| Flag | Description |
|---|---|
| `--json` | Machine-readable JSON output |
| `-o, --output <mode>` | `pretty` \| `json` \| `minimal` |
| `--mode <mode>` | `dev` \| `ci` \| `deep` |
| `--interactive` | Force guided prompts |
| `--no-interactive` | Skip all prompts |
| `--summary-only` | Print only the score summary |
| `--verbose` | Include debug details |

After analysis, it tells you what to do next:
```
What's next?
────────────────────────────────────────────────────
  →  cloud-meter recommend    — View code fix recipes from this analysis
  →  cloud-meter analyze --json  — Export results for CI/CD pipelines
  →  cloud-meter doctor       — Diagnose environment & config issues
```

---

### `cloud-meter recommend`

Displays deep code fix recommendations cached from your last `analyze` run.

```bash
cloud-meter recommend
```

If you haven't analyzed yet, it guides you:
```
  ⚠  No analysis cache found.
     Recommendations are generated from previous analysis runs.

  How to get recommendations:
  1.  Run cloud-meter analyze <path> to scan your codebase
  2.  Then re-run cloud-meter recommend to view suggestions
```

---

### `cloud-meter doctor`

Validates your local environment, config, and workspace structure.

```bash
cloud-meter doctor
cloud-meter doctor ./backend
```

Checks: Node.js version, runtime OS, `package.json` presence, path permissions, built artifacts, and saved preferences. After passing, it suggests:
```
What's next?
────────────────────────────────────────────────────
  →  cloud-meter analyze <path>  — Run full pagination analysis
  →  cloud-meter init            — Set up project-level config defaults
```

---

### `cloud-meter config`

Prints your current merged config (file defaults + built-in defaults):

```bash
cloud-meter config
```

```
☁  Cloud-Meter Config
────────────────────────────────────────────────────
{
  "defaultPath": ".",
  "outputMode": "pretty",
  "interactive": true,
  "maxAllowedSeverity": "high",
  "ignorePaths": ["node_modules", "dist", ".git"]
}

  To change these defaults, run: cloud-meter init
```

---

## What It Detects

| Detection | Description |
|---|---|
| **Missing LIMIT** | Queries without explicit row limits |
| **Deep OFFSET** | Skip values > 10,000 rows |
| **No ORDER BY** | Paginated queries without stable sorting |
| **Offset pagination** | OFFSET-based patterns (vs keyset) |
| **No page size cap** | No max limit enforcement |
| **Unstable cursor** | Cursor fields that aren't unique/stable |
| **Multiplication skip** | `page * pageSize` calculation patterns |
| **Unbounded endpoints** | Multiple endpoints lacking bounds |
| **Missing index hints** | ORDER BY without compound index support |
| **Concurrent write risk** | Pagination under write contention |
| **Dynamic sort unsafe** | User input directly controlling sort order |
| **Infinite scroll unsafe** | Patterns that break under infinite scroll |

## Scoring Model

Score starts at **100** and deducts based on severity:

| Issue | Deduction |
|---|---:|
| Missing explicit LIMIT | **-30** |
| Multiple unbounded endpoints | **-20** |
| Deep OFFSET usage | **-20** |
| Missing stable ORDER BY | **-15** |
| No max page size cap | **-15** |
| Offset pagination used | **-10** |
| Unstable cursor structure | **-10** |
| Multiplication-based skip | **-10** |

Additional heuristic penalties apply for dynamic sorting, scan risks, and concurrency anomalies.

### Grades

| Score | Grade |
|---|---|
| 90–100 | 🟢 **Production Grade** |
| 75–89 | 🔵 **Good** |
| 60–74 | 🟡 **Needs Optimization** |
| 40–59 | 🟠 **High Risk** |
| < 40 | 🔴 **Critical** |

## Typical Workflow

```
                ┌──────────────┐
                │  cloud-meter │  ← Start here (shows getting started)
                └──────┬───────┘
                       │
                ┌──────▼───────┐
                │     init     │  ← Optional: save project defaults
                └──────┬───────┘
                       │
                ┌──────▼───────┐
                │   analyze    │  ← Core scan + scoring
                └──────┬───────┘
                       │
              ┌────────┼────────┐
              │        │        │
        ┌─────▼──┐ ┌───▼───┐ ┌─▼──────┐
        │recommend│ │doctor │ │ config │
        └────────┘ └───────┘ └────────┘
```

## CI/CD Integration

Use `--mode ci` for non-interactive runs that exit with code `1` when findings exceed your configured severity threshold:

```bash
cloud-meter analyze ./src --mode ci --json
```

Combine with `init` to set your `maxAllowedSeverity` (e.g., `high`) so the pipeline fails automatically on critical findings.

## Supported Patterns

- **ORMs:** Prisma, Mongoose, Sequelize, TypeORM, generic patterns
- **SQL:** Raw `SELECT` / `LIMIT` / `OFFSET` / `ORDER BY` in `.sql` files and template literals
- **GraphQL:** Relay-style (`first`, `after`, `edges`, `cursor`) in resolvers
- **Frameworks:** Express, NestJS, Fastify, Koa route/controller/service layers
- **Wrappers:** Shared utility patterns like `paginate(...)`, `withPagination(...)`
- **Monorepos:** Auto-detects `apps/api`, `services/api`, `backend` directory structures

## Development

```bash
# Install
npm install

# Build
npm run build

# Link locally
npm link

# Type check
npm run typecheck

# Run tests
npm test
```

Test fixtures are located in `fixtures/backend-risk` and `fixtures/backend-safe`.

## License

[ISC](./LICENSE) © Manish Prakkash
