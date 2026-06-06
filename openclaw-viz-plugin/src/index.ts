/**
 * Agent Viz Plugin - 可视化监控 OpenClaw Agent 工作过程
 * 
 * 通过 OpenClaw 插件系统的 Hooks 机制，非侵入式地拦截和记录 Agent 的所有行为：
 * - LLM 调用（输入/输出/usage）
 * - 工具调用（参数/结果/耗时）
 * - 上下文压缩（压缩前后对比）
 * - 会话生命周期
 * - 消息收发
 */

import type { OpenClawPluginApi } from "./types.js";
import { registerModelCallHooks } from "./hooks/model-call.js";
import { registerToolCallHooks } from "./hooks/tool-call.js";
import { registerCompactionHooks } from "./hooks/compaction.js";
import { registerSessionHooks } from "./hooks/session.js";
import { registerMessageHooks } from "./hooks/message.js";
import { registerLlmContentHooks } from "./hooks/llm-content.js";
import { registerStateMonitorHooks } from "./hooks/state-monitor.js";
import { initTransport } from "./transport/index.js";

export function register(api: OpenClawPluginApi): void {
  const { config, logger, resolvePath } = api;

  // 读取插件配置（OpenClaw 要求自定义配置放在 config 字段内）
  const pluginEntry = config.plugins?.entries?.["agent-viz"] as Record<string, unknown> | undefined;
  const pluginConfig = (pluginEntry?.config as Record<string, unknown>) ?? {};
  const endpoint = (pluginConfig.endpoint as string) ?? "ws://localhost:9001/ws";
  const contentCapture = (pluginConfig.contentCapture as boolean) ?? true;

  logger.info(`[agent-viz] 初始化可视化插件，端点: ${endpoint}`);

  // 初始化传输层
  const transport = initTransport({
    endpoint,
    contentCapture,
    logger,
  });

  // 注册所有 hooks
  registerModelCallHooks(api, transport);
  registerToolCallHooks(api, transport);
  registerCompactionHooks(api, transport);
  registerSessionHooks(api, transport);
  registerMessageHooks(api, transport);
  registerLlmContentHooks(api, transport);
  registerStateMonitorHooks(api, transport);

  logger.info("[agent-viz] 所有监控 hooks 已注册完成");
}
