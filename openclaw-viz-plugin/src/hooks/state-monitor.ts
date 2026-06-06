/**
 * Agent 状态变化监控 Hooks
 * 
 * 基于现有 hooks 推断 Agent 状态变化：
 * - message_received → idle → thinking
 * - model_call_started → thinking
 * - before_tool_call → executing
 * - after_tool_call → thinking (如果还有工具) 或 idle (如果完成)
 * - model_call_ended → idle
 * - session_end → terminated
 */

import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
import { sessionKeyToId, runIdToSessionId, resolveSessionId } from "./session-context.js";

type AgentState = "idle" | "thinking" | "executing" | "compacting" | "terminated";

// 跟踪每个 session 的当前状态
const sessionStates = new Map<string, AgentState>();

function emitStateChange(
  transport: VizTransport,
  sessionId: string | undefined,
  sessionKey: string | undefined,
  runId: string | undefined,
  from: AgentState,
  to: AgentState,
  reason: string,
) {
  const resolvedId = resolveSessionId(sessionId, sessionKey, runId);
  if (!resolvedId) return;

  sessionStates.set(resolvedId, to);

  transport.send({
    type: "agent_state_change",
    timestamp: Date.now(),
    sessionId: resolvedId,
    sessionKey,
    runId,
    data: {
      from,
      to,
      reason,
    },
  });
}

function getCurrentState(sessionId: string | undefined): AgentState {
  if (!sessionId) return "idle";
  return sessionStates.get(sessionId) || "idle";
}

export function registerStateMonitorHooks(api: OpenClawPluginApi, transport: VizTransport): void {
  const { logger } = api;

  // 会话开始 - 建立 sessionKey → sessionId 映射
  api.on(
    "session_start",
    (event) => {
      const e = event as any;
      if (e.sessionId && e.sessionKey) {
        sessionKeyToId.set(e.sessionKey, e.sessionId);
      }
    },
    { priority: 100 },
  );

  // 消息接收 → thinking（通过 sessionKey 查找 sessionId）
  api.on(
    "message_received",
    (event) => {
      const e = event as any;
      const resolvedId = resolveSessionId(undefined, e.sessionKey, undefined);
      const current = getCurrentState(resolvedId);
      if (current !== "thinking") {
        emitStateChange(transport, undefined, e.sessionKey, undefined, current, "thinking", "message_received");
      }
    },
    { priority: 90 },
  );

  // 模型调用开始 → thinking（建立 runId → sessionId 映射）
  api.on(
    "model_call_started",
    (event) => {
      const e = event as any;
      if (e.sessionId) {
        if (e.sessionKey) sessionKeyToId.set(e.sessionKey, e.sessionId);
        if (e.runId) runIdToSessionId.set(e.runId, e.sessionId);
      }
      const current = getCurrentState(e.sessionId);
      if (current !== "thinking") {
        emitStateChange(transport, e.sessionId, e.sessionKey, e.runId, current, "thinking", "model_call_started");
      }
    },
    { priority: 90 },
  );

  // 工具调用前 → executing（通过 runId 查找 sessionId）
  api.on(
    "before_tool_call",
    (event) => {
      const e = event as any;
      emitStateChange(transport, undefined, undefined, e.runId, "thinking", "executing", `tool_call: ${e.toolName}`);
    },
    { priority: 90 },
  );

  // 工具调用后 → thinking (可能还有更多工具)
  api.on(
    "after_tool_call",
    (event) => {
      const e = event as any;
      emitStateChange(transport, undefined, undefined, e.runId, "executing", "thinking", `tool_call_completed: ${e.toolName}`);
    },
    { priority: 90 },
  );

  // 模型调用结束 → idle
  api.on(
    "model_call_ended",
    (event) => {
      const e = event as any;
      if (e.runId && e.sessionId) {
        runIdToSessionId.set(e.runId, e.sessionId);
      }
      const resolvedId = resolveSessionId(e.sessionId, e.sessionKey, e.runId);
      const current = getCurrentState(resolvedId);
      if (e.outcome === "completed" && current !== "idle") {
        emitStateChange(transport, e.sessionId, e.sessionKey, e.runId, current, "idle", "model_call_completed");
      }
    },
    { priority: 90 },
  );

  // 上下文压缩开始 → compacting
  api.on(
    "before_compaction",
    (event) => {
      const e = event as any;
      const resolvedId = resolveSessionId(e.sessionId, e.sessionKey, undefined);
      const sessionId = resolvedId || e.sessionFile || "unknown";
      const current = getCurrentState(sessionId);
      if (current !== "compacting") {
        emitStateChange(transport, sessionId, undefined, undefined, current, "compacting", "compaction_started");
      }
    },
    { priority: 90 },
  );

  // 上下文压缩结束 → idle
  api.on(
    "after_compaction",
    (event) => {
      const e = event as any;
      const resolvedId = resolveSessionId(e.sessionId, e.sessionKey, undefined);
      const sessionId = resolvedId || e.sessionFile || "unknown";
      const current = getCurrentState(sessionId);
      if (current === "compacting") {
        emitStateChange(transport, sessionId, undefined, undefined, current, "idle", "compaction_completed");
      }
    },
    { priority: 90 },
  );

  // 会话结束 → terminated
  api.on(
    "session_end",
    (event) => {
      const e = event as any;
      const current = getCurrentState(e.sessionId);
      if (current !== "terminated") {
        emitStateChange(transport, e.sessionId, e.sessionKey, undefined, current, "terminated", `session_end: ${e.reason}`);
      }
      // 清理状态
      if (e.sessionId) {
        sessionStates.delete(e.sessionId);
        sessionKeyToId.delete(e.sessionKey);
      }
    },
    { priority: 90 },
  );
}
