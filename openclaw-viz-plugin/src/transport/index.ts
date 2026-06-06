/**
 * 传输层 - 将监控事件发送到可视化后端
 * 包含 Session 级别的 Token 累计统计
 */

import type { PluginLogger, VizEvent, VizTransport } from "../types.js";

export type { VizEvent, VizTransport } from "../types.js";

export interface TransportConfig {
  endpoint: string;
  contentCapture: boolean;
  logger: PluginLogger;
}

// Token 累计统计
interface TokenStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  callCount: number;
}

const eventQueue: VizEvent[] = [];
let isConnecting = false;
let ws: WebSocket | null = null;

// Session 级别的 Token 累计
const sessionTokenStats = new Map<string, TokenStats>();

function getTokenStats(sessionId: string): TokenStats {
  if (!sessionTokenStats.has(sessionId)) {
    sessionTokenStats.set(sessionId, {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
      callCount: 0,
    });
  }
  return sessionTokenStats.get(sessionId)!;
}

function updateTokenStats(sessionId: string, usage: any): TokenStats | null {
  if (!usage || !sessionId) return null;

  const stats = getTokenStats(sessionId);
  stats.input += usage.input || 0;
  stats.output += usage.output || 0;
  stats.cacheRead += usage.cacheRead || 0;
  stats.cacheWrite += usage.cacheWrite || 0;
  stats.total += usage.total || 0;
  stats.callCount += 1;

  return stats;
}

// 估算 token 对应的成本（美元）
function estimateCost(stats: TokenStats, model: string = "unknown"): { total: number; perCall: number } {
  // 简化成本估算（不同模型价格不同，这里用近似值）
  const inputCostPer1K = 0.0025;  // $2.5/1M tokens
  const outputCostPer1K = 0.01;   // $10/1M tokens
  
  const inputCost = (stats.input / 1000) * inputCostPer1K;
  const outputCost = (stats.output / 1000) * outputCostPer1K;
  const total = inputCost + outputCost;
  const perCall = stats.callCount > 0 ? total / stats.callCount : 0;
  
  return { total, perCall };
}

function connect(config: TransportConfig): WebSocket | null {
  if (ws?.readyState === WebSocket.OPEN) {
    return ws;
  }

  if (isConnecting) {
    return null;
  }

  isConnecting = true;
  config.logger.info(`[agent-viz] 连接到可视化后端: ${config.endpoint}`);

  try {
    ws = new WebSocket(config.endpoint);

    ws.onopen = () => {
      isConnecting = false;
      config.logger.info("[agent-viz] 已连接到可视化后端");

      // 发送队列中的事件
      while (eventQueue.length > 0 && ws?.readyState === WebSocket.OPEN) {
        const event = eventQueue.shift()!;
        ws.send(JSON.stringify(event));
      }
    };

    ws.onclose = () => {
      isConnecting = false;
      config.logger.warn("[agent-viz] 与可视化后端断开连接");
      ws = null;

      // 3 秒后尝试重连
      setTimeout(() => {
        if (!ws) {
          connect(config);
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      config.logger.error(`[agent-viz] WebSocket 错误: ${error}`);
    };

    return ws;
  } catch (error) {
    isConnecting = false;
    config.logger.error(`[agent-viz] 连接失败: ${error}`);
    return null;
  }
}

export function initTransport(config: TransportConfig): VizTransport {
  // 立即尝试连接
  connect(config);

  return {
    send(event: VizEvent) {
      const socket = ws;

      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(event));
      } else {
        // 加入队列
        eventQueue.push(event);

        // 尝试重连
        if (!ws && !isConnecting) {
          connect(config);
        }

        // 队列大小限制
        if (eventQueue.length > 1000) {
          eventQueue.splice(0, eventQueue.length - 500);
          config.logger.warn("[agent-viz] 事件队列已满，丢弃旧事件");
        }
      }
    },

    close() {
      if (ws) {
        ws.close();
        ws = null;
      }
    },
  };
}
