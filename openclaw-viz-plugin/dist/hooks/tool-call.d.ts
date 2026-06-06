/**
 * 工具调用监控 Hooks
 *
 * 拦截 before_tool_call 和 after_tool_call 事件
 * 记录工具调用的完整生命周期：工具名、参数、结果、耗时、错误等
 * 自动识别文件 I/O 操作（read/write/edit）和网络请求
 */
import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
export declare function registerToolCallHooks(api: OpenClawPluginApi, transport: VizTransport): void;
