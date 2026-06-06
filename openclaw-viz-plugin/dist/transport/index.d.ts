/**
 * 传输层 - 将监控事件发送到可视化后端
 * 包含 Session 级别的 Token 累计统计
 */
import type { PluginLogger, VizTransport } from "../types.js";
export type { VizEvent, VizTransport } from "../types.js";
export interface TransportConfig {
    endpoint: string;
    contentCapture: boolean;
    logger: PluginLogger;
}
export declare function initTransport(config: TransportConfig): VizTransport;
