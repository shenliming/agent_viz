/**
 * Agent 状态变化监控 Hooks
 *
 * 基于现有 hooks 推断 Agent 状态变化：
 * - message_received → idle → thinking
 * - model_call_started → thinking
 * - before_tool_call → executing
 * - after_tool_call → thinking (如果还有工具) 或 idle (如果完成)
 * - model_call_ended → idle
 * - session_end → terminated
 */
// 跟踪每个 session 的当前状态
const sessionStates = new Map();
function emitStateChange(transport, sessionId, sessionKey, runId, from, to, reason) {
    if (!sessionId)
        return;
    sessionStates.set(sessionId, to);
    transport.send({
        type: "agent_state_change",
        timestamp: Date.now(),
        sessionId,
        sessionKey,
        runId,
        data: {
            from,
            to,
            reason,
        },
    });
}
function getCurrentState(sessionId) {
    if (!sessionId)
        return "idle";
    return sessionStates.get(sessionId) || "idle";
}
export function registerStateMonitorHooks(api, transport) {
    const { logger } = api;
    // 消息接收 → idle → thinking
    api.on("message_received", (event) => {
        const e = event;
        const current = getCurrentState(e.sessionKey);
        if (current !== "thinking") {
            emitStateChange(transport, e.sessionKey, e.sessionKey, undefined, current, "thinking", "message_received");
        }
    }, { priority: 90 });
    // 模型调用开始 → thinking
    api.on("model_call_started", (event) => {
        const e = event;
        const current = getCurrentState(e.sessionId);
        if (current !== "thinking") {
            emitStateChange(transport, e.sessionId, e.sessionKey, e.runId, current, "thinking", "model_call_started");
        }
    }, { priority: 90 });
    // 工具调用前 → executing
    api.on("before_tool_call", (event) => {
        const e = event;
        // 工具调用通常属于某个 session，通过 runId 关联
        // 这里我们发送一个通用的 executing 状态
        transport.send({
            type: "agent_state_change",
            timestamp: Date.now(),
            runId: e.runId,
            data: {
                from: "thinking",
                to: "executing",
                reason: `tool_call: ${e.toolName}`,
            },
        });
    }, { priority: 90 });
    // 工具调用后 → thinking (可能还有更多工具)
    api.on("after_tool_call", (event) => {
        const e = event;
        transport.send({
            type: "agent_state_change",
            timestamp: Date.now(),
            runId: e.runId,
            data: {
                from: "executing",
                to: "thinking",
                reason: `tool_call_completed: ${e.toolName}`,
            },
        });
    }, { priority: 90 });
    // 模型调用结束 → idle
    api.on("model_call_ended", (event) => {
        const e = event;
        const current = getCurrentState(e.sessionId);
        if (e.outcome === "completed" && current !== "idle") {
            emitStateChange(transport, e.sessionId, e.sessionKey, e.runId, current, "idle", "model_call_completed");
        }
    }, { priority: 90 });
    // 上下文压缩开始 → compacting
    api.on("before_compaction", (event) => {
        const e = event;
        // compaction 事件可能没有 sessionId，使用 sessionFile 作为标识
        const sessionId = e.sessionFile || "unknown";
        const current = getCurrentState(sessionId);
        if (current !== "compacting") {
            emitStateChange(transport, sessionId, undefined, undefined, current, "compacting", "compaction_started");
        }
    }, { priority: 90 });
    // 上下文压缩结束 → idle
    api.on("after_compaction", (event) => {
        const e = event;
        const sessionId = e.sessionFile || "unknown";
        const current = getCurrentState(sessionId);
        if (current === "compacting") {
            emitStateChange(transport, sessionId, undefined, undefined, current, "idle", "compaction_completed");
        }
    }, { priority: 90 });
    // 会话结束 → terminated
    api.on("session_end", (event) => {
        const e = event;
        const current = getCurrentState(e.sessionId);
        if (current !== "terminated") {
            emitStateChange(transport, e.sessionId, e.sessionKey, undefined, current, "terminated", `session_end: ${e.reason}`);
        }
        // 清理状态
        sessionStates.delete(e.sessionId);
    }, { priority: 90 });
}
//# sourceMappingURL=state-monitor.js.map