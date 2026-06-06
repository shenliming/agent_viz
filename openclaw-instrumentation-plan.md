# OpenClaw 侵入式埋点方案

## 核心发现

经过深入分析 OpenClaw 源码，发现 OpenClaw **已有完善的诊断事件基础设施**。最佳方案是**复用并扩展现有系统**，而非从零构建。

### 现有诊断基础设施

| 模块 | 文件 | 功能 |
|------|------|------|
| 事件类型定义 | `src/infra/diagnostic-events.ts` | 30+ 种诊断事件类型 |
| 时间线追踪 | `src/infra/diagnostics-timeline.ts` | AsyncLocalStorage 实现的 span 追踪 |
| 模型调用诊断 | `src/agents/embedded-agent-runner/run/attempt.model-diagnostic-events.ts` | LLM 调用的详细诊断，含内容捕获 |
| 事件发射器 | `src/infra/diagnostic-events.ts` | `emitTrustedDiagnosticEvent()` |
| 内容捕获策略 | `src/infra/diagnostic-llm-content.ts` | 控制是否捕获 prompt/response 内容 |
| Trace 上下文 | `src/infra/diagnostic-trace-context.ts` | 分布式追踪上下文 |

---

## 方案：双轨并行

### 轨道 A：复用现有诊断事件（推荐）

OpenClaw 已有的事件类型已覆盖 80% 的监控需求：

```typescript
// 已有的事件类型（来自 src/infra/diagnostic-events.ts）
type ExistingDiagnosticEvents =
  | 'model.call.started'        // LLM 调用开始
  | 'model.call.completed'      // LLM 调用完成
  | 'model.call.error'          // LLM 调用错误
  | 'tool.execution.started'    // 工具执行开始
  | 'tool.execution.completed'  // 工具执行完成
  | 'tool.execution.error'      // 工具执行错误
  | 'tool.execution.blocked'    // 工具被拦截
  | 'run.started'               // Agent 运行开始
  | 'run.completed'             // Agent 运行完成
  | 'run.progress'              // 运行进度
  | 'session.state'             // 会话状态变化
  | 'context.assembled'         // 上下文组装
  | 'exec.process.completed'    // 进程执行完成
  | 'harness.run.started'       // Harness 运行开始
  | 'harness.run.completed'     // Harness 运行完成
  | 'harness.run.error'         // Harness 运行错误
  | 'message.received'          // 消息接收
  | 'message.processed'         // 消息处理完成
  | 'skill.used'                // Skill 使用
  | 'tool.loop'                 // 工具循环检测
  | 'model.failover'            // 模型故障转移
  ;
```

### 轨道 B：扩展新增事件类型

针对可视化需求，需要新增以下事件类型：

```typescript
// 需要新增的事件类型
type VizExtensionEvents =
  // 1. 上下文压缩事件（已有 compaction 逻辑但无诊断事件）
  | 'compaction.started'
  | 'compaction.completed'
  | 'compaction.error'

  // 2. 文件 I/O 事件（工具执行层面）
  | 'file.read'
  | 'file.write'
  | 'file.edit'

  // 3. 流式内容事件（需要更细粒度的流式数据）
  | 'model.stream.delta'        // 文本/思考增量
  | 'model.stream.tool_call'    // 工具调用解析

  // 4. 上下文窗口快照
  | 'context.snapshot'          // 完整的 context window 快照

  // 5. Token 使用明细
  | 'usage.detail'             // 详细的 token 使用统计
  ;
```

---

## 埋点注入位置详解

### 1. LLM 调用层

**注入位置**: `src/agents/embedded-agent-runner/run/attempt.model-diagnostic-events.ts`

**现有机制**: 该文件已经实现了 `wrapModelCallWithDiagnostics()` 函数，包装了模型调用。

**扩展方案**:

```typescript
// 在 attempt.model-diagnostic-events.ts 中扩展
// 已有代码结构：
// - modelCallStarted()  -> emitTrustedDiagnosticEvent({ type: 'model.call.started', ... })
// - modelCallCompleted() -> emitTrustedDiagnosticEvent({ type: 'model.call.completed', ... })
// - modelCallError()     -> emitTrustedDiagnosticEvent({ type: 'model.call.error', ... })

// 需要扩展的内容：
// 1. 在 modelCallStarted 中添加完整的 messages 内容（受 contentCapture 策略控制）
// 2. 在 modelCallCompleted 中添加 response 内容、toolCalls 明细
// 3. 新增流式事件发射点

// 具体注入位置：
// Line ~230: observeResponseChunk() - 在此处添加流式事件发射
// Line ~300: modelCallCompleted() - 在此处添加完整 response 内容
```

**关键代码位置**:

```typescript
// src/agents/embedded-agent-runner/run/attempt.ts
// 这是 Agent 运行的核心文件，调用链：
// runAgent() -> runAttempt() -> wrapModelCallWithDiagnostics() -> streamFn()

// 在 runAttempt() 函数中（约第 200-400 行），可以看到：
// - 上下文组装 -> emitTrustedDiagnosticEvent({ type: 'context.assembled', ... })
// - 模型调用   -> wrapModelCallWithDiagnostics()
// - 工具执行   -> createOpenClawCodingTools() -> wrapToolWithBeforeToolCallHook()
```

### 2. 工具调用层

**注入位置**: `src/agents/agent-tools.before-tool-call.ts`

**现有机制**: `wrapToolWithBeforeToolCallHook()` 函数已经包装了所有工具调用。

**现有事件发射**:

```typescript
// src/agents/agent-tools.before-tool-call.ts 中已有：
// - emitTrustedDiagnosticEvent({ type: 'tool.execution.started', ... })
// - emitTrustedDiagnosticEvent({ type: 'tool.execution.completed', ... })
// - emitTrustedDiagnosticEvent({ type: 'tool.execution.error', ... })
// - emitTrustedDiagnosticEvent({ type: 'tool.execution.blocked', ... })
```

**扩展方案**:

```typescript
// 在 wrapToolWithBeforeToolCallHook 中扩展：
// 1. 在工具执行前发射完整的参数内容
// 2. 在工具执行后发射完整的返回值内容
// 3. 添加文件 I/O 事件的识别和发射

// 关键注入位置：
// - 工具执行前：约第 350-450 行，hook 决策后、实际执行前
// - 工具执行后：约第 500-600 行，结果返回后
```

### 3. 文件 I/O 层

**注入位置**: `src/agents/agent-tools.read.ts` 和 `src/agents/sessions/tools/bash.ts`

**文件读写工具**:

```typescript
// src/agents/agent-tools.read.ts 中定义了：
// - createSandboxedReadTool()   -> 文件读取
// - createSandboxedWriteTool()  -> 文件写入
// - createSandboxedEditTool()   -> 文件编辑
// - createOpenClawReadTool()    -> OpenClaw 读取工具

// 注入方案：在这些工具的执行函数中添加事件发射
```

**Bash 命令执行**:

```typescript
// src/agents/sessions/tools/bash.ts 中定义了 bash 工具
// src/agents/bash-tools.exec.ts 中定义了执行逻辑

// 已有事件：DiagnosticExecProcessCompletedEvent
// 需要扩展：添加命令内容、输出内容的捕获
```

### 4. 上下文压缩层

**注入位置**: `src/agents/embedded-agent-runner/compact.ts` 和 `src/agents/embedded-agent-runner/compaction-hooks.ts`

```typescript
// src/agents/embedded-agent-runner/compact.ts - 压缩核心逻辑
// src/agents/embedded-agent-runner/compaction-hooks.ts - 压缩钩子

// 需要新增事件：
// - compaction.started: 压缩触发原因、当前 token 使用量
// - compaction.completed: 压缩前后 token 对比、压缩率
// - compaction.error: 压缩失败原因
```

### 5. 消息入口层

**注入位置**: `src/auto-reply/dispatch.ts`

**现有机制**:

```typescript
// src/auto-reply/dispatch.ts 中已有：
// - measureDiagnosticsTimelineSpan() - 时间线追踪
// - logMessageReceived() - 消息接收日志
// - emitTrustedDiagnosticEvent({ type: 'message.received', ... })
```

---

## 实现策略

### 策略一：诊断事件拦截器（推荐）

不修改 OpenClaw 核心代码，而是**拦截 `emitTrustedDiagnosticEvent` 函数**，将事件转发到可视化后端。

```typescript
// viz-adapter/src/interceptor.ts
import * as diagnosticEvents from 'openclaw/src/infra/diagnostic-events.js';

const originalEmit = diagnosticEvents.emitTrustedDiagnosticEvent;

export function installVizInterceptor(config: VizConfig) {
  // 包装原始发射器
  (diagnosticEvents as any).emitTrustedDiagnosticEvent = (event: any) => {
    // 1. 调用原始发射器（保持 OpenClaw 原有行为）
    originalEmit(event);

    // 2. 转发到可视化后端
    vizTransport.send({
      type: event.type,
      sessionId: event.sessionId,
      sessionKey: event.sessionKey,
      data: event,
      timestamp: event.ts,
    }).catch(console.error);
  };
}
```

**优点**:
- 最小侵入，只需在入口点注入拦截器
- 不影响 OpenClaw 原有功能
- 可以利用所有已有的诊断事件

**注入点**:
```typescript
// 在 OpenClaw 启动时加载拦截器
// 方式 1: 修改 src/entry.ts，在启动时调用 installVizInterceptor()
// 方式 2: 通过 Node.js --require 参数预加载
// 方式 3: 通过环境变量 OPENCLAW_VIZ_ENDPOINT 触发
```

### 策略二：扩展诊断事件类型

在现有事件系统基础上添加新的事件类型。

```typescript
// viz-adapter/src/events/extensions.ts
import type { DiagnosticEventInput } from 'openclaw/src/infra/diagnostic-events.js';

// 扩展事件类型
type VizDiagnosticEvent = DiagnosticEventInput | {
  type: 'compaction.started';
  runId: string;
  sessionKey?: string;
  trigger: 'context_overflow' | 'manual' | 'stage';
  currentTokens: number;
  contextWindow: number;
  messageCount: number;
  ts: number;
  seq: number;
} | {
  type: 'compaction.completed';
  runId: string;
  sessionKey?: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  durationMs: number;
  ts: number;
  seq: number;
} | {
  type: 'file.read' | 'file.write' | 'file.edit';
  runId?: string;
  sessionKey?: string;
  path: string;
  size?: number;
  contentPreview?: string;
  success: boolean;
  ts: number;
  seq: number;
};
```

### 策略三：内容捕获增强

扩展现有的 `DiagnosticModelContentCapturePolicy` 以捕获更多内容。

```typescript
// viz-adapter/src/content-capture.ts
// 现有的内容捕获策略在 src/infra/diagnostic-llm-content.ts 中定义

export function createVizContentCapturePolicy(): DiagnosticModelContentCapturePolicy {
  return {
    anyModelContent: true,
    inputMessages: true,      // 捕获完整输入消息
    systemPrompt: true,       // 捕获 system prompt
    toolDefinitions: true,    // 捕获工具定义
    outputMessages: true,     // 捕获输出消息
  };
}
```

---

## 事件流完整映射

```
用户消息
  │
  ▼
┌─────────────────────────────────────────────────┐
│ dispatch.ts                                      │
│ 事件: message.received, message.processed        │
│ 新增: message.content (消息内容)                  │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ run.ts (runAgent)                                │
│ 事件: run.started, run.completed                 │
│ 新增: run.trigger (触发原因)                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│ attempt.ts (runAttempt)                          │
│ 事件: context.assembled, run.attempt             │
│ 新增: context.snapshot (完整上下文快照)           │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────────┐  ┌──────────────────────────┐
│ attempt.model-   │  │ agent-tools.before-      │
│ diagnostic-      │  │ tool-call.ts              │
│ events.ts        │  │ 事件: tool.execution.*    │
│ 事件: model.     │  │ 新增: tool.params.full    │
│ call.*           │  │       tool.result.full    │
│ 新增: model.     │  └──────────┬───────────────┘
│ stream.delta     │             │
│ model.stream.    │             ▼
│ tool_call        │  ┌──────────────────────────┐
└──────────────────┘  │ agent-tools.read.ts      │
                      │ bash-tools.exec.ts       │
                      │ 新增: file.read/write/edit│
                      │       exec.command.full   │
                      │       exec.output.full    │
                      └──────────┬───────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────┐
                      │ compact.ts               │
                      │ compaction-hooks.ts      │
                      │ 新增: compaction.*        │
                      └──────────────────────────┘
```

---

## 具体实现步骤

### Phase 1: 诊断事件拦截器（最小改动）

1. 创建 `viz-adapter/src/interceptor.ts`
2. 拦截 `emitTrustedDiagnosticEvent` 函数
3. 实现 WebSocket 传输层
4. 在 OpenClaw 启动时加载拦截器

**需要修改的 OpenClaw 文件**:
- `src/entry.ts` - 添加拦截器加载逻辑（约 5 行代码）

### Phase 2: 新增事件类型

1. 在 `diagnostic-events.ts` 中添加新的事件类型定义
2. 在对应的源文件中添加事件发射逻辑

**需要修改的 OpenClaw 文件**:
- `src/infra/diagnostic-events.ts` - 添加新事件类型
- `src/agents/embedded-agent-runner/compact.ts` - 添加 compaction 事件
- `src/agents/agent-tools.read.ts` - 添加 file I/O 事件

### Phase 3: 内容捕获增强

1. 扩展 `DiagnosticModelContentCapturePolicy`
2. 在 `attempt.model-diagnostic-events.ts` 中添加流式事件

**需要修改的 OpenClaw 文件**:
- `src/infra/diagnostic-llm-content.ts` - 扩展捕获策略
- `src/agents/embedded-agent-runner/run/attempt.model-diagnostic-events.ts` - 添加流式事件

---

## 配置方式

```json
// openclaw.json 中添加 viz 配置
{
  "viz": {
    "enabled": true,
    "endpoint": "ws://localhost:9000/viz",
    "contentCapture": {
      "inputMessages": true,
      "systemPrompt": true,
      "outputMessages": true,
      "toolParams": "truncated",
      "toolResults": "truncated",
      "fileContent": "preview"
    },
    "sampling": {
      "maxMessageLength": 4000,
      "maxToolParamLength": 2000,
      "maxToolResultLength": 2000,
      "maxFilePreviewLength": 500
    },
    "privacy": {
      "maskSensitivePaths": true,
      "excludeChannels": ["sms"]
    }
  }
}
```

---

## 关键文件索引

| 文件 | 作用 | 埋点状态 |
|------|------|----------|
| `src/infra/diagnostic-events.ts` | 事件类型定义 + 发射器 | 已有，需扩展 |
| `src/infra/diagnostics-timeline.ts` | 时间线追踪 | 已有，可复用 |
| `src/infra/diagnostic-llm-content.ts` | 内容捕获策略 | 已有，需扩展 |
| `src/infra/diagnostic-trace-context.ts` | Trace 上下文 | 已有，可复用 |
| `src/agents/embedded-agent-runner/run/attempt.ts` | Agent 运行核心 | 已有部分埋点 |
| `src/agents/embedded-agent-runner/run/attempt.model-diagnostic-events.ts` | 模型调用诊断 | 已有，需扩展流式事件 |
| `src/agents/agent-tools.before-tool-call.ts` | 工具调用包装 | 已有埋点 |
| `src/agents/agent-tools.read.ts` | 文件读写工具 | 需新增埋点 |
| `src/agents/sessions/tools/bash.ts` | Bash 工具 | 需新增埋点 |
| `src/agents/embedded-agent-runner/compact.ts` | 上下文压缩 | 需新增埋点 |
| `src/agents/embedded-agent-runner/compaction-hooks.ts` | 压缩钩子 | 需新增埋点 |
| `src/auto-reply/dispatch.ts` | 消息分发 | 已有埋点 |
| `src/entry.ts` | 入口文件 | 需添加拦截器加载 |
