/**
 * 共享 Session 上下文
 * 
 * 维护 sessionKey → sessionId 和 runId → sessionId 的映射，
 * 供所有 hook 文件使用，解决不同 hook 事件中会话标识不一致的问题。
 */

// sessionKey → sessionId（message_received 只有 sessionKey）
export const sessionKeyToId = new Map<string, string>();

// runId → sessionId（tool_call 只有 runId）
export const runIdToSessionId = new Map<string, string>();

export function resolveSessionId(
  sessionId?: string,
  sessionKey?: string,
  runId?: string,
): string | undefined {
  if (sessionId) return sessionId;
  if (sessionKey && sessionKeyToId.has(sessionKey)) return sessionKeyToId.get(sessionKey);
  if (runId && runIdToSessionId.has(runId)) return runIdToSessionId.get(runId);
  return undefined;
}
