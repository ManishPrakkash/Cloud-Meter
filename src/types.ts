export type PaginationStrategy = "offset" | "cursor" | "none";

export type Severity = "critical" | "high" | "medium" | "low";

export type Layer =
  | "route"
  | "controller"
  | "service"
  | "repository"
  | "model"
  | "sql"
  | "graphql"
  | "utility"
  | "unknown";

export type FindingSource =
  | "ast"
  | "sql"
  | "graphql"
  | "wrapper"
  | "enrichment"
  | "indexer";

export type RiskStatus =
  | "Production Grade"
  | "Good"
  | "Needs Optimization"
  | "High Risk"
  | "Critical";

export type IssueCode =
  | "MISSING_LIMIT"
  | "DEEP_OFFSET"
  | "NO_ORDER_BY"
  | "OFFSET_USED"
  | "NO_PAGE_SIZE_CAP"
  | "UNSTABLE_CURSOR"
  | "MULTIPLICATION_SKIP"
  | "MULTIPLE_UNBOUNDED_ENDPOINTS"
  | "ORDER_BY_WITHOUT_INDEX_HINT"
  | "CONCURRENT_WRITES_RISK"
  | "INCONSISTENT_PAGE_SIZE_CONTROL"
  | "INFINITE_SCROLL_UNSAFE"
  | "POTENTIAL_FULL_COLLECTION_SCAN"
  | "DYNAMIC_SORT_UNSAFE"
  | "UNBOUNDED_FRONTEND_FETCH";

export type ScoreCategory =
  | "Bounds"
  | "Ordering"
  | "CursorStability"
  | "DepthCost"
  | "Consistency"
  | "InputSafety";

export interface Finding {
  /** Stable identifier for dedupe/drilldown (best-effort). */
  id?: string;
  code: IssueCode;
  severity: Severity;
  message: string;
  filePath: string;
  lineRange?: [number, number];
  codeSnippet?: string;
  strategy?: PaginationStrategy;
  rootCause?: string;
  recommendation?: string;
  evidence?: string;
  /** Where this finding came from (detector/analyzer). */
  source?: FindingSource;
  /** 0..1 confidence for heuristic findings (defaults to 1 when omitted). */
  confidence?: number;
  /** Best-effort codebase layer classification for drill-down views. */
  layer?: Layer;
  /** Grouping key for an endpoint/resolver "unit". */
  unitId?: string;
  /** Category used for scoring breakdown views. */
  category?: ScoreCategory;
  /**
   * Optional impact estimate (relative scale). Kept intentionally vague for now;
   * UI uses this to sort within a severity bucket.
   */
  impact?: { perf?: number; correctness?: number; abuseRisk?: number };
}

export interface FileClassification {
  sourceFiles: string[];
  sqlFiles: string[];
  controllers: string[];
  routes: string[];
  services: string[];
  models: string[];
  utils: string[];
}

export interface ScanContext {
  rootPath: string;
  backendRoot: string;
  packageJsonPath?: string;
  tsconfigPath?: string;
  detectedOrm: string[];
}

export interface AnalysisOptions {
  targetPath: string;
  asJson?: boolean;
  verbose?: boolean;
  outputMode?: "pretty" | "json" | "minimal";
  interactive?: boolean;
  /** High-level mode hint for CLI UX: dev | ci | deep. */
  mode?: "dev" | "ci" | "deep";
  /** When true, only print a short summary instead of full report. */
  summaryOnly?: boolean;
}

export interface AggregatedSignals {
  hasOffset: boolean;
  hasCursor: boolean;
  hasAnyPagination: boolean;
  filesWithCap: number;
  filesWithoutCap: number;
  unboundedEndpoints: number;
}

export interface ScoreBreakdown {
  score: number;
  status: RiskStatus;
  deductions: Array<{ code: IssueCode; points: number; reason: string }>;
  /** Category scores (0..100) when available. */
  categories?: Partial<Record<ScoreCategory, number>>;
}

export type UnitKind = "http" | "graphql" | "nest-http" | "nest-graphql" | "function" | "sql" | "unknown";

export interface AnalysisUnit {
  id: string;
  kind: UnitKind;
  /** Display name (route path, resolver name, function name, etc.). */
  name: string;
  /** Entry file/line of the unit when discovered. */
  entry?: { filePath: string; lineRange?: [number, number] };
  /** Best-effort downstream call chain for drilldown. */
  callChain?: Array<{ filePath: string; symbol?: string; line?: number }>;
  /** Files contributing evidence to this unit. */
  files: string[];
  findings: Finding[];
  score: number;
  status: RiskStatus;
  categories?: Partial<Record<ScoreCategory, number>>;
  /** Used to weight project score (e.g., critical endpoints higher). */
  weight?: number;
}

export interface AnalysisMetrics {
  /** Total units discovered (endpoints/resolvers/files). */
  unitsScored?: number;
  /** Units with at least one finding. */
  unitsWithIssues?: number;
  /** Units whose max severity is critical. */
  criticalUnits?: number;
  /** Units whose max severity is high or critical. */
  highUnits?: number;
  /** Units that appear to have hard bounds (no unbounded-limit findings). */
  unitsWithBounds?: number;
  /** Units that use offset-style pagination. */
  offsetUnits?: number;
  /** Units that use cursor/keyset-style pagination. */
  cursorUnits?: number;
  /** Percentage coverage metrics (0..100). */
  boundsCoveragePercent?: number;
  keysetUsagePercent?: number;
  offsetUsagePercent?: number;
  stableOrderCoveragePercent?: number;
  /** Hotspot counts for specific risk patterns. */
  deepOffsetUnits?: number;
  unboundedUnits?: number;
  unsafeSortUnits?: number;
}

export interface TopUnitSummary {
  id: string;
  name: string;
  kind: UnitKind;
  score: number;
  status: RiskStatus;
  /** Max severity across findings for this unit. */
  maxSeverity: Severity | null;
  issueCount: number;
  /** One-line primary risk message for this unit. */
  primaryRisk?: string;
  /** Entry file/line when available (best-effort). */
  entryFile?: string;
  entryLine?: number;
}

export interface RuntimeMetrics {
  /** End-to-end analysis wall time in milliseconds. */
  durationMs: number;
  /** Approximate user CPU time consumed by the analyzer in milliseconds. */
  cpuUserMs: number;
  /** Approximate system CPU time consumed by the analyzer in milliseconds. */
  cpuSystemMs: number;
  /** Difference in resident set size (RSS) in bytes during analysis. */
  memoryDeltaBytes: number;
}

export interface AnalysisResult {
  /** Bumped whenever JSON schema meaningfully changes. */
  schemaVersion?: number;
  project: string;
  backendRoot: string;
  orm: string[];
  detectedStrategy: PaginationStrategy | "mixed";
  score: number;
  status: RiskStatus;
  findings: Finding[];
  issues: string[];
  rootCauses: string[];
  recommendations: string[];
  filesScanned: number;
  /** Unit-level analysis for production drilldown UIs. */
  units?: AnalysisUnit[];
  /** Optional score breakdown for dashboards. */
  breakdown?: {
    categories?: Partial<Record<ScoreCategory, number>>;
    /** Total units discovered (endpoints/resolvers/files). */
    unitsScored?: number;
    /** Units with at least one finding. */
    unitsWithIssues?: number;
    /** Units whose max severity is critical. */
    criticalUnits?: number;
    /** Units whose max severity is high or critical. */
    highUnits?: number;
    /** Units that appear to have hard bounds (no unbounded-limit findings). */
    unitsWithBounds?: number;
    /** Units that use offset-style pagination. */
    offsetUnits?: number;
    /** Units that use cursor/keyset-style pagination. */
    cursorUnits?: number;
    /** Percentage coverage metrics (0..100). */
    boundsCoveragePercent?: number;
    keysetUsagePercent?: number;
    offsetUsagePercent?: number;
    stableOrderCoveragePercent?: number;
    /** Hotspot counts for specific risk patterns. */
    deepOffsetUnits?: number;
    unboundedUnits?: number;
    unsafeSortUnits?: number;
  };
  /** Flattened metrics for dashboards and JSON consumers. */
  metrics?: AnalysisMetrics;
  /** Top N risky units, pre-computed for UIs and JSON. */
  topUnits?: TopUnitSummary[];
  /** Deterministic “do this now” actions derived from hotspots. */
  nextActions?: string[];
  /** Runtime characteristics of the analyzer itself (not your app). */
  runtime?: RuntimeMetrics;
}

export interface UserPreferences {
  defaultPath: string;
  outputMode: "pretty" | "json" | "minimal";
  interactive: boolean;
  maxAllowedSeverity: Severity;
  enforceStrategy?: PaginationStrategy;
  ignorePaths: string[];
}

export interface TopologyResult {
  framework: 'express' | 'nextjs' | 'nestjs' | 'unknown';
  orm: 'prisma' | 'drizzle' | 'kysely' | 'none';
  database: 'postgres' | 'mysql' | 'mongodb' | 'unknown';
  confidenceScore: number; // 0 to 100 based on how many signatures matched
}

