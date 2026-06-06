/**
 * 上下文压缩监控 Hooks
 *
 * 拦截 before_compaction 和 after_compaction 事件
 * 记录上下文压缩的触发、压缩前后对比、压缩率等
 */
import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
export declare function registerCompactionHooks(api: OpenClawPluginApi, transport: VizTransport): void;
