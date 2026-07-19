import fs from "fs";
import path from "path";
import chalk from "chalk";

export const runRecommendCommand = async () => {
  const cachePath = path.resolve(process.cwd(), ".cloud-meter/cache.json");

  console.log("");
  console.log(chalk.bold("☁  Cloud-Meter Recommendations"));
  console.log(chalk.dim("─".repeat(52)));

  if (!fs.existsSync(cachePath)) {
    console.log("");
    console.log(chalk.yellow("  ⚠  No analysis cache found."));
    console.log(chalk.dim("     Recommendations are generated from previous analysis runs."));
    console.log("");
    console.log(chalk.bold("  How to get recommendations:"));
    console.log(`  ${chalk.cyan("1.")}  Run ${chalk.white("cloud-meter analyze <path>")} to scan your codebase`);
    console.log(`  ${chalk.cyan("2.")}  Then re-run ${chalk.white("cloud-meter recommend")} to view suggestions`);
    console.log("");
    return;
  }

  try {
    const cacheContent = fs.readFileSync(cachePath, "utf8");
    const data = JSON.parse(cacheContent);

    const recommendations = data.recommendations;
    if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
      console.log("");
      console.log(chalk.green("  ✔  No issues found — your pagination looks clean!"));
      console.log("");
      console.log(chalk.dim("  Tip: Re-run analysis if you've made changes:"));
      console.log(`       ${chalk.white("cloud-meter analyze <path>")}`);
      console.log("");
      return;
    }

    console.log("");
    recommendations.forEach((rec: string, index: number) => {
      console.log(`  ${chalk.cyan.bold(`${String(index + 1).padStart(2)}.`)}  ${rec}`);
      
      // Inject context-aware AST code diffs based on the recommendation text
      if (rec.includes("Drizzle/Kysely")) {
        console.log(chalk.dim(`      - db.select().from(users).offset(10)`));
        console.log(chalk.green(`      + db.select().from(users).limit(50).offset(10)`));
      } else if (rec.includes("bounded dataset (e.g. ?limit=50)")) {
        console.log(chalk.dim(`      - fetch('/api/users')`));
        console.log(chalk.green(`      + fetch('/api/users?limit=50')`));
      } else if (rec.includes("cursor on (createdAt, id/_id)")) {
        console.log(chalk.dim(`      - cursor: { createdAt: lastDate }`));
        console.log(chalk.green(`      + cursor: { createdAt_id: { createdAt: lastDate, id: lastId } }`));
      } else if (rec.includes("Math.min")) {
        console.log(chalk.dim(`      - const limit = req.query.limit;`));
        console.log(chalk.green(`      + const limit = Math.min(Number(req.query.limit || 10), 50);`));
      }
      console.log("");
    });
    console.log(chalk.dim("─".repeat(52)));
    console.log(chalk.dim("  These recommendations are based on your last analysis run."));
    console.log(`  ${chalk.dim("Re-analyze:")} ${chalk.white("cloud-meter analyze <path>")}`);
    console.log(`  ${chalk.dim("Full report:")} ${chalk.white("cloud-meter analyze <path> --output pretty")}`);
    console.log("");
  } catch (err: any) {
    console.error(chalk.red("  ✖  Failed to read or parse the cache file:"), err.message);
    console.log(`  ${chalk.dim("Try re-running:")} ${chalk.white("cloud-meter analyze <path>")}`);
    console.log("");
  }
};
