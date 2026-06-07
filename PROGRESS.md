# Agent 可视化监控系统 - 项目进度

> 最后更新：2026-06-07

---

## 整体进度：~85%

| 模块 | 进度 | 状态 |
|------|------|------|
| 代理层（LLM 请求拦截） | 95% | ✅ 完成 |
| 数据采集层（OpenClaw 插件） | 85% | ✅ 基本完成 |
| 传输层（WebSocket） | 90% | ✅ 完成 |
| 后端服务（存储/API） | 85% | ✅ 完成 |
| 前端可视化（Web UI） | 85% | ✅ 核心完成 |

---

## 架构：双层数据采集

```
代理层 (viz-proxy)      → "LLM 收到/返回了什么" → 通用，跨框架
插件层 (openclaw-plugin) → "Agent 内部在做什么"  → 框架特有
```

两者互补，不可替代。详见 [requirements.md](requirements.md)。

---

## 下一步计划（对齐 requirements.md 优先级）

### P0 - 核心功能补齐

1. **独立错误/异常事件高亮展示**
   - [ ] 后端接收 `error` 事件并持久化
   - [ ] 前端新增 error 类型事件过滤和红色高亮

2. **网络请求详情（URL/方法/状态码）**
   - [ ] 从 web_fetch 等工具参数中提取
   - [ ] 前端工具调用面板展示

3. **Token 使用统计图表**
   - [ ] session 级 token 消耗趋势折线图

### P1 - 增强分析能力

4. **自我修正/反思记录**
   - [ ] 分析连续 assistant 消息流，检测 "reflection" / "correction" 等模式

5. **多 Session 对比视图**
   - [ ] 支持同时打开 2-4 个 session 的时间线并排对比

6. **Prompt 变更追踪**
   - [ ] 检测同一 session 中 system prompt 或 tool schema 的变更，高亮 diff

### P2 - 工程与扩展

7. **内容采样策略和隐私脱敏**
   - [ ] 支持 full / truncated / hash-only 三档采样
   - [ ] 正则脱敏敏感字段

8. **性能优化（批量发送、大内容压缩）**
   - [ ] WebSocket 批量 flush
   - [ ] 大 content gzip 压缩
   - [ ] 后端写入缓冲队列

9. **容错降级设计**
   - [ ] viz-backend 离线时插件本地环形缓冲 + 重连补发
   - [ ] viz-proxy 拦截失败时直通不阻断 LLM 调用

10. **LangChain/其他框架适配器**
    - [ ] 基于统一事件 Schema 和适配器模板实现

### P3 - 高级功能

11. **ReAct 循环可视化**
    - [ ] 将 thinking → tool_call → observation → thinking 的循环渲染为 ReactFlow 子图

12. **历史回放功能（逐步重放事件）**
    - [ ] 时间线拖拽进度条、倍速播放、单步前进/后退

13. **数据导出/分享**
    - [ ] session 数据导出为 JSON / Markdown 报告
    - [ ] 生成可分享链接（含数据脱敏选项）

14. **Hook vs Proxy 数据对比视图**
    - [ ] 并排展示插件采集的 messages 和代理拦截的实际 request body

---

## 一、代理层 (viz-proxy) ✅ 95%

### 架构

```
OpenClaw → viz-proxy (9002) → LLM API
                ↓
         捕获完整 request/response body
                ↓
          存储到 SQLite + WS 推送前端
```

### 已实现

- [x] HTTP 代理拦截完整 request/response
- [x] SQLite 存储（messages、tools、usage、duration）
- [x] 流式和非流式响应兼容
- [x] REST API 查询历史请求（GET /api/requests?limit=&offset=）
- [x] WebSocket 广播实时请求
- [x] 统计端点（总请求数、token、模型分布）

### API 端点

- `GET /api/requests` - 获取 LLM 请求记录（`?limit=&offset=`）
- `GET /api/stats` - 统计（总请求数、token、模型分布）
- `DELETE /api/requests` - 清空数据
- `WebSocket /ws` - 实时请求推送

### 待完善

- [ ] response_body 解析 assistant 文本（当前只存 raw）

---

## 二、监控能力完成度

### 1. Context Window 监控 ✅ 95%

| 需求 | 状态 | 实现 |
|------|------|------|
| 完整 prompt | ✅ | `llm_input` + `llm_proxy_request`（代理） |
| System prompt | ✅ | `systemPrompt` 字段 |
| History messages | ✅ | `historyMessages` 数组 |
| Assistant messages | ✅ | `assistantTexts` + `fullAssistantText` |
| Context window 使用量 | ✅ | `contextTokenBudget` + token 进度条 |
| 上下文截断事件 | ✅ | `before_compaction` / `after_compaction` |
| 完整 tools JSON schema | ✅ | 代理 `llm_proxy_request` |
| 可视化排布 | ✅ | Context Window + 真实 Context 视图 |

### 2. I/O 读写记录 ⚠️ 40%

| 需求 | 状态 | 说明 |
|------|------|------|
| 文件读写操作 | ✅ | 工具分类识别 `file_read`/`file_write`/`file_edit`，提取路径 |
| 网络请求 | ⚠️ | 工具分类识别 `network`，缺少 URL/状态详情 |
| 数据库操作 | ❌ | 未实现 |

### 3. 工具调用 ✅ 85%

| 需求 | 状态 | 实现 |
|------|------|------|
| 工具名称 | ✅ | `toolName` 字段 |
| 参数 | ✅ | `params` 字段 |
| 返回值 | ✅ | `result` 字段（含截断处理） |
| 调用耗时 | ✅ | `durationMs` 字段 |
| 工具调用链 | ✅ | `runId` 关联 + ReactFlow 流程图（7 色分类） |
| Session 关联 | ✅ | 通过 `session-context.ts` 的 runId→sessionId 映射 |

### 4. 状态变化 ✅ 80%

| 需求 | 状态 | 实现 |
|------|------|------|
| Agent 当前状态 | ✅ | `agent_state_change`（idle/thinking/executing/waiting/compacting/terminated） |
| 会话状态变化 | ✅ | `session_start` / `session_end` |
| 错误/异常事件 | ⚠️ | 有 `errorCategory`/`failureKind`，缺少前端高亮 |

### 5. 决策过程/思考链 ✅ 75%

| 需求 | 状态 | 说明 |
|------|------|------|
| thinking tags | ✅ | `thinkingMessages` + `thinkingContent`，Context Window 高亮 |
| 多步推理中间结果 | ⚠️ | 通过 `historyMessages` 间接获取 |
| 自我修正/反思 | ❌ | 未专门实现 |

### 6. Token 使用统计 ✅ 85%

| 需求 | 状态 | 实现 |
|------|------|------|
| 每次调用 input/output | ✅ | `usage` 字段 |
| 累计 token 消耗 | ✅ | transport 层 session 级累计 |
| 成本估算 | ✅ | `estimateCost` 函数 |
| 可视化进度条 | ✅ | Context Window 视图中显示 token 占比 |
| 趋势图表 | ❌ | 待实现 |

---

## 三、技术实现完成度

### 代理层 (viz-proxy) ✅ 95%

**关键文件**：`viz-proxy/server.js`

**功能**：
- HTTP 代理拦截 → 构建目标请求 → 捕获 request/response body → SQLite 存储
- 支持流式响应（从 `data: [DONE]` 行提取 usage）
- WebSocket 广播 `llm_proxy_request` 事件

### 数据采集层 (openclaw-viz-plugin) ✅ 85%

**已注册 Hooks**（13 个）：
- `model_call_started` / `model_call_ended` — 模型调用生命周期
- `llm_input` / `llm_output` — LLM 内容（prompt/response/usage/thinking）
- `before_tool_call` / `after_tool_call` — 工具调用（参数/结果/分类/文件路径）
- `before_compaction` / `after_compaction` — 上下文压缩
- `session_start` / `session_end` — 会话生命周期
- `message_received` / `message_sent` — 消息收发
- 状态推断（state-monitor.ts）— 基于上述 hooks 推断 Agent 状态

**关键文件**：
```
openclaw-viz-plugin/src/hooks/
├── session-context.ts   ← sessionKey/runId → sessionId 共享映射 ✅ 新增
├── model-call.ts        ← 模型调用监控 + 映射填充
├── llm-content.ts       ← LLM 内容监控（含 thinking）
├── tool-call.ts         ← 工具调用监控（分类/路径提取/session关联）✅ 修复
├── compaction.ts        ← 上下文压缩监控
├── session.ts           ← 会话生命周期 + 映射填充
├── message.ts           ← 消息收发监控
└── state-monitor.ts     ← Agent 状态推断 ✅ 修复 sessionKey/sessionId 混用
```

### 传输层 ✅ 90%

**功能**：
- WebSocket 连接管理 + 自动重连（3 秒间隔）
- 事件队列（断线缓存，最大 1000 条）
- Session 级 Token 累计统计
- 成本估算

### 后端服务 (viz-backend) ✅ 85%

**技术栈**：Express + WebSocket + better-sqlite3

**已实现**：
- WebSocket 事件接收 + 持久化 + 广播
- 会话自动 upsert
- 7 个 REST API 端点
- 内存事件缓存（最近 1000 条，新连接时发送）

**API 端点**：
- `GET /api/events` — 事件列表（`?limit=&offset=&type=&sessionId=`）
- `GET /api/sessions` — 会话列表
- `GET /api/sessions/:id/events` — 指定会话事件
- `GET /api/sessions/:id/stats` — 指定会话统计
- `GET /api/stats` — 全局统计
- `DELETE /api/sessions/:id` — 删除会话
- `DELETE /api/events` — 清空数据
- `WebSocket /ws` — 实时事件推送

### 前端可视化 ✅ 85%

**技术栈**：Vite + React + TypeScript + ReactFlow

**5 个 Tab 视图**：

| Tab | 组件 | 功能 | 数据源 |
|-----|------|------|:---:|
| 时间线 | `TimelineView` | 按时间排列所有事件 | 插件事件 |
| Context Window | `ContextWindowView` | Token 进度条 + 消息列表 + thinking 高亮 | 插件 llm |
| 真实 Context | `ProxyContextWindowView` | 完整 messages + tools JSON + 请求参数 | 代理 |
| 工具调用图 | `FlowChartView` | ReactFlow 流程图（7 色分类） | 插件 tool |
| 状态面板 | `StatusPanel` | 会话列表 + 最近事件 | 插件 session/state |

**其他已实现**：连接状态指示器、历史事件加载（REST API）、事件去重、清空历史、监控开关配置

**待实现**（对齐 requirements.md）：
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

## 四、已知问题

| # | 问题 | 状态 | 说明 |
|----|------|:---:|------|
| 1 | WSL DNS 解析 github.com → 198.18.0.x | 🔴 | 导致 `web_fetch` 被 SSRF 拦截，需改 DNS 为 8.8.8.8 |
| 2 | `ProxyContextWindowView` content 数组含 null | ✅ 已修复 | 添加 null 过滤和 typesafe 访问 |
| 3 | `tool.function.name` 可能崩溃 | ✅ 已修复 | 改用 `tool?.function?.name || (tool as any)?.name` |
| 4 | 代理 response_body 未解析 assistant 文本 | 🟡 | 当前只存 raw，影响不大 |

---

## 五、已解决问题

| 问题 | 解决方案 |
|------|----------|
| state-monitor.ts sessionKey/sessionId 混用 | 创建 session-context.ts 共享映射 + resolveSessionId() |
| tool-call.ts sessionId 恒为 undefined | 通过 resolveSessionId(runId) 反查 |
| ProxyContextWindowView 无实时更新 | 添加 WebSocket 连接代理 /ws 端点 |
| 无监控开关 | monitors 8 项配置 + isEnabled() 判断 |
| 插件不被 gateway 加载 | manifest 添加 `activation.onCapabilities: ["hook"]` |
| hooks 被阻止 | 配置 `hooks.allowConversationAccess: true` |

---

## 六、测试验证

```bash
# 1. 编译插件
cd openclaw-viz-plugin && npm run build

# 2. 启动后端
cd viz-backend && npm start

# 3. 启动代理（可选）
cd viz-proxy && PROXY_PORT=9002 LLM_TARGET=http://localhost:1234 npm start

# 4. 重启 gateway
openclaw gateway restart

# 5. 启动前端
cd viz-frontend && npm run dev

# 6. 发送测试消息
openclaw agent -m "hello" --session-id test

# 7. 验证
curl http://localhost:9001/api/stats
curl http://localhost:9002/api/stats
```

---

## 七、端口总览

| 端口 | 服务 | 用途 |
|------|------|------|
| 3000 | viz-frontend | 前端可视化界面 |
| 9001 | viz-backend | 事件存储、API、WebSocket |
| 9002 | viz-proxy | LLM 请求代理拦截 |
| 9000 | test-server | 开发测试（已废弃） |
