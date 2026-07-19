import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { runScaleInterview } from "../core/interviewer.js";

export async function runEstimateCommand(targetPath: string = ".") {
  const absolutePath = path.resolve(process.cwd(), targetPath);

  console.log(chalk.blue.bold("\n🚀 Cloud-Meter Infrastructure Estimator"));
  console.log(chalk.gray(`Target: ${absolutePath}\n`));

  try {
    const workload = await runScaleInterview(absolutePath);

    // Beautiful Table Output
    console.log(chalk.green.bold("\n✓ Workload Profile Captured Successfully\n"));

    const table = new Table({
      head: [chalk.cyan("Property"), chalk.cyan("Value")],
      colWidths: [30, 40],
      style: { head: [], border: ["gray"] }
    });

    table.push(
      ["Framework", workload.topology.framework],
      ["ORM", workload.topology.orm],
      ["Database", workload.topology.database],
      ["Topology Confirmed By User", workload.isTopologyOverridden ? chalk.yellow("No (Overridden)") : chalk.green("Yes")],
      ["Monthly Active Users", workload.monthlyActiveUsers.toLocaleString()],
      ["Traffic Pattern", workload.trafficPattern],
      ["Deployment Region", workload.deploymentRegion]
    );

    console.log(table.toString());
    console.log("");

    // Cache the result
    const cacheDir = path.join(absolutePath, ".cloud-meter");
    const cachePath = path.join(cacheDir, "workload.json");
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(workload, null, 2));

    console.log(chalk.gray(`💾 Workload model saved to ${cachePath}\n`));
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log(chalk.yellow("\nInterview cancelled by user."));
    } else {
      console.error(chalk.red("\nAn error occurred during the interview:"), error);
    }
  }
}
