import { describe, it, expect } from 'vitest';
import { calculateCost } from '../../src/pricing/calculator.js';
import type { SizedResource } from '../../src/pricing/aws-sizer.js';

describe('Pricing Calculator', () => {
  it('should calculate accurate cost without spikey buffer', () => {
    const resources: SizedResource[] = [
      { type: 'compute', sku: 'fargate-micro', isSpikey: false },
      { type: 'database', sku: 'rds-t4g-micro', isSpikey: false }
    ];

    const result = calculateCost(resources, 'us-east-1');
    
    expect(result.regionUsed).toBe('us-east-1');
    expect(result.isFallback).toBe(false);
    
    // fargate-micro = 7.96, rds-micro = 13.14 => 21.10
    expect(result.totalMonthlyCost).toBe(21.10);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].monthlyCost).toBe(7.96);
    expect(result.items[1].monthlyCost).toBe(13.14);
  });

  it('should apply 20% spikey buffer only to database', () => {
    const resources: SizedResource[] = [
      { type: 'compute', sku: 'fargate-small', isSpikey: true }, // 31.97
      { type: 'database', sku: 'rds-t4g-medium', isSpikey: true } // 49.64 * 1.20 = 59.568 => 59.57
    ];

    const result = calculateCost(resources, 'us-east-1');

    expect(result.items[0].monthlyCost).toBe(31.97);
    expect(result.items[1].monthlyCost).toBe(59.57); 
    expect(result.totalMonthlyCost).toBe(91.54); 
  });

  it('should fallback to us-east-1 if region is unmapped', () => {
    const resources: SizedResource[] = [
      { type: 'compute', sku: 'fargate-micro', isSpikey: false }
    ];

    const result = calculateCost(resources, 'eu-central-1');
    
    expect(result.regionUsed).toBe('us-east-1');
    expect(result.isFallback).toBe(true);
    expect(result.totalMonthlyCost).toBe(7.96);
  });
});
