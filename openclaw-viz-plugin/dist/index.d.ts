/**
 * Agent Viz Plugin - 可视化监控 OpenClaw Agent 工作过程
 *
 * 通过 OpenClaw 插件系统的 Hooks 机制，非侵入式地拦截和记录 Agent 的所有行为：
 * - LLM 调用（输入/输出/usage）
 * - 工具调用（参数/结果/耗时）
 * - 上下文压缩（压缩前后对比）
 * - 会话生命周期
 * - 消息收发
 */
import type { OpenClawPluginApi } from "./types.js";
export declare function register(api: OpenClawPluginApi): void;
