/**
 * 会话生命周期监控 Hooks
 *
 * 拦截 session_start 和 session_end 事件
 * 记录会话的开始、结束、持续时间、消息数、结束原因等
 */
import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
export declare function registerSessionHooks(api: OpenClawPluginApi, transport: VizTransport): void;
