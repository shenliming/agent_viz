/**
 * 会话生命周期监控 Hooks
 *
 * 拦截 session_start 和 session_end 事件
 * 记录会话的开始、结束、持续时间、消息数、结束原因等
 */
import { sessionKeyToId } from "./session-context.js";
export function registerSessionHooks(api, transport) {
    const { logger } = api;
    // 会话开始
    api.on("session_start", (event) => {
        const e = event;
        logger.info(`[agent-viz] session_start: ${e.sessionId}`);
        // 建立 sessionKey → sessionId 映射
        if (e.sessionId && e.sessionKey) {
            sessionKeyToId.set(e.sessionKey, e.sessionId);
        }
        transport.send({
            type: "session_start",
            timestamp: Date.now(),
            sessionId: e.sessionId,
            sessionKey: e.sessionKey,
            data: {
                sessionId: e.sessionId,
                sessionKey: e.sessionKey,
                resumedFrom: e.resumedFrom,
            },
        });
    }, { priority: 100 });
    // 会话结束
    api.on("session_end", (event) => {
        const e = event;
        logger.info(`[agent-viz] session_end: ${e.sessionId} (${e.messageCount} messages, ${e.durationMs}ms, reason: ${e.reason})`);
        transport.send({
            type: "session_end",
            timestamp: Date.now(),
            sessionId: e.sessionId,
            sessionKey: e.sessionKey,
            data: {
                sessionId: e.sessionId,
                sessionKey: e.sessionKey,
                messageCount: e.messageCount,
                durationMs: e.durationMs,
                reason: e.reason,
                sessionFile: e.sessionFile,
                transcriptArchived: e.transcriptArchived,
                nextSessionId: e.nextSessionId,
                nextSessionKey: e.nextSessionKey,
            },
        });
    }, { priority: 100 });
}
//# sourceMappingURL=session.js.map