import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'url';
import { IaCCompiler } from '../iac/compiler.js';
import type { WorkloadModel } from '../types.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runGenerateCommand(targetPath: string = '.') {
  const absolutePath = path.resolve(process.cwd(), targetPath);
  const cachePath = path.join(absolutePath, '.cloud-meter', 'workload.json');
  const outDir = path.join(absolutePath, 'cloud-meter-out', 'terraform');
  
  // 1. Read Workload
  let workload: WorkloadModel;
  try {
    const raw = await fs.readFile(cachePath, 'utf-8');
    workload = JSON.parse(raw);
  } catch (error) {
    console.error(chalk.red('Error: Workload profile not found. Please run `cloud-meter estimate` first.'));
    process.exit(1);
  }

  // 2. Destructive Change Protection
  if (await fs.pathExists(outDir)) {
    console.log(chalk.yellow(`\n⚠ Warning: Directory already exists at ${outDir}`));
    const proceed = await confirm({
      message: 'Are you sure you want to overwrite the existing Terraform files?',
      default: false
    });
    
    if (!proceed) {
      console.log(chalk.gray('Generation aborted.'));
      return;
    }
  }

  // 3. Compile IaC
  const templatesDir = path.resolve(__dirname, '..', 'iac', 'templates');
  const compiler = new IaCCompiler(templatesDir);
  
  try {
    console.log(chalk.blue('\nGenerating Terraform templates...'));
    await compiler.compile(workload, outDir);
    console.log(chalk.green('✓ Terraform files generated successfully.\n'));

    // Print File Tree
    const files = await fs.readdir(outDir);
    console.log(chalk.cyan('📁 cloud-meter-out/terraform/'));
    files.forEach(f => console.log(chalk.cyan(`  ├── ${f}`)));
    console.log('');
  } catch (error) {
    console.error(chalk.red('Failed to compile IaC templates:'), error);
    process.exit(1);
  }

  // 4. Validate output with Terraform CLI
  try {
    console.log(chalk.blue('Running Terraform validation...'));
    await execAsync('terraform fmt', { cwd: outDir });
    await execAsync('terraform validate', { cwd: outDir });
    console.log(chalk.green('✓ Terraform syntax validated successfully.'));
  } catch (error: any) {
    if (error.code === 127 || error.message.includes('not found') || error.message.includes('is not recognized')) {
      console.log(chalk.yellow('⚠ Terraform CLI not found locally. Skipping syntax validation, but files were generated successfully.'));
    } else {
      console.log(chalk.yellow('⚠ Terraform validate failed, but files were generated. You may need to run `terraform init` first.'));
      // We don't crash, because the files *were* generated.
    }
  }

  console.log(chalk.green.bold('\nNext steps:'));
  console.log(`  cd cloud-meter-out/terraform`);
  console.log(`  terraform init`);
  console.log(`  terraform plan\n`);
}
