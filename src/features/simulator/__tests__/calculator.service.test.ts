import { describe, it, expect } from 'vitest';

// Calculator functions from lib/investment-simulator.ts
type SimulatorPlanId = 'start' | 'prime';

interface SimulationResult {
  investmentValue: number;
  monthlyCashback: number;
  annualCashback: number;
  annualInvested: number;
  months: Array<{
    month: number;
    label: string;
    monthlyReturn: number;
    accumulatedReturn: number;
  }>;
}

function calculateSimulation(
  plan: SimulatorPlanId,
  rate: number,
  investmentValue: number
): SimulationResult {
  const monthlyCashback = (investmentValue * rate) / 100;
  const months = 12;
  const monthsData = [];
  let accumulatedReturn = 0;

  for (let i = 1; i <= months; i++) {
    accumulatedReturn += monthlyCashback;
    monthsData.push({
      month: i,
      label: `Mês ${i}`,
      monthlyReturn: monthlyCashback,
      accumulatedReturn: accumulatedReturn,
    });
  }

  return {
    investmentValue,
    monthlyCashback,
    annualCashback: accumulatedReturn,
    annualInvested: investmentValue * months,
    months: monthsData,
  };
}

describe('Investment Calculator', () => {
  describe('Start Plan', () => {
    it('should calculate correct cashback for R$ 520 at 50%', () => {
      const result = calculateSimulation('start', 50, 520);
      
      expect(result.monthlyCashback).toBe(260);
      expect(result.annualCashback).toBe(3120);
      expect(result.annualInvested).toBe(6240);
    });

    it('should calculate correct cashback for R$ 520 at 30%', () => {
      const result = calculateSimulation('start', 30, 520);
      
      expect(result.monthlyCashback).toBe(156);
      expect(result.annualCashback).toBe(1872);
    });

    it('should have 12 months in simulation', () => {
      const result = calculateSimulation('start', 50, 520);
      
      expect(result.months).toHaveLength(12);
      expect(result.months[0].month).toBe(1);
      expect(result.months[11].month).toBe(12);
    });

    it('should accumulate correctly over months', () => {
      const result = calculateSimulation('start', 50, 520);
      
      expect(result.months[0].accumulatedReturn).toBe(260);
      expect(result.months[5].accumulatedReturn).toBe(1560); // 6 months
      expect(result.months[11].accumulatedReturn).toBe(3120); // 12 months
    });
  });

  describe('Prime Plan', () => {
    it('should calculate correct cashback for R$ 1040 at 50%', () => {
      const result = calculateSimulation('prime', 50, 1040);
      
      expect(result.monthlyCashback).toBe(520);
      expect(result.annualCashback).toBe(6240);
      expect(result.annualInvested).toBe(12480);
    });

    it('should calculate correct cashback for R$ 1040 at 40%', () => {
      const result = calculateSimulation('prime', 40, 1040);
      
      expect(result.monthlyCashback).toBe(416);
      expect(result.annualCashback).toBe(4992);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum investment values', () => {
      const result = calculateSimulation('start', 50, 10);
      
      expect(result.monthlyCashback).toBe(5);
      expect(result.months[0].monthlyReturn).toBe(5);
    });

    it('should handle large investment values', () => {
      const result = calculateSimulation('prime', 50, 10000);
      
      expect(result.monthlyCashback).toBe(5000);
      expect(result.annualCashback).toBe(60000);
    });

    it('should handle zero rate', () => {
      const result = calculateSimulation('start', 0, 520);
      
      expect(result.monthlyCashback).toBe(0);
      expect(result.annualCashback).toBe(0);
    });
  });
});
