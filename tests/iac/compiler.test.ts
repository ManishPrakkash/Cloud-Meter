import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IaCCompiler } from '../../src/iac/compiler.js';
import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'url';
import type { WorkloadModel } from '../../src/types.js';
import * as prompts from '@inquirer/prompts';
import { runGenerateCommand } from '../../src/commands/generate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '.temp-iac');

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
}));

describe('IaC Compiler', () => {
  beforeEach(async () => {
    await fs.ensureDir(TEMP_DIR);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.remove(TEMP_DIR);
  });

  it('should compile Fargate and RDS terraform templates accurately', async () => {
    const templatesDir = path.resolve(__dirname, '../../src/iac/templates');
    const compiler = new IaCCompiler(templatesDir);
    
    const workload: WorkloadModel = {
      topology: {
        framework: 'express',
        orm: 'prisma',
        database: 'postgres',
        confidenceScore: 100
      },
      isTopologyOverridden: false,
      monthlyActiveUsers: 5000,
      trafficPattern: 'steady',
      deploymentRegion: 'us-east-1'
    };

    const outDir = path.join(TEMP_DIR, 'out');
    await compiler.compile(workload, outDir);

    const files = await fs.readdir(outDir);
    expect(files).toContain('provider.tf');
    expect(files).toContain('network.tf');
    expect(files).toContain('security.tf');
    expect(files).toContain('outputs.tf');
    expect(files).toContain('compute-fargate.tf');
    expect(files).toContain('db-rds.tf');

    const providerContent = await fs.readFile(path.join(outDir, 'provider.tf'), 'utf-8');
    expect(providerContent).toContain('region = "us-east-1"');
    
    // Check snapshots
    expect(providerContent).toMatchSnapshot();
    
    const securityContent = await fs.readFile(path.join(outDir, 'security.tf'), 'utf-8');
    expect(securityContent).toContain('from_port       = 3000');
    expect(securityContent).toContain('from_port       = 5432');
    expect(securityContent).toMatchSnapshot();
  });

  it('should abort if directory exists and user declines overwrite', async () => {
    // Write fake workload
    const cacheDir = path.join(TEMP_DIR, '.cloud-meter');
    await fs.ensureDir(cacheDir);
    await fs.writeFile(path.join(cacheDir, 'workload.json'), JSON.stringify({
      topology: { framework: 'express', orm: 'none', database: 'postgres' },
      monthlyActiveUsers: 1000,
      trafficPattern: 'steady',
      deploymentRegion: 'us-east-1'
    }));

    // Create fake out dir
    const outDir = path.join(TEMP_DIR, 'cloud-meter-out', 'terraform');
    await fs.ensureDir(outDir);
    await fs.writeFile(path.join(outDir, 'existing.tf'), 'fake content');

    vi.mocked(prompts.confirm).mockResolvedValueOnce(false);

    await runGenerateCommand(TEMP_DIR);

    // Assert that the command prompted and exited without writing new files
    expect(prompts.confirm).toHaveBeenCalledTimes(1);
    
    const outFiles = await fs.readdir(outDir);
    expect(outFiles).toHaveLength(1);
    expect(outFiles).toContain('existing.tf');
  });
});
