# Agent Viz — Agent 可视化监控系统

对 Agent 系统（OpenClaw）进行"CT 扫描"式的全面可视化监控，实时追踪运行状态、LLM 调用、工具执行、上下文变化等。

## 项目结构

```
agent_viz/
├── openclaw-viz-plugin/   # OpenClaw 插件（数据采集层）
│   ├── src/
│   │   ├── index.ts                 # 插件入口
│   │   ├── types.ts                 # 类型定义
│   │   ├── hooks/
│   │   │   ├── session-context.ts   # 共享 session 上下文映射
│   │   │   ├── model-call.ts        # 模型调用监控
│   │   │   ├── llm-content.ts       # LLM 内容监控
│   │   │   ├── tool-call.ts         # 工具调用监控
│   │   │   ├── compaction.ts        # 上下文压缩监控
│   │   │   ├── session.ts           # 会话生命周期
│   │   │   ├── message.ts           # 消息收发
│   │   │   └── state-monitor.ts     # 状态变化推断
│   │   └── transport/
│   │       └── index.ts             # WebSocket 传输层
│   └── openclaw.plugin.json         # 插件 manifest
│
├── viz-backend/           # 后端服务（事件存储 & API）
│   ├── server.js                    # Express + WebSocket + SQLite
│   └── data/events.db               # SQLite 数据库
│
├── viz-proxy/             # LLM 代理服务器（拦截完整请求）
│   ├── server.js                    # HTTP 代理 + SQLite + WebSocket
│   └── data/proxy.db                # 代理请求数据库
│
├── viz-frontend/          # 前端可视化
│   ├── src/
│   │   ├── App.tsx                  # 应用入口
│   │   ├── hooks/useWebSocket.ts    # WebSocket & REST API
│   │   ├── types/index.ts           # 前端类型定义
│   │   ├── utils/format.ts          # 格式化工具
│   │   └── components/
│   │       ├── Dashboard.tsx              # 主面板（Tab 切换）
│   │       ├── TimelineView.tsx           # 时间线视图
│   │       ├── ContextWindowView.tsx      # Context Window 视图
│   │       ├── ProxyContextWindowView.tsx # 真实 Context（代理数据源）
│   │       ├── FlowChartView.tsx          # 工具调用流程图
│   │       └── StatusPanel.tsx            # 状态面板
│   └── vite.config.ts
│
├── test-server/           # 开发测试用 WS 服务（已废弃）
├── requirements.md        # 需求文档
├── PROGRESS.md            # 进度跟踪
└── README.md              # 本文件
```

## 架构概览

```
┌─────────────────────────────────────────┐
│           可视化前端 (Web)               │  localhost:3000
│    时间线 | Context | 流程图 | 状态      │
│    React + Vite + ReactFlow              │
└──────────┬──────────┬───────────────────┘
           │          │
   WebSocket│   REST  │API
           │          │
┌──────────▼──────────▼───────────────────┐
│   viz-backend (9001)                    │  事件存储 & API
│   Express + WebSocket + SQLite          │
└────────────────┬────────────────────────┘
                 │ WebSocket
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌───────┐  ┌───────────┐
│OpenClaw│  │ viz-proxy │  (9002) LLM 请求代理
│ Plugin │  │ HTTP→LLM  │
└───────┘  └───────────┘
```

## 环境要求

- Node.js >= 18
- npm
- OpenClaw（已安装并运行）

## 快速开始

### 1. 安装依赖 & 编译插件

```bash
cd openclaw-viz-plugin
npm install
npm run build
```

### 2. 配置 OpenClaw

在 `~/.openclaw/openclaw.json` 中添加插件配置：

```json
{
  "plugins": {
    "load": {
      "paths": ["/home/shenliming/git/agent_viz/openclaw-viz-plugin"]
    },
    "entries": {
      "agent-viz": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true
        },
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

#### monitors 配置说明

| 开关                 | 默认   | 控制内容           |
| ------------------ | ---- | -------------- |
| `llmCalls`         | true | 模型调用生命周期事件     |
| `llmContent`       | true | LLM 输入/输出内容    |
| `toolCalls`        | true | 工具调用（参数/结果/耗时） |
| `compaction`       | true | 上下文压缩事件        |
| `stateChanges`     | true | Agent 状态变化推断   |
| `sessionLifecycle` | true | 会话开始/结束        |
| `messageReceived`  | true | 用户消息接收         |
| `messageSent`      | true | Agent 消息发送     |

关闭某项可减少事件量，提升性能。例如关闭工具调用：

```json
{ "monitors": { "toolCalls": false } }
```

### 3. 启动后端服务

```bash
cd viz-backend
npm install
npm start
# => REST API:  http://localhost:9001/api
# => WebSocket: ws://localhost:9001/ws
```

### 4. 启动代理服务器（可选 — 用于捕获完整 LLM 请求体）

```bash
cd viz-proxy
npm install
PROXY_PORT=9002 LLM_TARGET=http://localhost:1234 npm start
# => Proxy:     http://localhost:9002
```

然后修改 OpenClaw 的 LLM API 端点为 `http://localhost:9002/v1`，让所有 LLM 请求经过代理被捕获。

> **重要**：大语言模型的 `baseUrl` 必须指向代理地址 `http://localhost:9002/v1`，否则代理无法拦截请求。如果直接指向原始 LLM 地址，请求将绕过代理，"真实 Context"视图将无数据。

> 即使不启动代理，插件的 hooks 也能捕获大部分数据。代理的主要作用是拦截完整的 request body（含 tools 定义 JSON），展示在"真实 Context"视图中。

### 5. 启动前端

```bash
cd viz-frontend
npm install
npm run dev
# => http://localhost:3000
```

### 6. 重启 OpenClaw Gateway

```bash
openclaw gateway restart
```

### 7. 发送测试消息

```bash
openclaw agent -m "请帮我读取 /etc/hostname 文件内容，然后计算 2+3*4 等于多少？" --session-id test-001
```

### 8. 查看监控面板

打开浏览器访问 `http://localhost:3000`，可以看到：

- **时间线** — 按时间顺序列出所有事件
- **Context Window** — 每次 LLM 调用的完整上下文排布（token 进度条、消息列表、thinking 高亮）
- **真实 Context** — 基于代理数据源，显示 LLM 实际收到的完整 request body
- **工具调用图** — React Flow 流程图展示工具调用链
- **状态面板** — 会话列表和最近事件

## 后端 API 参考

### viz-backend (9001)

| 端点                         | 方法        | 说明                                         |
| -------------------------- | --------- | ------------------------------------------ |
| `/api/events`              | GET       | 获取事件列表（`?limit=&offset=&type=&sessionId=`） |
| `/api/sessions`            | GET       | 会话列表                                       |
| `/api/sessions/:id/events` | GET       | 指定会话的事件                                    |
| `/api/sessions/:id/stats`  | GET       | 指定会话的统计                                    |
| `/api/stats`               | GET       | 全局统计                                       |
| `/api/sessions/:id`        | DELETE    | 删除指定会话                                     |
| `/api/events`              | DELETE    | 清空所有数据                                     |
| `/ws`                      | WebSocket | 实时事件推送                                     |

### viz-proxy (9002)

| 端点              | 方法        | 说明                          |
| --------------- | --------- | --------------------------- |
| `/api/requests` | GET       | LLM 请求记录（`?limit=&offset=`） |
| `/api/stats`    | GET       | 统计（总请求数、token、模型分布）         |
| `/api/requests` | DELETE    | 清空所有数据                      |
| `/ws`           | WebSocket | 实时请求推送                      |

## 监控内容一览

| 类别                 | 事件类型                                     | 说明                                                    |
| ------------------ | ---------------------------------------- | ----------------------------------------------------- |
| **Context Window** | `llm_input`, `llm_output`                | system prompt、history messages、assistant 回复、token 使用  |
| **工具调用**           | `before_tool_call`, `after_tool_call`    | 工具名、参数、结果、耗时、文件路径                                     |
| **状态变化**           | `agent_state_change`                     | idle / thinking / executing / compacting / terminated |
| **模型调用**           | `model_call_started`, `model_call_ended` | provider、model、耗时、错误                                  |
| **上下文压缩**          | `before_compaction`, `after_compaction`  | 压缩前后对比                                                |
| **会话**             | `session_start`, `session_end`           | 会话生命周期                                                |
| **消息**             | `message_received`, `message_sent`       | 用户输入 & Agent 输出                                       |
| **代理**             | `llm_proxy_request`                      | 完整 LLM request/response body                          |

## 常用命令

```bash
# 查看 gateway 日志
journalctl --user -u openclaw-gateway -f | grep -i "agent-viz"

# 验证持久化
curl http://localhost:9001/api/stats

# 清空数据
curl -X DELETE http://localhost:9001/api/events

# 查看代理统计
curl http://localhost:9002/api/stats

# 查端口占用
lsof -i :9001
lsof -i :9002
```

## 服务端口总览

| 端口   | 服务           | 用途                   |
| ---- | ------------ | -------------------- |
| 3000 | viz-frontend | 前端可视化界面              |
| 9000 | test-server  | 开发测试（已废弃）            |
| 9001 | viz-backend  | 事件存储、API 和 WebSocket |
| 9002 | viz-proxy    | LLM 请求代理拦截           |

