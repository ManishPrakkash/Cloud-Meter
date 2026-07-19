export interface SkuPricing {
  serviceType: 'compute' | 'database';
  sku: string;
  hourlyRate: number;
  monthlyRate: number; // baseline 730 hours
  description: string;
}

// Statically cached baseline pricing for us-east-1
export const AWS_PRICING_CATALOG: Record<string, Record<string, SkuPricing>> = {
  'us-east-1': {
    // Compute SKUs
    'fargate-micro': {
      serviceType: 'compute',
      sku: 'fargate-micro',
      hourlyRate: 0.0109, // Approx $8/mo
      monthlyRate: 7.96,
      description: 'AWS ECS Fargate (0.25 vCPU, 0.5 GB)'
    },
    'fargate-small': {
      serviceType: 'compute',
      sku: 'fargate-small',
      hourlyRate: 0.0438, // Approx $32/mo
      monthlyRate: 31.97,
      description: 'AWS ECS Fargate (1 vCPU, 2 GB)'
    },
    
    // Database SKUs
    'rds-t4g-micro': {
      serviceType: 'database',
      sku: 'rds-t4g-micro',
      hourlyRate: 0.018, // Approx $13/mo
      monthlyRate: 13.14,
      description: 'AWS RDS Postgres/MySQL (db.t4g.micro)'
    },
    'rds-t4g-medium': {
      serviceType: 'database',
      sku: 'rds-t4g-medium',
      hourlyRate: 0.068, // Approx $50/mo
      monthlyRate: 49.64,
      description: 'AWS RDS Postgres/MySQL (db.t4g.medium)'
    },
    'docdb-t4g-medium': {
      serviceType: 'database',
      sku: 'docdb-t4g-medium',
      hourlyRate: 0.078, // Approx $57/mo
      monthlyRate: 56.94,
      description: 'AWS DocumentDB (db.t4g.medium)'
    }
  }
};

export function getPricing(region: string, sku: string): SkuPricing {
  const regionCatalog = AWS_PRICING_CATALOG[region] || AWS_PRICING_CATALOG['us-east-1'];
  const pricing = regionCatalog[sku];
  if (!pricing) {
    throw new Error(`SKU ${sku} not found in catalog.`);
  }
  return pricing;
}
