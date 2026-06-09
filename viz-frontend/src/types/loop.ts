export interface LoopToolCall {
  id: string;
  name: string;
  arguments: string;
  status?: 'success' | 'error' | string;
  result?: string;
  durationMs?: number;
}

export interface LoopObservation {
  toolCallId: string;
  toolName: string;
  content: string | null;
}

export interface LoopStateChange {
  from: string;
  to: string;
  reason?: string;
  timestamp: number;
}

export interface LoopTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LoopInferred {
  loopType: 'tool_use' | 'direct_answer' | 'error_retry' | 'unknown';
  toolChoiceReason: string | null;
}

export interface Loop {
  id: string;
  loopIndex: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  model: string;
  think: {
    content: string | null;
    hasToolCall: boolean;
  };
  toolCalls: LoopToolCall[];
  observations: LoopObservation[];
  tokenUsage: LoopTokenUsage;
  inferred: LoopInferred;
  stateChanges?: LoopStateChange[];
}

export interface LoopStats {
  totalLoops: number;
  totalDurationMs: number;
  avgDurationMs: number;
  toolUseCount: number;
  directAnswerCount: number;
  errorRetryCount: number;
  totalToolCalls: number;
  totalTokens: number;
}

export interface TokenTrendPoint {
  loopIndex: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  timestamp: number;
  model: string;
}

export interface TokenSummary {
  totalInput: number;
  totalOutput: number;
  total: number;
  avgPerCall: number;
  maxPerCall: number;
  minPerCall: number;
  callCount: number;
}

export interface TokenByModel {
  model: string;
  callCount: number;
  totalTokens: number;
  avgTokens: number;
}

export interface TokenData {
  trend: TokenTrendPoint[];
  summary: TokenSummary;
  byModel: TokenByModel[];
}
