#!/usr/bin/env node
/**
 * Release script — syncs version from package.json to bin.ts,
 * then builds and is ready for `npm publish`.
 *
 * Usage:
 *   npm version patch   → 0.1.1 → 0.1.2
 *   npm version minor   → 0.1.2 → 0.2.0
 *   npm version major   → 0.2.0 → 1.0.0
 *
 * The "version" lifecycle hook runs this script automatically.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;

// Sync version into bin.ts
const binPath = "src/bin.ts";
let bin = readFileSync(binPath, "utf8");
bin = bin.replace(
    /\.version\("[^"]+",/,
    `.version("${version}",`
);
writeFileSync(binPath, bin);

// Stage the updated file so npm version commit includes it
execSync("git add src/bin.ts", { stdio: "inherit" });

console.log(`✓ Version synced to ${version} in bin.ts`);
