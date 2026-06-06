/**
 * LLM 内容监控 Hooks
 * 
 * 拦截 llm_input 和 llm_output 事件
 * 记录完整的 prompt、system prompt、history messages、assistant 回复、usage 等
 */

import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
import type {
  PluginHookLlmInputEvent,
  PluginHookLlmOutputEvent,
} from "../types.js";

// 简单的 token 估算（1 token ≈ 4 chars for English, 1.5 chars for Chinese）
function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

export function registerLlmContentHooks(api: OpenClawPluginApi, transport: VizTransport): void {
  const { logger } = api;

  // LLM 输入
  api.on(
    "llm_input",
    (event) => {
      const e = event as PluginHookLlmInputEvent;
      logger.debug(`[agent-viz] llm_input: ${e.provider}/${e.model}`);

      // 提取 thinking/reasoning 内容
      const thinkingMessages = e.historyMessages
        .filter((msg: any) => msg.role === "assistant" && msg.thinking)
        .map((msg: any) => ({
          role: msg.role,
          thinking: msg.thinking,
          timestamp: msg.timestamp,
        }));

      // 估算历史消息的 token 数
      const historyText = e.historyMessages
        .map((m: any) => typeof m.content === "string" ? m.content : JSON.stringify(m.content || ""))
        .join("\n");
      const estimatedHistoryTokens = estimateTokens(historyText);

      transport.send({
        type: "llm_input",
        timestamp: Date.now(),
        sessionId: e.sessionId,
        runId: e.runId,
        data: {
          provider: e.provider,
          model: e.model,
          systemPrompt: e.systemPrompt,
          prompt: e.prompt,
          historyMessages: e.historyMessages,
          thinkingMessages: thinkingMessages,
          imagesCount: e.imagesCount,
          tools: e.tools,
          historyMessageCount: e.historyMessages.length,
          estimatedHistoryTokens: estimatedHistoryTokens,
        },
      });
    },
    { priority: 100 },
  );

  // LLM 输出
  api.on(
    "llm_output",
    (event) => {
      const e = event as PluginHookLlmOutputEvent;
      logger.debug(`[agent-viz] llm_output: ${e.provider}/${e.model}`);

      // 提取所有 assistant 文本
      const assistantTexts = Array.isArray(e.assistantTexts) ? e.assistantTexts : [];
      const fullAssistantText = assistantTexts.join("\n");

      // 提取 thinking/reasoning 内容（如果有）
      const lastAssistant = e.lastAssistant as any;
      const thinkingContent = lastAssistant?.thinking || null;

      transport.send({
        type: "llm_output",
        timestamp: Date.now(),
        sessionId: e.sessionId,
        runId: e.runId,
        data: {
          provider: e.provider,
          model: e.model,
          resolvedRef: e.resolvedRef,
          harnessId: e.harnessId,
          prompt: e.prompt,
          assistantTexts: e.assistantTexts,
          fullAssistantText: fullAssistantText,
          lastAssistant: e.lastAssistant,
          thinkingContent: thinkingContent,
          usage: e.usage,
          contextTokenBudget: e.contextTokenBudget,
          contextWindowSource: e.contextWindowSource,
          contextWindowReferenceTokens: e.contextWindowReferenceTokens,
        },
      });
    },
    { priority: 100 },
  );
}
