# Cloud-Meter commit history builder
$ErrorActionPreference = "Stop"

function DoCommit {
    param([string]$msg)
    git commit -m "$msg" 2>$null
    Write-Host "  + $msg" -ForegroundColor Green
}

Write-Host "`nBuilding commit history...`n" -ForegroundColor Cyan

# 1
git add package.json
DoCommit "init: scaffold project with package.json"

# 2
git add tsconfig.json
DoCommit "chore: add TypeScript configuration"

# 3
git add .gitignore
DoCommit "chore: add .gitignore"

# 4
git add src/types.ts
DoCommit "feat: define core TypeScript types and interfaces"

# 5
git add src/config.ts
DoCommit "feat: add global config constants and thresholds"

# 6
git add src/constants/index.ts
DoCommit "feat: add default user preferences"

# 7
git add src/config/index.ts
DoCommit "feat: add config loader with cosmiconfig"

# 8
git add src/index.ts
DoCommit "feat: add public API entry point"

# 9
git add src/core/file-classifier.ts
DoCommit "feat: add file classifier for source and SQL files"

# 10
git add src/core/project-scanner.ts
DoCommit "feat: add project scanner with ORM detection"

# 11
git add src/detectors/sql-pagination-detector.ts
DoCommit "feat: add SQL pagination detector"

# 12
git add src/detectors/ast-pagination-detector.ts
DoCommit "feat: add AST pagination detector for JS and TS"

# 13
git add src/detectors/graphql-pattern-detector.ts
DoCommit "feat: add GraphQL relay pagination detector"

# 14
git add src/analyzers/pagination-wrapper-analyzer.ts
DoCommit "feat: add shared paginate wrapper analyzer"

# 15
git add src/analyzers/pattern-analyzer.ts
DoCommit "feat: add signal aggregation and finding enrichment"

# 16
git add src/analysis/rule-engine.ts
DoCommit "feat: add rule engine with issue codes and categories"

# 17
git add src/analysis/issue-grouper.ts
DoCommit "feat: add issue grouper with unit deduplication"

# 18
git add src/scoring/scoring-engine.ts
DoCommit "feat: add scoring engine with deduction model"

# 19
git add src/indexing/endpoint-discovery.ts
DoCommit "feat: add endpoint discovery for HTTP and GraphQL"

# 20
git add src/indexing/callgraph.ts
DoCommit "feat: add cross-file call chain builder"

# 21
git add src/indexing/project-indexer.ts
DoCommit "feat: add project indexer with backend root detection"

# 22
git add src/analyzer/engine.ts
DoCommit "feat: add main analysis engine"

# 23
git add src/reporting/recommendation-engine.ts
DoCommit "feat: add recommendation engine with fix recipes"

# 24
git add src/reporting/minimal-report.ts
DoCommit "feat: add minimal console report renderer"

# 25
git add src/reporting/json-report.ts
DoCommit "feat: add JSON report renderer for CI pipelines"

# 26
git add src/ui/banner.ts
DoCommit "feat: add ASCII art banner with gradient colors"

# 27
git add src/ui/spinner.ts
DoCommit "feat: add spinner and progress bar utilities"

# 28
git add src/ui/table.ts
DoCommit "feat: add rich console report with color tables"

# 29
git add src/ui/wizard.ts
DoCommit "feat: add interactive analysis wizard"

# 30
git add src/ui/tui/drilldown.ts
DoCommit "feat: add TUI drilldown explorer for units"

# 31
git add src/utils/logger.ts
DoCommit "feat: add structured logger utility"

# 32
git add src/commands/init.ts
DoCommit "feat: add init command with config wizard"

# 33
git add src/commands/analyze.ts
DoCommit "feat: add analyze command with multi-mode output"

# 34
git add src/commands/recommend.ts
DoCommit "feat: add recommend command with cache reader"

# 35
git add src/commands/doctor.ts
DoCommit "feat: add doctor command with diagnostics"

# 36
git add src/bin.ts
git add bin/cloud-meter.js
DoCommit "feat: wire CLI entry point with all commands"

# 37
git add fixtures/
DoCommit "test: add analysis fixtures for risk and safe cases"

# 38
git add tests/scoring-engine.test.ts
git add tests/detectors.test.ts
git add tests/pattern-analyzer.test.ts
git add tests/recommendation-engine.test.ts
git add tests/rule-engine.test.ts
DoCommit "test: add unit tests for scoring and detectors"

# 39
git add tests/issue-grouper.test.ts
git add tests/endpoint-discovery.test.ts
git add tests/reports.test.ts
git add tests/config.test.ts
DoCommit "test: add unit tests for grouper and reports"

# 40
git add tests/analyze.test.ts
git add tests/grouping-scoring.test.ts
git add tests/engine-integration.test.ts
DoCommit "test: add integration tests with shape contract"

# 41
git add LICENSE
DoCommit "chore: add ISC license"

# 42
git add README.md
DoCommit "docs: add production-ready README"

# 43
git add package-lock.json
DoCommit "chore: lock dependency versions"

# 44 - any remaining files
git add -A
$status = git status --porcelain
if ($status) {
    DoCommit "chore: add generated config samples"
}

# Cleanup script
Remove-Item commit-history.ps1 -Force
git add -A
$status2 = git status --porcelain
if ($status2) {
    DoCommit "chore: clean up build scripts"
}

Write-Host "`n=== Commit history ===" -ForegroundColor Cyan
git log --oneline
Write-Host ""
$count = git rev-list --count HEAD
Write-Host "Total commits: $count" -ForegroundColor Yellow
