# Agent 可视化监控系统 - 需求文档

## 项目概述
开发一个类似插件的可视化工具，用于监控 Agent 系统（如 OpenClaw 等）的运行状态，实现对 Agent 行为的全面可视化，类似于对 Agent 进行"CT 扫描"。

## 核心目标
- **学习与研究**：帮助开发者理解 Agent 内部的工作机制和决策过程
- **行为可视化**：将 Agent 的运行过程以直观的方式呈现出来
- **实时监控**：能够实时追踪 Agent 的状态变化
- **过程回放**：支持历史记录的完整回放
- **多系统兼容**：设计通用架构，支持多种 Agent 框架

---

## 监控内容（已确认）

### 1. Context Window 监控
- 每次 LLM 调用时的完整 prompt
- System prompt / User message / Assistant message
- Context window 使用量（tokens / 最大容量）
- 上下文截断事件（compaction/summarization）

### 2. I/O 读写记录
- 文件系统读写操作（路径、内容摘要、操作类型）
- 网络请求（URL、方法、响应状态）
- 数据库/持久化存储操作

### 3. 工具调用（Tool Calls）
- 工具名称、参数、返回值
- 工具调用耗时
- 工具调用链（顺序和依赖关系）

### 4. 状态变化
- Agent 当前状态（idle / thinking / executing / waiting）
- 会话状态变化
- 错误/异常事件

### 5. 决策过程/思考链
- LLM 的 reasoning 过程（如 thinking tags）
- 多步推理的中间结果
- 自我修正/反思记录

### 6. Token 使用统计
- 每次调用的 input/output tokens
- 累计 token 消耗
- 成本估算

---

## 技术架构

### 整体架构
```
┌─────────────────────────────────────────┐
│           可视化前端 (Web)               │
│    时间线 | 流程图 | 状态监控 | 回放      │
│    React + React Flow + WebSocket        │
└────────────────┬────────────────────────┘
                 │ WebSocket / REST API
┌────────────────▼────────────────────────┐
│          数据采集服务 (Backend)          │
│    事件接收 | 存储 | 会话管理            │
│    Node.js + SQLite/PostgreSQL           │
└────────────────┬────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌───────┐  ┌───────┐  ┌───────┐
│OpenClaw│  │ Lang  │  │ 其他  │
│Adapter │  │Chain  │  │Adapter│
│(埋点)  │  │Adapter│  │       │
└───────┘  └───────┘  └───────┘
```

---

## OpenClaw 侵入式埋点方案

### OpenClaw 实际架构分析

基于源码分析，OpenClaw 的核心组件和调用链路：

```
消息入口 (Channels)
    │
    ▼
dispatchInboundMessage (src/auto-reply/dispatch.ts)
    │
    ▼
getReplyFromConfig (src/auto-reply/reply/get-reply.ts)
    │
    ├── initSessionState        ← 会话状态初始化
    ├── resolveModel            ← 模型选择
    ├── runPreparedReply        ← LLM 调用
    │       │
    │       ├── streamSimple (src/llm/stream.ts)     ← LLM 流式调用
    │       │       │
    │       │       └── onPayload / onResponse       ← 请求/响应钩子
    │       │
    │       └── Agent.run() (src/agents/harness/)    ← Agent 循环
    │               │
    │               ├── tool execute                 ← 工具执行
    │               ├── compaction                   ← 上下文压缩
    │               └── usage tracking               ← Token 统计
    │
    └── dispatch reply            ← 回复发送
```

### 关键源码文件映射

| 功能 | 文件路径 | 说明 |
|------|----------|------|
| 消息分发入口 | `src/auto-reply/dispatch.ts` | `dispatchInboundMessage` - 消息处理入口 |
| 回复生成 | `src/auto-reply/reply/get-reply.ts` | `getReplyFromConfig` - 核心回复逻辑 |
| LLM 流式调用 | `src/llm/stream.ts` | `streamSimple` - 所有 LLM 调用的统一入口 |
| Agent 工具集 | `src/agents/agent-tools.ts` | `createOpenClawCodingTools` - 工具创建 |
| 上下文窗口 | `src/agents/context.ts` | `resolveContextTokensForModel` - context window 管理 |
| Token 统计 | `src/agents/usage.ts` | `normalizeUsage` - 统一的 usage 归一化 |
| 会话管理 | `src/agents/sessions/sdk.ts` | `createAgentSession` - 会话生命周期 |
| 上下文压缩 | `src/agents/compaction.ts` | `summarizeWithFallback` - compaction 逻辑 |
| 侧边问题 | `src/agents/btw.ts` | `runBtwSideQuestion` - /btw 命令 |
| Gateway | `src/gateway/server.ts` | WebSocket 服务 |
| 事件系统 | `src/gateway/events.ts` | 内部事件总线 |
| 诊断时间线 | `src/infra/diagnostics-timeline.ts` | 已有的诊断基础设施 |

### 埋点设计原则

1. **最小侵入**：利用已有的 `measureDiagnosticsTimelineSpan` 基础设施，在其基础上扩展
2. **事件驱动**：所有埋点输出统一格式的事件
3. **异步非阻塞**：埋点不影响 Agent 正常运行
4. **可配置**：通过配置文件开关各监控项

### 埋点位置与事件定义

#### 1. 消息入口层 - `src/auto-reply/dispatch.ts`

**埋点位置**：`dispatchInboundMessage` 函数

```typescript
// 已有基础设施可复用：
// - measureDiagnosticsTimelineSpanSync("auto_reply.finalize_context", ...)
// - logMessageReceived(...)

interface VizEvents {
  // 消息接收
  'message:received': {
    sessionId: string;
    sessionKey: string;
    channel: string;        // telegram/discord/whatsapp/slack
    messageId: string;
    chatType: string;       // direct/group/channel
    timestamp: number;
  };
  
  // 会话状态初始化
  'session:init': {
    sessionKey: string;
    sessionId: string;
    agentId: string;
    isNewSession: boolean;
    workspaceDir: string;
    timestamp: number;
  };
}
```

#### 2. LLM 调用层 - `src/llm/stream.ts`

**埋点位置**：`streamSimple` 函数，包装请求和响应

```typescript
interface LlmEvents {
  // LLM 调用前
  'llm:request': {
    sessionId: string;
    provider: string;       // anthropic/openai/google
    model: string;
    messages: Array<{
      role: string;
      content: string | Array<{type: string; text?: string; thinking?: string}>;
    }>;
    systemPrompt: string;
    tools: Array<{name: string; description: string}>;
    contextTokens: number;  // 当前上下文 token 数
    maxTokens: number;      // 模型最大 context window
    timestamp: number;
  };
  
  // LLM 响应完成
  'llm:response': {
    sessionId: string;
    content: string;
    reasoning: string;      // thinking/reasoning 内容
    toolCalls: Array<{
      name: string;
      parameters: Record<string, any>;
      id: string;
    }>;
    usage: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      reasoningTokens: number;
      total: number;
    };
    finishReason: string;
    latency: number;        // ms
    timestamp: number;
  };
  
  // 流式事件
  'llm:stream:event': {
    sessionId: string;
    eventType: string;      // text_delta/thinking_delta/text_start/text_end/thinking_start/thinking_end/done/error
    data: any;
    timestamp: number;
  };
}
```

#### 3. 工具调用层 - `src/agents/agent-tools.ts`

**埋点位置**：工具执行包装器（`wrapToolWithBeforeToolCallHook` 已有钩子机制）

```typescript
interface ToolEvents {
  // 工具调用开始
  'tool:call': {
    sessionId: string;
    toolName: string;
    parameters: Record<string, any>;
    callId: string;
    timestamp: number;
  };
  
  // 工具执行结果
  'tool:result': {
    sessionId: string;
    toolName: string;
    callId: string;
    result: string;         // 截断后的结果
    success: boolean;
    latency: number;
    timestamp: number;
  };
}
```

#### 4. 执行层 - `src/agents/bash-tools.ts`

**埋点位置**：exec/process 工具的执行函数

```typescript
interface ExecEvents {
  // Shell 命令执行
  'exec:command': {
    sessionId: string;
    command: string;
    cwd: string;
    mode: string;           // allow/ask/deny
    success: boolean;
    output: string;         // 截断后的输出
    exitCode: number;
    latency: number;
    timestamp: number;
  };
}
```

#### 5. 文件 I/O 层 - `src/agents/tools/` (read/write/edit)

**埋点位置**：文件读写工具的执行函数

```typescript
interface FileEvents {
  // 文件读取
  'file:read': {
    sessionId: string;
    path: string;
    size: number;
    success: boolean;
    timestamp: number;
  };
  
  // 文件写入
  'file:write': {
    sessionId: string;
    path: string;
    size: number;
    contentPreview: string;  // 前 200 字符
    success: boolean;
    timestamp: number;
  };
  
  // 文件编辑（patch）
  'file:edit': {
    sessionId: string;
    path: string;
    operation: string;       // create/replace/append/patch
    success: boolean;
    timestamp: number;
  };
}
```

#### 6. 上下文压缩层 - `src/agents/compaction.ts`

**埋点位置**：`summarizeWithFallback` 函数

```typescript
interface CompactionEvents {
  // 上下文压缩开始
  'compaction:start': {
    sessionId: string;
    messageCount: number;
    currentTokens: number;
    contextWindow: number;
    trigger: string;         // context_full / manual / stage
    timestamp: number;
  };
  
  // 上下文压缩完成
  'compaction:done': {
    sessionId: string;
    summaryLength: number;
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    latency: number;
    success: boolean;
    timestamp: number;
  };
}
```

#### 7. 状态变化层

**埋点位置**：Agent 状态转换点

```typescript
interface StateEvents {
  // Agent 状态变化
  'agent:state': {
    sessionId: string;
    from: string;            // idle/thinking/executing/waiting/compacting
    to: string;
    reason: string;
    timestamp: number;
  };
  
  // 模型切换
  'agent:model:change': {
    sessionId: string;
    from: string;            // provider/model
    to: string;
    reason: string;          // user_override/auto_fallback/heartbeat
    timestamp: number;
  };
}
```

### 埋点实现方案

#### 方案：利用已有诊断基础设施扩展

OpenClaw 已有 `measureDiagnosticsTimelineSpan` 和 `isDiagnosticsEnabled` 基础设施（`src/infra/diagnostics-timeline.ts`），最佳方案是在此基础上扩展，而非完全重写。

**实现路径**：

```
src/
├── viz/                          ← 新增监控模块
│   ├── index.ts                  ← 入口
│   ├── emitter.ts                ← 统一事件发射器
│   ├── transport.ts              ← WebSocket 传输层
│   ├── config.ts                 ← 配置加载
│   ├── events.ts                 ← 事件类型定义
│   └── patches/                  ← 各层埋点补丁
│       ├── stream.patch.ts       ← LLM 调用埋点
│       ├── dispatch.patch.ts     ← 消息分发埋点
│       ├── tools.patch.ts        ← 工具调用埋点
│       ├── exec.patch.ts         ← 执行层埋点
│       └── compaction.patch.ts   ← 压缩层埋点
```

#### 核心实现代码

```typescript
// src/viz/emitter.ts
import { EventEmitter } from 'events';
import { Transport } from './transport';
import type { VizConfig } from './config';
import type { VizEvent } from './events';

class VizEmitter {
  private emitter = new EventEmitter();
  private transport: Transport;
  private enabled: boolean;
  private sessionId: string | null = null;
  
  constructor(config: VizConfig) {
    this.enabled = config.enabled;
    this.transport = new Transport(config.endpoint);
  }
  
  setSessionId(id: string) {
    this.sessionId = id;
  }
  
  emit<T extends VizEvent['type']>(
    event: T, 
    data: Extract<VizEvent, { type: T }>['data']
  ) {
    if (!this.enabled) return;
    
    const envelope: VizEvent = {
      type: event,
      sessionId: this.sessionId,
      data,
      timestamp: Date.now()
    };
    
    // 本地记录
    this.emitter.emit(event, data);
    
    // 异步发送到后端
    this.transport.send(envelope).catch(console.error);
  }
}

export const vizEmitter = new VizEmitter(loadConfig());
```

```typescript
// src/viz/patches/stream.patch.ts - LLM 调用埋点示例
import { vizEmitter } from '../emitter';

// 包装 streamSimple 函数
const originalStreamSimple = streamSimple;

export async function streamSimpleWithViz(
  model: Model,
  context: Context,
  options: Options
) {
  const startTime = Date.now();
  
  // 发射请求事件
  vizEmitter.emit('llm:request', {
    provider: model.provider,
    model: model.id,
    messages: context.messages,
    systemPrompt: context.systemPrompt,
    tools: context.tools?.map(t => ({
      name: t.name,
      description: t.description
    })) ?? [],
    contextTokens: estimateTokens(context.messages),
    maxTokens: model.contextWindow ?? 128000,
  });
  
  const stream = await originalStreamSimple(model, context, options);
  
  // 包装流式事件
  return {
    async *[Symbol.asyncIterator]() {
      let content = '';
      let reasoning = '';
      let usage: any = null;
      
      for await (const event of stream) {
        // 发射流式事件
        vizEmitter.emit('llm:stream:event', {
          eventType: event.type,
          data: event
        });
        
        if (event.type === 'text_delta') content += event.delta;
        if (event.type === 'thinking_delta') reasoning += event.delta;
        if (event.type === 'done') usage = event.usage;
        
        yield event;
      }
      
      // 发射响应完成事件
      vizEmitter.emit('llm:response', {
        content,
        reasoning,
        usage: normalizeUsage(usage),
        latency: Date.now() - startTime,
      });
    }
  };
}
```

### 配置方式

```json
// viz.config.json
{
  "enabled": true,
  "endpoint": "ws://localhost:9000/viz",
  "monitors": {
    "messageReceived": true,
    "llmCalls": true,
    "llmStreamEvents": false,
    "toolCalls": true,
    "execCommands": true,
    "fileIO": true,
    "compaction": true,
    "stateChanges": true,
    "tokenUsage": true
  },
  "sampling": {
    "messageContent": "truncated",  // full | truncated | hash
    "maxContentLength": 2000,
    "maxToolResultLength": 1000,
    "bufferSize": 1000
  },
  "privacy": {
    "maskSensitiveData": true,
    "excludeChannels": ["sms"]
  }
}
```

---

## 待解决问题

1. 埋点模块的打包和分发方式（npm package / git submodule / patch）
2. 后端服务的技术选型
3. 前端可视化组件的具体设计
4. 会话 ID 的关联方式（OpenClaw 使用 sessionKey 而非 sessionId）

## 备注
本文档为初步需求记录，具体内容待进一步探讨后补充完善。
