import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runScaleInterview } from '../src/core/interviewer.js';
import * as prompts from '@inquirer/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '.temp-interview');

// Mock the prompts so we don't actually wait for user input during tests
vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
  select: vi.fn(),
  input: vi.fn(),
}));

describe('Interviewer', () => {
  beforeEach(async () => {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
  });

  it('should read cached topology and skip overrides if user confirms it is correct', async () => {
    // Setup a fake cached topology
    const cacheDir = path.join(TEMP_DIR, '.cloud-meter');
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, 'topology.json'),
      JSON.stringify({
        framework: 'express',
        orm: 'prisma',
        database: 'postgres',
        confidenceScore: 90
      })
    );

    // Mock user confirming topology is correct
    vi.mocked(prompts.confirm).mockResolvedValueOnce(true);
    // Mock user input for MAU, traffic, region
    vi.mocked(prompts.input).mockResolvedValueOnce('50000');
    vi.mocked(prompts.select).mockResolvedValueOnce('spikey');
    vi.mocked(prompts.input).mockResolvedValueOnce('us-west-2');

    const workload = await runScaleInterview(TEMP_DIR);

    expect(workload.topology.framework).toBe('express');
    expect(workload.isTopologyOverridden).toBe(false);
    expect(workload.monthlyActiveUsers).toBe(50000);
    expect(workload.trafficPattern).toBe('spikey');
    expect(workload.deploymentRegion).toBe('us-west-2');

    expect(prompts.confirm).toHaveBeenCalledTimes(1);
    expect(prompts.input).toHaveBeenCalledTimes(2);
    expect(prompts.select).toHaveBeenCalledTimes(1); // Only for traffic pattern, not for framework/orm/db
  });

  it('should allow user to override topology if they say it is incorrect', async () => {
    // Setup a fake cached topology
    const cacheDir = path.join(TEMP_DIR, '.cloud-meter');
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, 'topology.json'),
      JSON.stringify({
        framework: 'express',
        orm: 'prisma',
        database: 'postgres',
        confidenceScore: 90
      })
    );

    // User says NO (it is not correct)
    vi.mocked(prompts.confirm).mockResolvedValueOnce(false);
    // User selects Next.js, Drizzle, MySQL
    vi.mocked(prompts.select)
      .mockResolvedValueOnce('nextjs') // framework
      .mockResolvedValueOnce('drizzle') // orm
      .mockResolvedValueOnce('mysql') // database
      .mockResolvedValueOnce('steady'); // traffic pattern

    // User inputs
    vi.mocked(prompts.input)
      .mockResolvedValueOnce('1000') // MAU
      .mockResolvedValueOnce('eu-central-1'); // Region

    const workload = await runScaleInterview(TEMP_DIR);

    expect(workload.isTopologyOverridden).toBe(true);
    expect(workload.topology.framework).toBe('nextjs');
    expect(workload.topology.orm).toBe('drizzle');
    expect(workload.topology.database).toBe('mysql');
    expect(workload.monthlyActiveUsers).toBe(1000);
  });
});
