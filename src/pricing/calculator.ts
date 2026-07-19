import { AWS_PRICING_CATALOG, getPricing } from './catalog.js';
import type { SizedResource } from './aws-sizer.js';

export interface CalculatedCost {
  description: string;
  monthlyCost: number;
}

export interface PricingResult {
  items: CalculatedCost[];
  totalMonthlyCost: number;
  regionUsed: string;
  isFallback: boolean;
}

export function calculateCost(resources: SizedResource[], requestedRegion: string): PricingResult {
  let regionUsed = requestedRegion;
  let isFallback = false;

  // Check if region exists in catalog
  if (!AWS_PRICING_CATALOG[requestedRegion]) {
    regionUsed = 'us-east-1';
    isFallback = true;
  }

  const items: CalculatedCost[] = [];
  let totalMonthlyCost = 0;

  for (const resource of resources) {
    const pricing = getPricing(regionUsed, resource.sku);
    let cost = pricing.monthlyRate; // 730 hours baseline

    // If it's a database and traffic is spikey, add 20% buffer
    if (resource.type === 'database' && resource.isSpikey) {
      cost = cost * 1.20;
    }

    // Convert to cents to avoid JS floating point math issues, then back to dollars
    cost = Math.round(cost * 100) / 100;

    items.push({
      description: pricing.description,
      monthlyCost: cost
    });

    totalMonthlyCost += cost;
  }

  totalMonthlyCost = Math.round(totalMonthlyCost * 100) / 100;

  return {
    items,
    totalMonthlyCost,
    regionUsed,
    isFallback
  };
}
