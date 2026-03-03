import path from "node:path";
import { SyntaxKind, Node, type Project, type SourceFile, type Identifier } from "ts-morph";

export interface CallChainNode {
  filePath: string;
  symbol?: string;
  line?: number;
}

export interface CallChainOptions {
  project: Project;
  entry: { filePath: string; symbol: string };
  maxDepth?: number;
  maxNodes?: number;
}

function normalize(p: string): string {
  return p.replace(/\\/g, "/");
}

function getSourceFile(project: Project, filePath: string): SourceFile | undefined {
  const normalized = normalize(path.resolve(filePath));
  return project.getSourceFiles().find((sf) => normalize(sf.getFilePath()) === normalized);
}

function findTopLevelSymbol(sf: SourceFile, symbol: string): Node | undefined {
  const fn = sf.getFunction(symbol);
  if (fn) return fn;

  const varDecl = sf.getVariableDeclaration(symbol);
  if (varDecl) return varDecl;

  const cls = sf.getClass(symbol);
  if (cls) return cls;

  // Best-effort: resolve imported symbols (e.g., routes file imports controller handler).
  const id = sf.getDescendantsOfKind(SyntaxKind.Identifier).find((i) => i.getText() === symbol);
  const sym = id?.getSymbol();
  const aliased = sym?.getAliasedSymbol?.() ?? sym;
  const decl = aliased?.getDeclarations?.()[0];
  if (decl) return decl;

  return undefined;
}

function collectDirectCalls(node: Node): Identifier[] {
  const out: Identifier[] = [];
  const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.Identifier) {
      out.push(expr as unknown as Identifier);
    }
  }
  return out;
}

function resolveIdentifierToDeclaration(id: Identifier): Node | undefined {
  const symbol = id.getSymbol();
  const decls = symbol?.getDeclarations() ?? [];
  return decls[0];
}

export function buildCallChain(options: CallChainOptions): CallChainNode[] {
  const maxDepth = options.maxDepth ?? 5;
  const maxNodes = options.maxNodes ?? 20;

  const chain: CallChainNode[] = [];
  const visited = new Set<string>();

  let currentFile = getSourceFile(options.project, options.entry.filePath);
  if (!currentFile) return chain;

  const startNode = findTopLevelSymbol(currentFile, options.entry.symbol);
  if (!startNode) return chain;
  let currentNode: Node = startNode;

  for (let depth = 0; depth < maxDepth && chain.length < maxNodes; depth++) {
    const sf: SourceFile = currentNode.getSourceFile();
    const loc: number | undefined = currentNode.getStartLineNumber?.() ?? undefined;
    const filePath: string = sf.getFilePath();
    const symbol: string | undefined = (currentNode as any).getName?.() ?? options.entry.symbol;

    const key = `${filePath}::${symbol}::${loc ?? 0}`;
    if (visited.has(key)) break;
    visited.add(key);

    chain.push({ filePath, symbol, line: loc });

    const calls = collectDirectCalls(currentNode);
    const decls = calls
      .map(resolveIdentifierToDeclaration)
      .filter((d): d is Node => Boolean(d));

    const crossFile = decls.find((d) => d.getSourceFile().getFilePath() !== sf.getFilePath());
    const chosen = crossFile ?? decls[0];
    if (!chosen) break;

    currentNode = chosen;
  }

  return chain;
}

