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
export declare function registerStateMonitorHooks(api: OpenClawPluginApi, transport: VizTransport): void;
