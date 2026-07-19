import type { WorkloadModel } from '../types.js';

export interface SizedResource {
  type: 'compute' | 'database';
  sku: string;
  isSpikey: boolean;
}

export function determineAWSTopology(workload: WorkloadModel): SizedResource[] {
  const resources: SizedResource[] = [];
  const { topology, monthlyActiveUsers, trafficPattern } = workload;
  const isHighTraffic = monthlyActiveUsers >= 10000;
  const isSpikey = trafficPattern === 'spikey';

  // 1. Compute Sizing
  if (['express', 'nextjs', 'nestjs'].includes(topology.framework)) {
    // We use Fargate
    resources.push({
      type: 'compute',
      sku: isHighTraffic ? 'fargate-small' : 'fargate-micro',
      isSpikey
    });
  }

  // 2. Database Sizing
  if (topology.database === 'postgres' || topology.database === 'mysql') {
    // We use RDS
    resources.push({
      type: 'database',
      sku: isHighTraffic ? 'rds-t4g-medium' : 'rds-t4g-micro',
      isSpikey
    });
  } else if (topology.database === 'mongodb') {
    // We use DocumentDB
    // DocDB doesn't have a micro instance easily available in all regions in our model, so we default to medium for this MVP if they exceed micro bounds, but let's map it based on instruction: 
    // Instructions: "If MAU < 10,000, map to db.t4g.micro. If MAU >= 10,000 map to db.t4g.medium."
    // We will just map it to docdb-t4g-medium if high traffic, otherwise we can assume the micro one is same price as RDS or we just fallback to medium if micro isn't explicitly defined for DocDB in our catalog.
    // Wait, the catalog instructions said: "Database (RDS/DocDB): Include db.t4g.micro (approx $13/mo) and db.t4g.medium (approx $50/mo)."
    // So we can use the same sku prefix or a dedicated one.
    resources.push({
      type: 'database',
      sku: isHighTraffic ? 'docdb-t4g-medium' : 'rds-t4g-micro', // Re-using rds micro for small docdb to match $13
      isSpikey
    });
  }

  return resources;
}
