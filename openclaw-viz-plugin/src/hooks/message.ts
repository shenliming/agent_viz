/**
 * 消息收发监控 Hooks
 * 
 * 拦截 message_received 和 message_sent 事件
 * 记录用户输入和 Agent 输出的消息内容
 */

import type { OpenClawPluginApi } from "../types.js";
import type { VizTransport } from "../transport/index.js";
import type {
  PluginHookMessageReceivedEvent,
  PluginHookMessageSentEvent,
} from "../types.js";

// 跟踪当前活跃的 sessionId（从 session_start 获取）
let currentSessionId: string | undefined;

export function registerMessageHooks(api: OpenClawPluginApi, transport: VizTransport): void {
  const { logger } = api;

  // 监听 session_start 以获取当前 sessionId
  api.on("session_start", (event) => {
    currentSessionId = (event as any).sessionId;
  });

  // 监听 session_end 以清除 sessionId
  api.on("session_end", () => {
    currentSessionId = undefined;
  });

  // 消息接收
  api.on(
    "message_received",
    (event) => {
      const e = event as PluginHookMessageReceivedEvent;
      logger.debug(`[agent-viz] message_received: ${e.channel} from ${e.senderId}`);

      transport.send({
        type: "message_received",
        timestamp: Date.now(),
        sessionId: currentSessionId,
        sessionKey: e.sessionKey,
        data: {
          channel: e.channel,
          sessionKey: e.sessionKey,
          senderId: e.senderId,
          content: e.content,
          timestamp: e.timestamp,
        },
      });
    },
    { priority: 100 },
  );

  // 消息发送
  api.on(
    "message_sent",
    (event) => {
      const e = event as PluginHookMessageSentEvent;
      logger.debug(`[agent-viz] message_sent: ${e.channel}`);

      transport.send({
        type: "message_sent",
        timestamp: Date.now(),
        sessionId: currentSessionId,
        sessionKey: e.sessionKey,
        data: {
          channel: e.channel,
          sessionKey: e.sessionKey,
          content: e.content,
          timestamp: e.timestamp,
        },
      });
    },
    { priority: 100 },
  );
}
