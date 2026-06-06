/**
 * 消息收发监控 Hooks
 *
 * 拦截 message_received 和 message_sent 事件
 * 记录用户输入和 Agent 输出的消息内容
 */
import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
export declare function registerMessageHooks(api: OpenClawPluginApi, transport: VizTransport): void;
