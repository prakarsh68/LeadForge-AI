import type {
  AgenticToolName,
  AgenticStepStatus,
  ParsedCampaignIntent,
  SignalCategory,
} from '../../../types/index.js';

export type {
  AgenticToolName,
  AgenticStepStatus,
  ParsedCampaignIntent,
  SignalCategory,
};

export interface ToolExecutionContext {
  runId: string;
  stepNumber: number;
  budgetLimit: number;
  currentBudgetSpent: number;
  allowedSourceIds?: string[];
  targetIcpId?: string;
}

export interface ToolExecutionResult {
  toolName: AgenticToolName;
  status: AgenticStepStatus;
  output: Record<string, any>;
  costIncurred: number;
  durationMs: number;
  rationale: string;
  error?: string;
}

export interface IAgenticTool {
  readonly name: AgenticToolName;
  readonly description: string;
  readonly parameterSchema: Record<string, string>;
  execute(input: Record<string, any>, context: ToolExecutionContext): Promise<ToolExecutionResult>;
}

export interface CampaignIntentParseOptions {
  activeIcpId?: string;
  strictBudget?: boolean;
}

export interface FallbackRouteDecision {
  originalSourceId: string;
  fallbackSourceId: string | null;
  reason: 'rate_limited' | 'unconfigured' | 'empty_results' | 'budget_exhausted' | 'unhealthy';
  rationale: string;
}
