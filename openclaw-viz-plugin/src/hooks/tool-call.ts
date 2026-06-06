/**
 * 工具调用监控 Hooks
 * 
 * 拦截 before_tool_call 和 after_tool_call 事件
 * 记录工具调用的完整生命周期：工具名、参数、结果、耗时、错误等
 * 自动识别文件 I/O 操作（read/write/edit）和网络请求
 */

import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
import type {
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookAfterToolCallEvent,
  PluginHookToolContext,
} from "../types.js";

// 工具分类
function classifyTool(toolName: string): string {
  const name = toolName.toLowerCase();
  if (name.includes("read") || name.includes("file_read")) return "file_read";
  if (name.includes("write") || name.includes("file_write")) return "file_write";
  if (name.includes("edit") || name.includes("patch")) return "file_edit";
  if (name.includes("exec") || name.includes("shell") || name.includes("bash")) return "exec";
  if (name.includes("fetch") || name.includes("http") || name.includes("request")) return "network";
  if (name.includes("search")) return "search";
  if (name.includes("memory") || name.includes("recall")) return "memory";
  return "other";
}

// 提取文件路径（从参数中）
function extractFilePath(params: Record<string, unknown>): string | null {
  return (
    (params.path as string) ||
    (params.file_path as string) ||
    (params.filePath as string) ||
    (params.url as string) ||
    null
  );
}

// 截断长文本
function truncateText(text: string, maxLength: number = 500): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + `... (${text.length - maxLength} more chars)`;
}

export function registerToolCallHooks(api: OpenClawPluginApi, transport: VizTransport): void {
  const { logger } = api;

  // 工具调用前
  api.on(
    "before_tool_call",
    (event) => {
      const e = event as PluginHookBeforeToolCallEvent;
      const toolCategory = classifyTool(e.toolName);
      const filePath = extractFilePath(e.params);
      
      logger.debug(`[agent-viz] before_tool_call: ${e.toolName} (${toolCategory})`);

      transport.send({
        type: "before_tool_call",
        timestamp: Date.now(),
        sessionId: e.runId ? undefined : undefined,
        runId: e.runId,
        data: {
          toolName: e.toolName,
          toolCategory: toolCategory,
          toolCallId: e.toolCallId,
          toolKind: e.toolKind,
          toolInputKind: e.toolInputKind,
          params: e.params,
          filePath: filePath,
          derivedPaths: e.derivedPaths,
        },
      });
    },
    { priority: 100 },
  );

  // 工具调用后
  api.on(
    "after_tool_call",
    (event) => {
      const e = event as PluginHookAfterToolCallEvent;
      const status = e.error ? "error" : "success";
      const toolCategory = classifyTool(e.toolName);
      const filePath = extractFilePath(e.params);
      
      // 处理结果内容
      const resultStr = typeof e.result === "string" 
        ? e.result 
        : e.result ? JSON.stringify(e.result).substring(0, 1000) : null;
      
      logger.debug(
        `[agent-viz] after_tool_call: ${e.toolName} (${status}, ${e.durationMs}ms)`,
      );

      transport.send({
        type: "after_tool_call",
        timestamp: Date.now(),
        runId: e.runId,
        data: {
          toolName: e.toolName,
          toolCategory: toolCategory,
          toolCallId: e.toolCallId,
          params: e.params,
          filePath: filePath,
          result: resultStr ? truncateText(resultStr, 1000) : null,
          resultTruncated: resultStr ? resultStr.length > 1000 : false,
          error: e.error,
          durationMs: e.durationMs,
          status: status,
        },
      });
    },
    { priority: 100 },
  );
}
