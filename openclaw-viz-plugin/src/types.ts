/**
 * OpenClaw Plugin API 类型定义
 * 
 * 基于 OpenClaw 源码中的插件 API 接口定义
 */

export interface PluginLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}

export interface OpenClawConfig {
  plugins?: {
    entries?: Record<string, Record<string, unknown>>;
  };
}

export interface PluginHookModelCallStartedEvent {
  runId: string;
  callId: string;
  sessionKey?: string;
  sessionId?: string;
  provider: string;
  model: string;
  api?: string;
  transport?: string;
  contextTokenBudget?: number;
  contextWindowSource?: string;
  contextWindowReferenceTokens?: number;
}

export interface PluginHookModelCallEndedEvent {
  runId: string;
  callId: string;
  sessionKey?: string;
  sessionId?: string;
  provider: string;
  model: string;
  api?: string;
  transport?: string;
  contextTokenBudget?: number;
  contextWindowSource?: string;
  contextWindowReferenceTokens?: number;
  durationMs: number;
  outcome: "completed" | "error";
  errorCategory?: string;
  failureKind?: "aborted" | "connection_closed" | "connection_reset" | "terminated" | "timeout";
  requestPayloadBytes?: number;
  responseStreamBytes?: number;
  timeToFirstByteMs?: number;
  upstreamRequestIdHash?: string;
}

export interface PluginHookLlmInputEvent {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  prompt: string;
  historyMessages: unknown[];
  imagesCount: number;
  tools?: unknown[];
}

export interface PluginHookLlmOutputEvent {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  contextTokenBudget?: number;
  contextWindowSource?: string;
  contextWindowReferenceTokens?: number;
  resolvedRef?: string;
  harnessId?: string;
  prompt?: string;
  assistantTexts: string[];
  lastAssistant?: unknown;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
}

export interface PluginHookBeforeToolCallEvent {
  toolName: string;
  params: Record<string, unknown>;
  toolKind?: string;
  toolInputKind?: string;
  runId?: string;
  toolCallId?: string;
  derivedPaths?: readonly string[];
}

export interface PluginHookBeforeToolCallResult {
  params?: Record<string, unknown>;
  block?: boolean;
  blockReason?: string;
  requireApproval?: {
    title: string;
    description: string;
    severity?: "info" | "warning" | "critical";
    timeoutMs?: number;
    timeoutBehavior?: "allow" | "deny";
    allowedDecisions?: Array<"allow-once" | "allow-always" | "deny">;
    pluginId?: string;
    onResolution?: (decision: string) => Promise<void> | void;
  };
}

export interface PluginHookAfterToolCallEvent {
  toolName: string;
  params: Record<string, unknown>;
  runId?: string;
  toolCallId?: string;
  result?: unknown;
  error?: string;
  durationMs?: number;
}

export interface PluginHookBeforeCompactionEvent {
  messageCount: number;
  compactingCount?: number;
  tokenCount?: number;
  messages?: unknown[];
  sessionFile?: string;
}

export interface PluginHookAfterCompactionEvent {
  messageCount: number;
  tokenCount?: number;
  compactedCount: number;
  sessionFile?: string;
}

export interface PluginHookSessionStartEvent {
  sessionId: string;
  sessionKey?: string;
  resumedFrom?: string;
}

export interface PluginHookSessionEndEvent {
  sessionId: string;
  sessionKey?: string;
  messageCount: number;
  durationMs?: number;
  reason?: string;
  sessionFile?: string;
  transcriptArchived?: boolean;
  nextSessionId?: string;
  nextSessionKey?: string;
}

export interface PluginHookMessageReceivedEvent {
  channel?: string;
  sessionKey?: string;
  senderId?: string;
  content: string;
  timestamp?: number;
}

export interface PluginHookMessageSentEvent {
  channel?: string;
  sessionKey?: string;
  content: string;
  timestamp?: number;
}

export interface PluginHookAgentContext {
  runId?: string;
  jobId?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  workspaceDir?: string;
  modelProviderId?: string;
  modelId?: string;
  messageProvider?: string;
  trigger?: string;
  channelId?: string;
  contextTokenBudget?: number;
  contextWindowSource?: string;
  contextWindowReferenceTokens?: number;
}

export interface PluginHookToolContext {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  toolName: string;
  toolKind?: string;
  toolInputKind?: string;
  toolCallId?: string;
  channelId?: string;
  getSessionExtension?: (namespace: string) => unknown;
}

export interface PluginHookMessageContext {
  channel?: string;
  sessionKey?: string;
  senderId?: string;
}

export type PluginHookName =
  | "model_call_started"
  | "model_call_ended"
  | "llm_input"
  | "llm_output"
  | "before_tool_call"
  | "after_tool_call"
  | "before_compaction"
  | "after_compaction"
  | "session_start"
  | "session_end"
  | "message_received"
  | "message_sent";

export interface OpenClawPluginHookOptions {
  priority?: number;
  timeoutMs?: number;
}

export interface VizEvent {
  type: string;
  timestamp: number;
  sessionId?: string;
  sessionKey?: string;
  runId?: string;
  data: unknown;
}

export interface VizTransport {
  send(event: VizEvent): void;
  close(): void;
}

export interface OpenClawPluginApi {
  config: OpenClawConfig;
  logger: PluginLogger;
  resolvePath: (input: string) => string;
  registrationMode: "sync" | "async";
  registerHook: (
    events: string | string[],
    handler: (event: any, ctx: any) => Promise<any> | any,
    opts?: OpenClawPluginHookOptions,
  ) => void;
  on: <K extends PluginHookName>(
    hookName: K,
    handler: (event: any) => void,
    opts?: OpenClawPluginHookOptions,
  ) => void;
}
