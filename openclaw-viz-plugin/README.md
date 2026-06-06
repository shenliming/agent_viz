# Agent Viz - OpenClaw 可视化监控插件

通过 OpenClaw 插件系统的 Hooks 机制，非侵入式地监控和记录 Agent 的工作过程。

## 监控能力

- **LLM 调用**：输入/输出/usage/耗时
- **工具调用**：参数/结果/耗时
- **上下文压缩**：压缩前后对比
- **会话生命周期**：创建/结束
- **消息收发**：用户消息/Agent 回复

---

## OpenClaw 插件开发关键配置

### 1. 插件 Manifest (`openclaw.plugin.json`)

```json
{
  "id": "agent-viz",
  "name": "Agent Viz",
  "version": "0.1.0",
  "description": "可视化监控 OpenClaw Agent 工作过程的插件",
  "main": "dist/index.js",
  "kind": "extension",
  "configSchema": {
    "type": "object",
    "properties": {
      "endpoint": { "type": "string", "default": "ws://localhost:9000" },
      "contentCapture": { "type": "boolean", "default": true }
    }
  },
  "activation": {
    "onCapabilities": ["hook"]
  },
  "openclaw": {
    "minVersion": "1.0.0"
  }
}
```

**关键字段说明**：

| 字段 | 说明 |
|------|------|
| `kind` | 插件类型：`extension`（扩展）、`channel`（通道）等 |
| `main` | 入口文件路径（相对于插件根目录） |
| `configSchema` | 自定义配置的 JSON Schema，**必须声明** |
| `activation.onCapabilities` | 声明插件能力，**hooks 插件必须设为 `["hook"]`** |
| `openclaw.minVersion` | 最低兼容的 OpenClaw 版本 |

### 2. OpenClaw 主配置 (`~/.openclaw/openclaw.json`)

```json
{
  "plugins": {
    "load": {
      "paths": ["/path/to/your/plugin"]
    },
    "entries": {
      "agent-viz": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true
        },
        "config": {
          "endpoint": "ws://localhost:9000",
          "contentCapture": true
        }
      }
    }
  }
}
```

**关键字段说明**：

| 字段 | 说明 |
|------|------|
| `plugins.load.paths` | 插件目录路径，OpenClaw 会在此目录下查找 `openclaw.plugin.json` |
| `plugins.entries.<id>.enabled` | 是否启用该插件 |
| `plugins.entries.<id>.hooks.allowConversationAccess` | **非内置 hooks 插件必须设为 `true`**，否则 `llm_input`/`llm_output` hooks 会被阻止 |
| `plugins.entries.<id>.config` | 自定义配置，**必须放在 `config` 子字段内**，直接放在插件 entry 下会被 schema 拒绝 |

### 3. 插件入口 (`src/index.ts`)

```typescript
import type { OpenClawPluginApi } from "./types.js";

export function register(api: OpenClawPluginApi): void {
  const { config, logger, on } = api;

  // 读取配置
  const pluginEntry = config.plugins?.entries?.["agent-viz"] as Record<string, unknown> | undefined;
  const pluginConfig = (pluginEntry?.config as Record<string, unknown>) ?? {};

  // 注册 hooks
  on("llm_input", async (event) => { ... });
  on("llm_output", async (event) => { ... });
  on("model_call_started", async (event) => { ... });
  on("model_call_ended", async (event) => { ... });
}
```

**关键 API**：

| API | 说明 |
|-----|------|
| `api.on(hookName, handler)` | 注册生命周期 hook |
| `api.logger` | 插件日志器（日志会出现在 gateway 日志中） |
| `api.config` | 完整配置对象 |
| `api.resolvePath` | 解析插件内相对路径 |

---

## 如何使用本插件进行监控

### 架构

```
用户消息 → OpenClaw Gateway → agent-viz 插件 (hooks) → WebSocket → 监控服务器
```

### 1. 编译插件

```bash
cd /home/shenliming/git/agent_viz/openclaw-viz-plugin
npm run build
```

### 2. 启动监控服务器

```bash
# 前台运行（实时查看事件）
cd /home/shenliming/git/agent_viz/test-server
node server.js

# 后台运行
cd /home/shenliming/git/agent_viz/test-server
nohup node server.js > /tmp/test-server.log 2>&1 &
```

### 3. 重启 Gateway 使插件生效

```bash
openclaw gateway restart
```

### 4. 触发 Agent 交互

```bash
# 方式一：CLI 发送消息
openclaw agent -m "你好，请帮我计算 1+1" --session-id test-001

# 方式二：通过已配置的通道（Telegram/WhatsApp/Discord 等）发送消息
```

### 5. 查看监控事件

```bash
# 如果后台运行，查看日志
tail -f /tmp/test-server.log

# 如果前台运行，直接在终端查看
```

### 6. 停止监控服务器

```bash
# 查找并杀掉进程
lsof -ti:9000 | xargs kill -9

# 或者如果用 nohup 启动
pkill -f "node server.js"
```

---

## 日志查看

### Gateway 日志（包含插件加载和 hook 注册信息）

```bash
# 查看最近日志
journalctl --user -u openclaw-gateway -n 50 --no-pager

# 实时跟踪
journalctl --user -u openclaw-gateway -f

# 只看插件相关日志
journalctl --user -u openclaw-gateway -f | grep -i "viz\|agent-viz\|plugin"
```

### 文件日志

```bash
# OpenClaw 主日志
cat /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log

# 只看插件相关
grep "agent-viz" /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log
```

### 常见日志关键字

| 关键字 | 含义 |
|--------|------|
| `[agent-viz] 初始化可视化插件` | 插件 register 函数被调用 |
| `[agent-viz] 连接到可视化后端` | WebSocket 连接中 |
| `[agent-viz] 已连接到可视化后端` | WebSocket 连接成功 |
| `[agent-viz] 所有监控 hooks 已注册完成` | hooks 注册成功 |
| `typed hook "xxx" blocked` | hook 被阻止，需要配置 `allowConversationAccess` |
| `plugin not found` | 插件路径配置错误 |

---

## 常见问题

### Q: 插件没有被加载？

1. 检查 `plugins.load.paths` 是否指向包含 `openclaw.plugin.json` 的目录
2. 检查 manifest 中是否有 `activation.onCapabilities: ["hook"]`
3. 查看 gateway 日志确认插件是否出现在加载列表中

### Q: hooks 被阻止？

日志中出现 `typed hook "xxx" blocked because non-bundled plugins must set...`

**解决**：在配置中添加：
```json
"hooks": {
  "allowConversationAccess": true
}
```

### Q: 配置报错 "Unrecognized keys"？

自定义配置必须放在 `config` 子字段内：
```json
// 错误
"agent-viz": {
  "enabled": true,
  "endpoint": "ws://localhost:9000"
}

// 正确
"agent-viz": {
  "enabled": true,
  "config": {
    "endpoint": "ws://localhost:9000"
  }
}
```

### Q: 端口 9000 被占用？

```bash
lsof -ti:9000 | xargs kill -9
```
