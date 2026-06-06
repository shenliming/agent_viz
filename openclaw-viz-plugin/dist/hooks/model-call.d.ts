/**
 * LLM 调用监控 Hooks
 *
 * 拦截 model_call_started 和 model_call_ended 事件
 * 记录模型调用的完整生命周期：provider、model、耗时、usage、错误等
 */
import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
export declare function registerModelCallHooks(api: OpenClawPluginApi, transport: VizTransport): void;
