import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectTopology } from '../src/detectors/topology-detector.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '.temp-topology-test');

describe('Topology Detector', () => {
  beforeEach(async () => {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
  });

  it('should detect Express, Prisma, and Postgres from basic files', async () => {
    await fs.writeFile(
      path.join(TEMP_DIR, 'app.ts'),
      `
      import express from 'express';
      const app = express();
      import { PrismaClient } from '@prisma/client';
      const prisma = new PrismaClient();
      `
    );
    await fs.writeFile(
      path.join(TEMP_DIR, '.env'),
      `DATABASE_URL=postgresql://user:pass@localhost:5432/mydb`
    );

    const result = await detectTopology(TEMP_DIR);
    expect(result.framework).toBe('express');
    expect(result.orm).toBe('prisma');
    expect(result.database).toBe('postgres');
    expect(result.confidenceScore).toBeGreaterThan(0);
  });

  it('should detect Next.js and Drizzle', async () => {
    const apiDir = path.join(TEMP_DIR, 'app', 'api');
    await fs.mkdir(apiDir, { recursive: true });
    
    await fs.writeFile(
      path.join(TEMP_DIR, 'package.json'),
      JSON.stringify({ dependencies: { next: "14", "drizzle-orm": "0.30" } })
    );

    const result = await detectTopology(TEMP_DIR);
    expect(result.framework).toBe('nextjs');
    expect(result.orm).toBe('drizzle');
  });

  it('should ignore node_modules and not crash on invalid AST', async () => {
    const nmDir = path.join(TEMP_DIR, 'node_modules');
    await fs.mkdir(nmDir, { recursive: true });
    await fs.writeFile(
      path.join(nmDir, 'fake.ts'),
      `import express from 'express';`
    );
    await fs.writeFile(
      path.join(TEMP_DIR, 'broken.ts'),
      `const const this is broken code;`
    );

    const result = await detectTopology(TEMP_DIR);
    expect(result.framework).toBe('unknown'); // Did not parse fake.ts because it's in node_modules
    expect(result.orm).toBe('none');
  });

  it('should detect MongoDB from env file', async () => {
    await fs.writeFile(
      path.join(TEMP_DIR, '.env.local'),
      `MONGO_URL=mongodb+srv://test:test@cluster.mongodb.net/test`
    );

    const result = await detectTopology(TEMP_DIR);
    expect(result.database).toBe('mongodb');
  });
});
