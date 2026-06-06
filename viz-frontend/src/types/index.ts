export interface VizEvent {
  type: string;
  timestamp: number;
  sessionId?: string;
  sessionKey?: string;
  runId?: string;
  data: Record<string, unknown>;
}

export interface SessionInfo {
  id: string;
  key?: string;
  startTime: number;
  endTime?: number;
  messageCount: number;
  state: AgentState;
  tokenUsage: TokenUsage;
  events: VizEvent[];
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  callCount: number;
}

export type AgentState = 'idle' | 'thinking' | 'executing' | 'compacting' | 'terminated' | 'unknown';

export interface ToolCallNode {
  id: string;
  toolName: string;
  toolCategory: string;
  params: Record<string, unknown>;
  result?: string;
  durationMs?: number;
  status: 'success' | 'error' | 'pending';
  timestamp: number;
  filePath?: string;
}

export interface ToolCallEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error?: string;
  lastConnected?: number;
}
