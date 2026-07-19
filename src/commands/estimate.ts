import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { runScaleInterview } from "../core/interviewer.js";
import { determineAWSTopology } from "../pricing/aws-sizer.js";
import { calculateCost } from "../pricing/calculator.js";

export async function runEstimateCommand(targetPath: string = ".") {
  const absolutePath = path.resolve(process.cwd(), targetPath);

  console.log(chalk.blue.bold("\n🚀 Cloud-Meter Infrastructure Estimator"));
  console.log(chalk.gray(`Target: ${absolutePath}\n`));

  try {
    const workload = await runScaleInterview(absolutePath);

    // Run Sizing & Pricing
    const resources = determineAWSTopology(workload);
    const pricingResult = calculateCost(resources, workload.deploymentRegion);

    console.log(chalk.green.bold("\n✓ Workload Profile & AWS Architecture Captured\n"));

    if (pricingResult.isFallback) {
      console.log(chalk.yellow(`⚠ Specific region pricing not cached for '${workload.deploymentRegion}'; falling back to us-east-1 baseline.\n`));
    }

    const table = new Table({
      head: [chalk.cyan("Component"), chalk.cyan("AWS SKU"), chalk.cyan("Est. Monthly Cost")],
      colWidths: [15, 45, 20],
      style: { head: [], border: ["gray"] }
    });

    for (let i = 0; i < resources.length; i++) {
      const res = resources[i];
      const costItem = pricingResult.items[i];
      const typeLabel = res.type === 'compute' ? '[ Compute ]' : '[ Database ]';
      table.push([
        typeLabel, 
        costItem.description, 
        `$${costItem.monthlyCost.toFixed(2)} / mo`
      ]);
    }

    // Add total row
    table.push([
      chalk.bold("TOTAL"), 
      "", 
      chalk.green.bold(`$${pricingResult.totalMonthlyCost.toFixed(2)} / mo`)
    ]);

    console.log(table.toString());
    console.log(chalk.gray("\n* Note: This is a static baseline estimate. Actual costs will vary based on exact data transfer, storage growth, and AWS pricing updates.\n"));

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
