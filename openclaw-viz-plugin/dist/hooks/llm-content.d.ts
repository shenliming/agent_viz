/**
 * LLM 内容监控 Hooks
 *
 * 拦截 llm_input 和 llm_output 事件
 * 记录完整的 prompt、system prompt、history messages、assistant 回复、usage 等
 */
import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
export declare function registerLlmContentHooks(api: OpenClawPluginApi, transport: VizTransport): void;
