import os from "node:os";
import path from "node:path";
import { existsSync, accessSync, constants } from "node:fs";
import Table from "cli-table3";
import chalk from "chalk";
import { loadPreferences } from "../config/index.js";

type CheckStatus = "PASS" | "WARN" | "FAIL";

interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

function statusBadge(status: CheckStatus): string {
  if (status === "PASS") return chalk.green.bold("PASS");
  if (status === "WARN") return chalk.yellow.bold("WARN");
  return chalk.red.bold("FAIL");
}

function parseNodeMajor(): number {
  const [major] = process.versions.node.split(".");
  return Number(major);
}

function checkNodeVersion(): CheckResult {
  const major = parseNodeMajor();
  if (major >= 18) {
    return {
      name: "Node.js",
      status: "PASS",
      detail: `Detected v${process.versions.node}`
    };
  }
  return {
    name: "Node.js",
    status: "FAIL",
    detail: `Detected v${process.versions.node}`,
    fix: "Upgrade to Node.js 18+ (recommended: 20 LTS)."
  };
}

function checkWorkspacePackageJson(cwd: string): CheckResult {
  const pkgPath = path.join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    return { name: "Workspace package.json", status: "PASS", detail: pkgPath };
  }
  return {
    name: "Workspace package.json",
    status: "WARN",
    detail: "No package.json in current directory",
    fix: "Run the command in your project root or provide explicit path: cloud-meter analyze <path>."
  };
}

function checkPathReadable(targetPath: string): CheckResult {
  const resolved = path.resolve(process.cwd(), targetPath);
  try {
    accessSync(resolved, constants.R_OK);
    return { name: "Target path readable", status: "PASS", detail: resolved };
  } catch {
    return {
      name: "Target path readable",
      status: "FAIL",
      detail: resolved,
      fix: "Verify path exists and you have read permissions."
    };
  }
}

function checkDistBuild(cwd: string): CheckResult {
  const cliDist = path.join(cwd, "dist", "cli", "index.js");
  if (existsSync(cliDist)) {
    return { name: "Built CLI artifact", status: "PASS", detail: cliDist };
  }
  return {
    name: "Built CLI artifact",
    status: "WARN",
    detail: "dist/cli/index.js not found",
    fix: "Run npm run build in the package directory."
  };
}

function checkSavedDefaults(): CheckResult {
  try {
    const prefs = loadPreferences();
    return {
      name: "Saved preferences",
      status: "PASS",
      detail: `path=${prefs.defaultPath}, output=${prefs.outputMode}, interactive=${prefs.interactive}`
    };
  } catch {
    return {
      name: "Saved preferences",
      status: "WARN",
      detail: "Could not read user config",
      fix: "Run cloud-meter analyze once and save defaults, or clear local config store."
    };
  }
}

function checkRuntimeInfo(): CheckResult {
  return {
    name: "Runtime",
    status: "PASS",
    detail: `${os.platform()} ${os.release()} | ${os.arch()}`
  };
}

export async function runDoctorCommand(targetPath = "."): Promise<void> {
  const cwd = process.cwd();
  const checks: CheckResult[] = [
    checkNodeVersion(),
    checkRuntimeInfo(),
    checkWorkspacePackageJson(cwd),
    checkPathReadable(targetPath),
    checkDistBuild(cwd),
    checkSavedDefaults()
  ];

  const table = new Table({
    head: [chalk.bold("Check"), chalk.bold("Status"), chalk.bold("Detail")],
    colWidths: [30, 10, 75],
    wordWrap: true,
    style: { head: ["cyan"] }
  });

  for (const check of checks) {
    table.push([check.name, statusBadge(check.status), check.detail]);
  }

  // eslint-disable-next-line no-console
  console.log(chalk.bold("\nCloud-Meter Doctor"));
  // eslint-disable-next-line no-console
  console.log(chalk.dim("─".repeat(60)));
  // eslint-disable-next-line no-console
  console.log(table.toString());

  const fixes = checks.filter((c) => c.fix);
  if (fixes.length > 0) {
    // eslint-disable-next-line no-console
    console.log(chalk.bold("\nSuggested fixes"));
    for (const [i, fix] of fixes.entries()) {
      // eslint-disable-next-line no-console
      console.log(`${chalk.cyan(`${i + 1}.`)} ${fix.fix}`);
    }
  }

  const hasFail = checks.some((c) => c.status === "FAIL");
  if (hasFail) {
    process.exitCode = 1;
  }

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(chalk.bold("What's next?"));
  // eslint-disable-next-line no-console
  console.log(chalk.dim("─".repeat(52)));
  if (hasFail) {
    // eslint-disable-next-line no-console
    console.log(`  ${chalk.cyan("→")}  Fix the failing checks above, then re-run ${chalk.white("cloud-meter doctor")}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`  ${chalk.cyan("→")}  ${chalk.white("cloud-meter analyze <path>")}  ${chalk.dim("— Run full pagination analysis")}`);
    // eslint-disable-next-line no-console
    console.log(`  ${chalk.cyan("→")}  ${chalk.white("cloud-meter init")}           ${chalk.dim("— Set up project-level config defaults")}`);
  }
}
