/**
 * 上下文压缩监控 Hooks
 * 
 * 拦截 before_compaction 和 after_compaction 事件
 * 记录上下文压缩的触发、压缩前后对比、压缩率等
 */

import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
import type {
  PluginHookBeforeCompactionEvent,
  PluginHookAfterCompactionEvent,
} from "../types.js";

export function registerCompactionHooks(api: OpenClawPluginApi, transport: VizTransport): void {
  const { logger } = api;

  // 压缩前
  api.on(
    "before_compaction",
    (event) => {
      const e = event as PluginHookBeforeCompactionEvent;
      logger.info(
        `[agent-viz] before_compaction: ${e.messageCount} messages, ${e.tokenCount} tokens`,
      );

      transport.send({
        type: "before_compaction",
        timestamp: Date.now(),
        data: {
          messageCount: e.messageCount,
          compactingCount: e.compactingCount,
          tokenCount: e.tokenCount,
          sessionFile: e.sessionFile,
        },
      });
    },
    { priority: 100 },
  );

  // 压缩后
  api.on(
    "after_compaction",
    (event) => {
      const e = event as PluginHookAfterCompactionEvent;
      logger.info(
        `[agent-viz] after_compaction: ${e.messageCount} messages, ${e.tokenCount} tokens, compacted ${e.compactedCount}`,
      );

      transport.send({
        type: "after_compaction",
        timestamp: Date.now(),
        data: {
          messageCount: e.messageCount,
          tokenCount: e.tokenCount,
          compactedCount: e.compactedCount,
          sessionFile: e.sessionFile,
        },
      });
    },
    { priority: 100 },
  );
}
