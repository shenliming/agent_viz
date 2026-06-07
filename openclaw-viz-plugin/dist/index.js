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
import { registerModelCallHooks } from "./hooks/model-call.js";
import { registerToolCallHooks } from "./hooks/tool-call.js";
import { registerCompactionHooks } from "./hooks/compaction.js";
import { registerSessionHooks } from "./hooks/session.js";
import { registerMessageHooks } from "./hooks/message.js";
import { registerLlmContentHooks } from "./hooks/llm-content.js";
import { registerStateMonitorHooks } from "./hooks/state-monitor.js";
import { initTransport } from "./transport/index.js";
export function register(api) {
    const { config, logger, resolvePath } = api;
    // 读取插件配置（OpenClaw 要求自定义配置放在 config 字段内）
    const pluginEntry = config.plugins?.entries?.["agent-viz"];
    const pluginConfig = pluginEntry?.config ?? {};
    const endpoint = pluginConfig.endpoint ?? "ws://localhost:9001/ws";
    const contentCapture = pluginConfig.contentCapture ?? true;
    const monitors = pluginConfig.monitors ?? {};
    // 监控项开关（默认全部启用）
    const isEnabled = (key) => monitors[key] !== false;
    logger.info(`[agent-viz] 初始化可视化插件，端点: ${endpoint}`);
    // 初始化传输层
    const transport = initTransport({
        endpoint,
        contentCapture,
        logger,
    });
    // 注册所有 hooks（根据 monitors 配置开关）
    if (isEnabled("llmCalls")) {
        registerModelCallHooks(api, transport);
    }
    if (isEnabled("toolCalls")) {
        registerToolCallHooks(api, transport);
    }
    if (isEnabled("compaction")) {
        registerCompactionHooks(api, transport);
    }
    if (isEnabled("sessionLifecycle")) {
        registerSessionHooks(api, transport);
    }
    if (isEnabled("messageReceived") || isEnabled("messageSent")) {
        registerMessageHooks(api, transport);
    }
    if (isEnabled("llmContent")) {
        registerLlmContentHooks(api, transport);
    }
    if (isEnabled("stateChanges")) {
        registerStateMonitorHooks(api, transport);
    }
    logger.info("[agent-viz] 所有监控 hooks 已注册完成");
}
//# sourceMappingURL=index.js.map