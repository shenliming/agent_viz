# Agent 可视化监控系统 - 项目进度

> 最后更新：2026-06-06 22:00

---

## 整体进度：~92%

| 模块 | 进度 | 状态 |
|------|------|------|
| 数据采集层（OpenClaw 插件） | 80% | ✅ 基本完成 |
| 传输层（WebSocket） | 90% | ✅ 完成 |
| 后端服务（存储/API） | 85% | ✅ 完成 |
| 前端可视化（Web UI） | 90% | ✅ 核心完成 |
| **代理方案（LLM 请求拦截）** | **100%** | **✅ 完成** |

---

## 下一步计划

### 最高优先级

0. **代理方案 - 获取完整 LLM Request Body** ✅ 完成
   - [x] 开发 LLM 代理服务器（拦截 OpenClaw → LLM API 的请求）
   - [x] 解析并存储完整的 request body（messages + tools + 参数）
   - [x] 解析 response body（assistant 回复 + usage）
   - [x] 前端新增 "真实 Context" 视图（基于代理数据源）
   - [x] 配置 OpenClaw 使用代理（修改 LLM API 端点为 http://localhost:9002）

### 高优先级

1. **前端增强**
   - [ ] 事件过滤和搜索（按类型/时间/会话）
   - [ ] Token 使用统计图表
   - [ ] 历史回放功能

2. **完善 I/O 监控**
   - [ ] 网络请求详情（URL、方法、状态码）
   - [ ] 数据库操作监控

### 中优先级

3. **完善决策过程**
   - [ ] 自我修正/反思记录
   - [ ] 多步推理中间结果提取

4. **配置优化**
   - [ ] 监控项开关配置
   - [ ] 内容采样策略（full/truncated/hash）
   - [ ] 隐私保护（敏感数据脱敏）

### 低优先级

5. **性能优化**
   - [ ] 事件批量发送
   - [ ] 大内容压缩
   - [ ] 内存使用优化

6. **深色/浅色主题切换**

---

## 一、监控能力完成度

### 1. Context Window 监控 ✅ 95%

| 需求 | 状态 | 实现位置 |
|------|------|----------|
| 完整 prompt | ✅ | `llm_input` 事件 |
| System prompt | ✅ | `systemPrompt` 字段 |
| History messages | ✅ | `historyMessages` 数组 |
| Assistant messages | ✅ | `assistantTexts` + `fullAssistantText` |
| Context window 使用量 | ✅ | `contextTokenBudget` + `estimatedHistoryTokens` |
| 上下文截断事件 | ✅ | `before_compaction` / `after_compaction` |
| **可视化排布** | ✅ | **Context Window 视图** |

### 2. I/O 读写记录 ⚠️ 40%

| 需求 | 状态 | 说明 |
|------|------|------|
| 文件读写操作 | ✅ | 工具分类识别 `file_read`/`file_write`/`file_edit`，提取路径 |
| 网络请求 | ⚠️ | 工具分类识别 `network`，缺少 URL/状态详情 |
| 数据库操作 | ❌ | 未实现 |

### 3. 工具调用 ✅ 85%

| 需求 | 状态 | 实现位置 |
|------|------|----------|
| 工具名称 | ✅ | `toolName` 字段 |
| 参数 | ✅ | `params` 字段 |
| 返回值 | ✅ | `result` 字段（含截断处理） |
| 调用耗时 | ✅ | `durationMs` 字段 |
| 工具调用链 | ✅ | 有 `runId` 关联 + React Flow 可视化 |

### 4. 状态变化 ✅ 80%

| 需求 | 状态 | 实现位置 |
|------|------|----------|
| Agent 当前状态 | ✅ | `agent_state_change` 事件（idle/thinking/executing/compacting/terminated） |
| 会话状态变化 | ✅ | `session_start` / `session_end` |
| 错误/异常事件 | ⚠️ | 有 `errorCategory`/`failureKind`，缺少独立错误事件 |

### 5. 决策过程/思考链 ✅ 75%

| 需求 | 状态 | 说明 |
|------|------|------|
| thinking tags | ✅ | `thinkingMessages` + `thinkingContent`，Context Window 视图中高亮显示 |
| 多步推理中间结果 | ⚠️ | 通过 `historyMessages` 间接获取 |
| 自我修正/反思 | ❌ | 未专门实现 |

### 6. Token 使用统计 ✅ 90%

| 需求 | 状态 | 实现位置 |
|------|------|----------|
| 每次调用 input/output | ✅ | `usage` 字段 |
| 累计 token 消耗 | ✅ | transport 层 session 级累计 |
| 成本估算 | ✅ | `estimateCost` 函数 |
| **可视化进度条** | ✅ | **Context Window 视图中显示 token 使用占比** |

---

## 二、技术架构完成度

### 数据采集层 ✅ 85%

**实现方式**：OpenClaw 插件 + Hooks 机制

**已注册 Hooks**：
- `model_call_started` / `model_call_ended` - 模型调用生命周期
- `llm_input` / `llm_output` - LLM 内容（prompt/response/usage）
- `before_tool_call` / `after_tool_call` - 工具调用
- `before_compaction` / `after_compaction` - 上下文压缩
- `session_start` / `session_end` - 会话生命周期
- `message_received` / `message_sent` - 消息收发
- 状态推断 - 基于上述 hooks 推断 Agent 状态变化

**关键文件**：
```
openclaw-viz-plugin/
├── src/
│   ├── index.ts                    # 插件入口
│   ├── types.ts                    # 类型定义
│   ├── hooks/
│   │   ├── model-call.ts           # 模型调用监控
│   │   ├── llm-content.ts          # LLM 内容监控（含 thinking）
│   │   ├── tool-call.ts            # 工具调用监控（含分类/路径提取）
│   │   ├── compaction.ts           # 上下文压缩监控
│   │   ├── session.ts              # 会话生命周期监控
│   │   ├── message.ts              # 消息收发监控
│   │   └── state-monitor.ts        # Agent 状态变化推断
│   └── transport/
│       └── index.ts                # WebSocket 传输层（含 token 累计）
├── openclaw.plugin.json            # 插件 manifest
└── package.json
```

### 传输层 ✅ 90%

**功能**：
- WebSocket 连接管理
- 自动重连（3 秒间隔）
- 事件队列（断线缓存，最大 1000 条）
- Session 级 Token 累计统计
- 成本估算

### 后端服务 ✅ 80%

**当前状态**：viz-backend（基于 SQLite + Express + WebSocket）
- ✅ WebSocket 事件接收
- ✅ 控制台格式化打印
- ✅ 事件统计
- ✅ 事件广播（支持多客户端）
- ✅ 事件持久化（SQLite）
- ✅ 会话管理
- ✅ REST API（查询事件/会话/统计/删除）
- ❌ 事件分页（基础分页已实现）
- ❌ 高级搜索（按时间范围/关键词）

**关键文件**：
```
viz-backend/
├── server.js              # 主服务（Express + WebSocket + SQLite）
├── package.json
└── data/
    └── events.db          # SQLite 数据库文件

**API 端点**：
- `GET /api/events` - 获取所有事件（支持 limit/offset/type/sessionId 过滤）
- `GET /api/sessions` - 获取会话列表
- `GET /api/sessions/:sessionId/events` - 获取指定会话的所有事件
- `GET /api/sessions/:sessionId/stats` - 获取指定会话的统计
- `GET /api/stats` - 获取全局统计
- `DELETE /api/sessions/:sessionId` - 删除指定会话
- `DELETE /api/events` - 清空所有数据
- `WebSocket /ws` - 实时事件推送

### 代理方案 ✅ 85%

**架构**：
```
OpenClaw → viz-proxy (9002) → LLM API (可配置)
                ↓
         捕获完整 request/response body
                ↓
          存储到 SQLite + 推送前端
```

**功能**：
- ✅ 拦截完整的 HTTP 请求和响应
- ✅ 存储到 SQLite（messages、tools、usage、duration）
- ✅ 支持流式和非流式响应
- ✅ REST API 查询历史请求
- ✅ WebSocket 广播实时请求

**关键文件**：
```
viz-proxy/
├── server.js              # 代理服务器（HTTP + SQLite + WebSocket）
├── package.json
└── data/
    └── proxy.db           # SQLite 数据库文件

**API 端点**：
- `GET /api/requests` - 获取所有 LLM 请求记录（支持 limit/offset/model 过滤）
- `GET /api/stats` - 获取统计信息（总请求数、token 消耗、模型分布）
- `DELETE /api/requests` - 清空所有数据
- `WebSocket /ws` - 实时请求推送

**配置**：
- `PROXY_PORT` - 代理监听端口（默认 9002）
- `LLM_TARGET` - 目标 LLM API 地址（默认 http://localhost:1234）

**使用方式**：
1. 启动代理：`cd viz-proxy && PROXY_PORT=9002 LLM_TARGET=http://localhost:1234 npm start`
2. 配置 OpenClaw 将 LLM API 端点改为 `http://localhost:9002`
3. 所有 LLM 请求都会被代理拦截并存储

### 前端可视化 ✅ 90%

**技术栈**：Vite + React + TypeScript + React Flow

**已实现功能**：
- ✅ WebSocket 连接管理（自动重连）
- ✅ **历史事件加载** - 启动时从 REST API 加载历史事件
- ✅ 时间线视图 - 按时间顺序显示所有事件
- ✅ **Context Window 视图** - 可视化显示每次 LLM 调用的完整上下文排布
  - Token 使用进度条（百分比 + 颜色标识）
  - 消息列表（system/user/assistant 按角色着色）
  - Thinking 内容高亮显示
  - Token 统计（input/output/cache）
  - 可用工具列表
- ✅ **真实 Context 视图** - 基于代理数据源，显示 LLM 实际收到的完整请求
  - 完整 messages 列表（含字符数统计）
  - 完整 tools 定义 JSON（可展开/收起）
  - 请求参数（model、stream、max_tokens 等）
  - Token 使用统计（input/output/total）
  - 请求耗时
- ✅ 工具调用流程图 - 使用 React Flow 展示工具调用链
- ✅ 状态监控面板 - 会话列表和最近事件
- ✅ 事件详情面板 - 点击事件查看完整数据
- ✅ 连接状态指示器
- ✅ 事件统计显示
- ✅ 事件去重（避免 WebSocket 和 REST API 重复）

**待实现功能**：
- ❌ 历史回放功能
- ❌ 事件过滤和搜索
- ❌ Token 使用统计图表
- ❌ 深色/浅色主题切换

---

## 三、已知问题

| 问题 | 影响 | 解决方案 |
|------|------|----------|
| **Hook 方式无法获取完整 request body** | Context Window 缺少 tools 定义、请求参数等 | 🆕 改用代理方案拦截 LLM API 请求 |
| `message_received` 事件无 `sessionId` | 用户消息匹配困难 | 已从 `llm_input.prompt` 获取用户消息 |

---

## 四、已解决问题

| 问题 | 解决方案 |
|------|----------|
| 插件加载方式 | OpenClaw 插件系统 + `plugins.load.paths` |
| 插件不被 gateway 加载 | manifest 添加 `activation.onCapabilities: ["hook"]` |
| hooks 被阻止 | 配置 `hooks.allowConversationAccess: true` |
| 配置 schema 报错 | 自定义配置放在 `config` 子字段内 |
| 端口占用 | `lsof -ti:9000 \| xargs kill -9` |
| 会话 ID 关联 | 通过 hooks 获取 `sessionId`/`sessionKey`/`runId` |
| 前端不接收事件 | 测试服务器添加事件广播功能 |
| Context Window 组件崩溃 | 添加空值检查和 try-catch 保护 |
| Context Window 无数据 | 修复事件类型匹配和数据解析逻辑 |

---

## 四、待完成任务

### 高优先级

1. **前端增强**
   - [ ] 事件过滤和搜索（按类型/时间/会话）
   - [ ] Token 使用统计图表
   - [ ] 历史回放功能

2. **完善 I/O 监控**
   - [ ] 网络请求详情（URL、方法、状态码）
   - [ ] 数据库操作监控

### 中优先级

3. **完善决策过程**
   - [ ] 自我修正/反思记录
   - [ ] 多步推理中间结果提取

4. **配置优化**
   - [ ] 监控项开关配置
   - [ ] 内容采样策略（full/truncated/hash）
   - [ ] 隐私保护（敏感数据脱敏）

### 低优先级

5. **性能优化**
   - [ ] 事件批量发送
   - [ ] 大内容压缩
   - [ ] 内存使用优化

6. **深色/浅色主题切换**

---

## 五、测试验证

### 测试命令

```bash
# 1. 编译插件
cd openclaw-viz-plugin && npm run build

# 2. 启动持久化后端
cd viz-backend && npm start

# 3. 重启 gateway
openclaw gateway restart

# 4. 启动前端
cd viz-frontend && npm run dev

# 5. 发送测试消息
openclaw agent -m "请帮我读取 /etc/hostname 文件内容，然后计算 2+3*4 等于多少？" --session-id test-001

# 6. 查看前端
# 访问 http://localhost:3000

# 7. 验证持久化
curl http://localhost:9001/api/stats
curl http://localhost:9001/api/sessions
curl http://localhost:9001/api/sessions/test-001/events
```

### 最近测试结果

测试消息：`"请帮我读取 /etc/hostname 文件内容，然后计算 2+3*4 等于多少？"`

**捕获事件数**：18 个

| 事件类型 | 数量 | 说明 |
|----------|------|------|
| `llm_input` | 1 | LLM 输入 |
| `llm_output` | 1 | LLM 输出（含 usage） |
| `model_call_started` | 2 | 模型调用开始 |
| `model_call_ended` | 2 | 模型调用结束 |
| `before_tool_call` | 2 | 工具调用前（read + exec） |
| `after_tool_call` | 2 | 工具调用后（含结果） |
| `agent_state_change` | 8 | 状态变化 |

**工具调用详情**：
- `read` (file_read) - 读取 `/etc/hostname`，结果：`lm-pc`
- `exec` (exec) - 执行 `echo "$((2 + 3 * 4))"`，结果：`14`

---

## 六、关键配置

### OpenClaw 配置 (`~/.openclaw/openclaw.json`)

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
          "contentCapture": true
        }
      }
    }
  }
}
```

### 日志查看

```bash
# Gateway 日志
journalctl --user -u openclaw-gateway -f | grep -i "viz\|agent-viz"

# 文件日志
grep "agent-viz" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log

# 后端服务日志
# 直接查看 viz-backend 终端输出
```

### 后端运行

```bash
cd viz-backend && npm start
# REST API: http://localhost:9001/api
# WebSocket: ws://localhost:9001/ws
# 数据库: viz-backend/data/events.db
```

### 前端运行

```bash
cd viz-frontend && npm run dev
# 访问 http://localhost:3000
```
