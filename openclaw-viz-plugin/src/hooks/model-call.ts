/**
 * LLM 调用监控 Hooks
 * 
 * 拦截 model_call_started 和 model_call_ended 事件
 * 记录模型调用的完整生命周期：provider、model、耗时、usage、错误等
 */

import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
import type {
  PluginHookModelCallStartedEvent,
  PluginHookModelCallEndedEvent,
  PluginHookAgentContext,
} from "../types.js";

export function registerModelCallHooks(api: OpenClawPluginApi, transport: VizTransport): void {
  const { logger } = api;

  // 模型调用开始
  api.on(
    "model_call_started",
    (event) => {
      const e = event as PluginHookModelCallStartedEvent;
      logger.debug(`[agent-viz] model_call_started: ${e.provider}/${e.model}`);

      transport.send({
        type: "model_call_started",
        timestamp: Date.now(),
        sessionId: e.sessionId,
        sessionKey: e.sessionKey,
        runId: e.runId,
        data: {
          callId: e.callId,
          provider: e.provider,
          model: e.model,
          api: e.api,
          transport: e.transport,
          contextTokenBudget: e.contextTokenBudget,
          contextWindowSource: e.contextWindowSource,
          contextWindowReferenceTokens: e.contextWindowReferenceTokens,
        },
      });
    },
    { priority: 100 },
  );

  // 模型调用结束
  api.on(
    "model_call_ended",
    (event) => {
      const e = event as PluginHookModelCallEndedEvent;
      const outcome = e.outcome === "completed" ? "success" : "error";
      logger.debug(
        `[agent-viz] model_call_ended: ${e.provider}/${e.model} (${outcome}, ${e.durationMs}ms)`,
      );

      transport.send({
        type: "model_call_ended",
        timestamp: Date.now(),
        sessionId: e.sessionId,
        sessionKey: e.sessionKey,
        runId: e.runId,
        data: {
          callId: e.callId,
          provider: e.provider,
          model: e.model,
          outcome: e.outcome,
          durationMs: e.durationMs,
          errorCategory: e.errorCategory,
          failureKind: e.failureKind,
          requestPayloadBytes: e.requestPayloadBytes,
          responseStreamBytes: e.responseStreamBytes,
          timeToFirstByteMs: e.timeToFirstByteMs,
          upstreamRequestIdHash: e.upstreamRequestIdHash,
        },
      });
    },
    { priority: 100 },
  );
}
