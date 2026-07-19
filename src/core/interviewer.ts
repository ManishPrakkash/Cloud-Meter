import { confirm, select, input } from '@inquirer/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { detectTopology } from '../detectors/topology-detector.js';
import type { TopologyResult, WorkloadModel } from '../types.js';

export async function runScaleInterview(targetPath: string): Promise<WorkloadModel> {
  const cachePath = path.resolve(targetPath, '.cloud-meter', 'topology.json');
  let topology: TopologyResult;
  let isTopologyOverridden = false;

  try {
    const raw = await fs.readFile(cachePath, 'utf-8');
    topology = JSON.parse(raw) as TopologyResult;
  } catch (err) {
    // If not cached or parsing fails, detect on the fly
    topology = await detectTopology(targetPath);
    // Cache it for the future
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(topology, null, 2));
  }

  // Ask to confirm topology
  console.log('\n--- Architecture Detection ---');
  console.log(`Detected Framework: ${topology.framework}`);
  console.log(`Detected ORM:       ${topology.orm}`);
  console.log(`Detected Database:  ${topology.database}`);
  console.log(`Confidence Score:   ${topology.confidenceScore}/100\n`);

  const isCorrect = await confirm({
    message: 'Does this architecture look correct?',
    default: true,
  });

  if (!isCorrect) {
    isTopologyOverridden = true;
    topology.framework = await select({
      message: 'Select your actual framework:',
      choices: [
        { value: 'express', name: 'Express.js' },
        { value: 'nextjs', name: 'Next.js' },
        { value: 'nestjs', name: 'NestJS' },
        { value: 'unknown', name: 'Other/Unknown' },
      ],
    });

    topology.orm = await select({
      message: 'Select your actual ORM:',
      choices: [
        { value: 'prisma', name: 'Prisma' },
        { value: 'drizzle', name: 'Drizzle' },
        { value: 'kysely', name: 'Kysely' },
        { value: 'none', name: 'None / Raw SQL' },
      ],
    });

    topology.database = await select({
      message: 'Select your actual Database Engine:',
      choices: [
        { value: 'postgres', name: 'PostgreSQL' },
        { value: 'mysql', name: 'MySQL / MariaDB' },
        { value: 'mongodb', name: 'MongoDB' },
        { value: 'unknown', name: 'Other/Unknown' },
      ],
    });
  }

  console.log('\n--- Scale & Workload Profile ---');
  
  const rawMau = await input({
    message: 'Estimated Monthly Active Users (MAU)?',
    default: '10000',
    validate: (val) => {
      if (isNaN(Number(val)) || Number(val) < 0) return 'Please enter a valid positive number';
      return true;
    }
  });
  const monthlyActiveUsers = Number(rawMau);

  const trafficPattern = await select({
    message: 'How would you describe your traffic pattern?',
    choices: [
      { value: 'steady', name: 'Steady (Consistent predictable traffic)' },
      { value: 'spikey', name: 'Spikey (Sudden bursts, e.g. viral events or sales)' },
    ],
  });

  const deploymentRegion = await input({
    message: 'Primary Deployment Region (e.g. us-east-1)?',
    default: 'us-east-1',
  });

  const workload: WorkloadModel = {
    topology,
    isTopologyOverridden,
    monthlyActiveUsers,
    trafficPattern: trafficPattern as 'steady' | 'spikey',
    deploymentRegion,
  };

  return workload;
}
