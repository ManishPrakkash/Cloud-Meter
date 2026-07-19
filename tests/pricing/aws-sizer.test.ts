import { describe, it, expect } from 'vitest';
import { determineAWSTopology } from '../../src/pricing/aws-sizer.js';
import type { WorkloadModel, TopologyResult } from '../../src/types.js';

describe('AWS Sizer', () => {
  const baseTopology: TopologyResult = {
    framework: 'express',
    orm: 'prisma',
    database: 'postgres',
    confidenceScore: 100
  };

  it('should pick micro/small SKUs for 5,000 MAU', () => {
    const workload: WorkloadModel = {
      topology: baseTopology,
      isTopologyOverridden: false,
      monthlyActiveUsers: 5000,
      trafficPattern: 'steady',
      deploymentRegion: 'us-east-1'
    };

    const resources = determineAWSTopology(workload);

    expect(resources).toHaveLength(2);
    expect(resources).toContainEqual({
      type: 'compute',
      sku: 'fargate-micro',
      isSpikey: false
    });
    expect(resources).toContainEqual({
      type: 'database',
      sku: 'rds-t4g-micro',
      isSpikey: false
    });
  });

  it('should pick medium SKUs for 50,000 MAU + spikey', () => {
    const workload: WorkloadModel = {
      topology: baseTopology,
      isTopologyOverridden: false,
      monthlyActiveUsers: 50000,
      trafficPattern: 'spikey',
      deploymentRegion: 'us-east-1'
    };

    const resources = determineAWSTopology(workload);

    expect(resources).toHaveLength(2);
    expect(resources).toContainEqual({
      type: 'compute',
      sku: 'fargate-small',
      isSpikey: true
    });
    expect(resources).toContainEqual({
      type: 'database',
      sku: 'rds-t4g-medium',
      isSpikey: true
    });
  });

  it('should use docdb for mongodb', () => {
    const workload: WorkloadModel = {
      topology: { ...baseTopology, database: 'mongodb' },
      isTopologyOverridden: false,
      monthlyActiveUsers: 50000,
      trafficPattern: 'steady',
      deploymentRegion: 'us-east-1'
    };

    const resources = determineAWSTopology(workload);
    const dbResource = resources.find(r => r.type === 'database');
    expect(dbResource?.sku).toBe('docdb-t4g-medium');
  });
});
