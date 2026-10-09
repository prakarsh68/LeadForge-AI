export interface BudgetAllocationPlan {
  totalBudget: number;
  discoveryCap: number;
  signalsCap: number;
  contactResolutionCap: number;
}

export interface BudgetStatusReport {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  isCeilingReached: boolean;
  spentByStage: {
    discovery: number;
    signals: number;
    contacts: number;
  };
  unitCostPerQualified: number;
  wastedSpendOnDuplicates: number;
  costEfficiencyScore: number;
}

export class AdaptiveBudgetManager {
  private totalBudget: number;
  private spent: number = 0;
  private spentByStage = {
    discovery: 0,
    signals: 0,
    contacts: 0,
  };
  private wastedDuplicatesSpend: number = 0;

  constructor(totalBudget: number = 50.0) {
    this.totalBudget = Math.max(1.0, totalBudget);
  }

  public getPlan(): BudgetAllocationPlan {
    return {
      totalBudget: this.totalBudget,
      discoveryCap: Number((this.totalBudget * 0.20).toFixed(2)),
      signalsCap: Number((this.totalBudget * 0.30).toFixed(2)),
      contactResolutionCap: Number((this.totalBudget * 0.50).toFixed(2)),
    };
  }

  public canAfford(estimatedCost: number): boolean {
    return this.spent + estimatedCost <= this.totalBudget;
  }

  public canAffordStage(stage: 'discovery' | 'signals' | 'contacts', estimatedCost: number): boolean {
    if (!this.canAfford(estimatedCost)) return false;

    const plan = this.getPlan();
    if (stage === 'discovery') {
      return this.spentByStage.discovery + estimatedCost <= plan.discoveryCap * 1.5; // Allow mild elasticity
    }
    if (stage === 'signals') {
      return this.spentByStage.signals + estimatedCost <= plan.signalsCap * 1.5;
    }
    return this.spentByStage.contacts + estimatedCost <= plan.contactResolutionCap * 1.5;
  }

  public recordExpenditure(
    stage: 'discovery' | 'signals' | 'contacts',
    amount: number,
    wasDuplicate: boolean = false
  ): void {
    const cost = Math.max(0, amount);
    this.spent = Number((this.spent + cost).toFixed(4));
    this.spentByStage[stage] = Number((this.spentByStage[stage] + cost).toFixed(4));

    if (wasDuplicate) {
      this.wastedDuplicatesSpend = Number((this.wastedDuplicatesSpend + cost).toFixed(4));
    }
  }

  public getStatus(qualifiedCount: number = 0): BudgetStatusReport {
    const remaining = Math.max(0, Number((this.totalBudget - this.spent).toFixed(2)));
    const unitCost = qualifiedCount > 0 ? Number((this.spent / qualifiedCount).toFixed(3)) : 0;

    // Efficiency: 100 minus percentage wasted on duplicates or unspent overhead
    const wastagePct = this.spent > 0 ? (this.wastedDuplicatesSpend / this.spent) * 100 : 0;
    const efficiency = Math.max(0, Math.min(100, Math.round(100 - wastagePct)));

    return {
      totalBudget: this.totalBudget,
      totalSpent: Number(this.spent.toFixed(2)),
      remainingBudget: remaining,
      isCeilingReached: this.spent >= this.totalBudget,
      spentByStage: {
        discovery: Number(this.spentByStage.discovery.toFixed(2)),
        signals: Number(this.spentByStage.signals.toFixed(2)),
        contacts: Number(this.spentByStage.contacts.toFixed(2)),
      },
      unitCostPerQualified: unitCost,
      wastedSpendOnDuplicates: Number(this.wastedDuplicatesSpend.toFixed(2)),
      costEfficiencyScore: efficiency,
    };
  }
}

