# Agent 可视化监控系统 - 需求文档

> 最后更新：2026-06-07

## 项目概述
开发一个可视化监控工具，用于监控 Agent 系统的运行状态，实现 Agent 行为的全面可视化，类似对 Agent 进行"CT 扫描"。

## 核心目标
- **学习与研究**：帮助开发者理解 Agent 内部的工作机制和决策过程
- **行为可视化**：将 Agent 的运行过程以直观的方式呈现出来
- **实时监控**：能够实时追踪 Agent 的状态变化
- **过程回放**：支持历史记录的完整回放
- **多系统兼容**：代理层通用拦截 + 框架插件适配器，支持多种 Agent 框架

---

## 双层数据采集架构

设计核心理念：**代理层负责"LLM 收到/返回了什么"，插件层负责"Agent 内部在做什么"**。两者互补，不可替代。

```
┌──────────────────────────────────────────────────┐
│               可视化前端 (Web)                    │
│   时间线 | Context | 流程图 | 状态 | 回放        │
│   React + Vite + ReactFlow + WebSocket           │
└────────┬───────────────────┬─────────────────────┘
         │                   │
  WebSocket│            REST │API
         │                   │
┌────────▼───────────────────▼─────────────────────┐
│           viz-backend (9001)                      │
│   统一事件接收 | 存储(SQLite) | 广播 | API        │
│   Express + WebSocket + better-sqlite3            │
└────────┬───────────────────┬─────────────────────┘
         │                   ▲
         │                   │ WS 事件推送
         │                   │
    ┌────▼─────┐        ┌────┴──────────┐
    │viz-proxy │        │ 框架插件适配器  │
    │ (9002)   │        │                │
    │          │        │ OpenClaw Plugin │
    │ LLM API  │        │ (hooks/状态)    │
    │ 完整拦截  │        │                │
    │          │        │ 未来: LangChain │
    │ 通用      │        │ Adapter         │
    └──────────┘        └────────────────┘
```

### 代理层 (viz-proxy)

```
OpenClaw → viz-proxy (9002) → LLM API
                 │
          拦截完整 HTTP 请求/响应
                 │
          SQLite 存储 + WebSocket 推送前端
```

**捕获内容**：完整 request body（messages + tools JSON + 参数）、完整 response body（assistant 回复 + usage）

**优势**：跨框架通用，不依赖 Agent 框架内部 API。

**局限**：无法感知 Agent 内部状态（thinking/executing/compacting）、工具调用链、文件 I/O 路径等。

### 插件层 (openclaw-viz-plugin)

**捕获内容**：工具调用链（顺序/耗时/依赖）、Agent 状态变化、上下文压缩事件、会话生命周期、文件 I/O 路径。

**设计原则**：每个 Agent 框架写一个 Adapter Plugin，输出统一格式事件到同一个 viz-backend。

---

## 监控内容

### 1. Context Window 监控
- [x] 每次 LLM 调用时的完整 prompt（system + history + current）
- [x] System prompt / User message / Assistant message 逐条展示
- [x] Context window 使用量（tokens / 最大容量），进度条可视化
- [x] 上下文截断事件（compaction）
- [x] **代理数据源**：LLM 实际收到的完整 messages + tools JSON（含完整 tool schema）

### 2. I/O 读写记录
- [x] 文件系统读写操作（路径、内容摘要、操作类型）— 插件 classifyTool
- [ ] 网络请求详情（URL、方法、响应状态码）
- [ ] 数据库/持久化存储操作

### 3. 工具调用（Tool Calls）
- [x] 工具名称、参数、返回值
- [x] 工具调用耗时
- [x] 工具调用链（顺序和依赖关系）— ReactFlow 流程图
- [x] 工具分类（file_read/write/edit, exec, network, search, memory）

### 4. 状态变化
- [x] Agent 当前状态（idle / thinking / executing / waiting / compacting / terminated）— 插件推断
- [x] 会话状态变化
- [ ] 独立错误/异常事件（高亮展示）

### 5. 决策过程/思考链
- [x] LLM 的 reasoning 过程（thinking tags）— Context Window 中高亮
- [ ] 多步推理的中间结果提取
- [ ] 自我修正/反思记录

### 6. Token 使用统计
- [x] 每次调用的 input/output tokens
- [x] 累计 token 消耗（session 级）
- [x] 成本估算
- [ ] Token 使用趋势图表

---

## 技术架构

### 数据流

```
OpenClaw Gateway
    │
    ├── LLM API Request ──→ viz-proxy (9002) ──→ LLM API
    │                            │
    │                      拦截完整 request/response
    │                      存储到 SQLite
    │                      WS 广播 llm_proxy_request ──→ viz-backend (9001)
    │                                                       │
    ├── Plugin Hooks ──────────→ openclaw-viz-plugin ───────┤
    │    model_call_started       采集 Agent 内部状态         │
    │    before_tool_call         sessionId 关联              │
    │    llm_input/output        状态推断                    │
    │    compaction              工具分类                    │
    │    session_start/end       WS 发送统一事件 ────────────→
    │                              
    └── Tool Execution ──→ (bash tools, file tools, etc.)
                              ← 插件通过 hooks 感知，代理看不到
```

### 事件类型一览

| 类别 | 事件类型 | 数据来源 | 说明 |
|------|---------|:---:|------|
| **LLM 请求** | `llm_proxy_request` | 代理 | 完整 request body（messages+tools+参数） |
| **LLM 输入** | `llm_input` | 插件 | system prompt、history messages |
| **LLM 输出** | `llm_output` | 插件 | assistant 回复、thinking、usage |
| **模型调用** | `model_call_started/ended` | 插件 | provider、model、耗时、错误 |
| **工具调用** | `before_tool_call/after_tool_call` | 插件 | 工具名、参数、结果、耗时、分类 |
| **网络搜索** | `web_search` | 代理/插件 | 搜索查询、结果摘要 |
| **状态变化** | `agent_state_change` | 插件 | idle/thinking/executing/waiting/compacting/terminated |
| **上下文压缩** | `before_compaction/after_compaction` | 插件 | 压缩前后对比 |
| **会话** | `session_start/end` | 插件 | 会话生命周期 |
| **消息** | `message_received/sent` | 插件 | 用户输入 & Agent 输出 |
| **错误** | `error` | 插件 | Agent 内部抛出的异常 |

### 统一事件 Schema 规范

所有事件遵循统一的顶层结构，确保前后端兼容性和可扩展性：

```typescript
interface VizEvent {
  // 事件类型，对应上表
  type: string;

  // 时间戳（毫秒，客户端生成）
  timestamp: number;

  // 会话唯一标识（viz-backend 分配或解析后的统一 ID）
  sessionId: string;

  // 会话业务键（部分 hook 仅有此字段，需通过 session-context 映射）
  sessionKey?: string;

  // 工具调用/模型调用的运行 ID
  runId?: string;

  // 事件业务数据，结构由具体 type 决定
  data: Record<string, unknown>;
}
```

**Schema 约束与规范**：
1. `sessionId` 为必填字段，若原始事件只有 `sessionKey` 或 `runId`，必须通过 `session-context.ts` 解析映射后再发送
2. `timestamp` 优先使用客户端事件触发时刻，若缺失则后端补充接收时刻
3. `data` 字段内避免嵌套过深（不超过 3 层），大体积字段（如完整 response body）可启用采样策略
4. 新增事件类型必须先在 viz-backend 的 SQLite schema 和前端事件路由中注册，禁止随意扩展未约定字段

### 跨框架适配器设计

当前仅实现 OpenClaw Adapter（基于其 Hooks 系统）。未来扩展：

```
framework-adapters/
├── openclaw/          ← 已实现（plugin hooks）
├── langchain/         ← 计划
├── autogen/           ← 计划
└── template/          ← 适配器模板
```

每个适配器只需实现：1) 采集框架特有事件 2) 转换为统一事件格式 3) 发送到 viz-backend。

---

## OpenClaw 插件实现详情

### Hook 注册清单

| Hook 事件 | 采集内容 | 优先级 | 文件 |
|-----------|---------|:---:|------|
| `model_call_started` | provider/model/token budget | 100 | model-call.ts |
| `model_call_ended` | 耗时/错误/outcome | 100 | model-call.ts |
| `llm_input` | system prompt/history/thinking | 100 | llm-content.ts |
| `llm_output` | assistant 回复/usage/thinking | 100 | llm-content.ts |
| `before_tool_call` | 工具名/参数/分类/路径 | 100 | tool-call.ts |
| `after_tool_call` | 结果/耗时/状态 | 100 | tool-call.ts |
| `before_compaction` | 压缩前消息数/token 数 | 100 | compaction.ts |
| `after_compaction` | 压缩后对比 | 100 | compaction.ts |
| `session_start` | sessionId/sessionKey | 100 | session.ts |
| `session_end` | 消息数/耗时/原因 | 100 | session.ts |
| `message_received` | 用户消息内容/channel | 100 | message.ts |
| `message_sent` | Agent 输出内容/channel | 100 | message.ts |
| *(多 hook 推断)* | Agent 状态变化 | 90 | state-monitor.ts |

### Session 上下文关联（session-context.ts）

解决不同 hook 事件中会话标识不一致的问题：
- `sessionKey → sessionId` 映射（message_received 只有 sessionKey）
- `runId → sessionId` 映射（tool_call 只有 runId）
- `resolveSessionId()` 统一解析函数

### 工具分类（classifyTool）

```
file_read   ← read, file_read
file_write  ← write, file_write  
file_edit   ← edit, patch
exec        ← exec, shell, bash
network     ← fetch, http, request
search      ← search
memory      ← memory, recall
other       ← 默认
```

### 配置

```json
{
  "plugins": {
    "load": { "paths": ["/path/to/openclaw-viz-plugin"] },
    "entries": {
      "agent-viz": {
        "enabled": true,
        "hooks": { "allowConversationAccess": true },
        "config": {
          "endpoint": "ws://localhost:9001/ws",
          "contentCapture": true,
          "monitors": {
            "messageReceived": true,
            "messageSent": true,
            "llmCalls": true,
            "llmContent": true,
            "toolCalls": true,
            "compaction": true,
            "stateChanges": true,
            "sessionLifecycle": true
          }
        }
      }
    }
  }
}
```

---

## 前端可视化

### 当前已实现

| 视图 | 功能 | 数据源 |
|------|------|:---:|
| 时间线 | 按时间排列所有事件 | 插件事件 |
| Context Window | LLM 调用上下文（token 进度/消息列表/thinking） | 插件 llm_input/output |
| 真实 Context | LLM 实际 request body（完整 messages+tools JSON） | 代理 llm_proxy_request |
| 工具调用图 | ReactFlow 流程图（7 色分类） | 插件 tool_call 事件 |
| 状态面板 | 会话列表 + 最近事件 | 插件 session/state 事件 |

### 待实现

- [ ] 独立错误事件高亮展示（P0）
- [ ] 事件过滤和搜索（按类型/时间/会话）（P1）
- [ ] Token 使用统计图表（P1）
- [ ] 历史回放功能（逐步重放事件）（P2）
- [ ] 多 Session 对比视图（P2）
- [ ] Prompt 变更追踪与 diff 高亮（P2）
- [ ] ReAct 循环可视化（P3）
- [ ] 数据导出/分享（JSON / Markdown 报告）（P3）
- [ ] Hook vs Proxy 数据对比视图（P3）
- [ ] 深色/浅色主题切换（P3）

---

## 待规划（按优先级排序）

### P0 - 核心功能补齐
1. **独立错误/异常事件高亮展示** — 前端新增 error 类型事件过滤和红色高亮，后端接收 `error` 事件持久化
2. **网络请求详情（URL/方法/状态码）** — 从 web_fetch 等工具参数中提取，并在前端工具调用面板展示
3. **Token 使用统计图表** — session 级 token 消耗趋势折线图（基于 `model_call_started/ended` + `llm_output` 的 usage 数据）

### P1 - 增强分析能力
4. **自我修正/反思记录** — 分析连续 assistant 消息流，检测 "reflection" / "correction" / "I was wrong" 等模式
5. **多 Session 对比视图** — 支持同时打开 2-4 个 session 的时间线并排对比，用于 A/B 测试 prompt 效果
6. **Prompt 变更追踪** — 检测同一 session 中 system prompt 或 tool schema 的变更，高亮 diff

### P2 - 工程与扩展
7. **内容采样策略和隐私脱敏** — 支持 full / truncated / hash-only 三档采样，支持正则脱敏敏感字段
8. **性能优化（批量发送、大内容压缩）** — WebSocket 批量 flush、大 content gzip 压缩、后端写入缓冲队列
9. **容错降级设计** — viz-backend 离线时插件本地环形缓冲 + 重连补发；viz-proxy 拦截失败时直通不阻断 LLM 调用
10. **LangChain/其他框架适配器** — 基于统一事件 Schema 和适配器模板，实现 LangChain callback handler

### P3 - 高级功能
11. **ReAct 循环可视化** — 将 thinking → tool_call → observation → thinking 的循环渲染为 ReactFlow 子图
12. **历史回放功能（逐步重放事件）** — 时间线拖拽进度条、倍速播放、单步前进/后退
13. **数据导出/分享** — session 数据导出为 JSON / Markdown 报告，生成可分享链接（含数据脱敏选项）
14. **Hook vs Proxy 数据对比视图** — 并排展示插件采集的 messages 和代理拦截的实际 request body，高亮差异（用于研究 prompt 组装差异）
