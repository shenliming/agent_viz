# Agent Viz 验证指南

## 验证步骤

### 步骤 1: 编译插件

```bash
cd /home/shenliming/git/agent_viz/openclaw-viz-plugin
npm install
npm run build
```

预期结果：`dist/` 目录下生成编译后的 JS 文件。

### 步骤 2: 启动测试服务器

```bash
cd /home/shenliming/git/agent_viz/test-server
npm start
```

预期输出：
```
[test-server] Agent Viz 测试服务器启动在 ws://localhost:9000
[test-server] 等待插件连接...
```

### 步骤 3: 安装插件到 OpenClaw

有两种方式加载插件：

**方式 A: 通过 `plugins.load.paths` 配置（推荐开发时使用）**

在 `~/.openclaw/openclaw.json` 中添加插件路径：

```json
{
  "plugins": {
    "load": {
      "paths": ["/home/shenliming/git/agent_viz/openclaw-viz-plugin"]
    },
    "entries": {
      "agent-viz": {
        "enabled": true,
        "config": {
          "endpoint": "ws://localhost:9000",
          "contentCapture": true
        }
      }
    }
  }
}
```

**方式 B: 通过环境变量（适合全局加载）**

```bash
export OPENCLAW_BUNDLED_PLUGINS_DIR=/home/shenliming/git/agent_viz/openclaw-viz-plugin
```

### 步骤 4: 配置 OpenClaw

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "plugins": {
    "entries": {
      "agent-viz": {
        "enabled": true,
        "config": {
          "endpoint": "ws://localhost:9000",
          "contentCapture": true
        }
      }
    }
  }
}
```

### 步骤 5: 启动 OpenClaw 并触发事件

```bash
# 启动 OpenClaw
openclaw

# 或通过源码启动
cd /home/shenliming/git/openclaw
npm start
```

然后发送一条消息给 OpenClaw，触发 Agent 执行。

### 步骤 6: 观察测试服务器输出

如果插件工作正常，测试服务器会显示类似以下输出：

```
[test-server] ✓ 插件已连接!

────────────────────────────────────────────────────────────
[1] 14:30:25 | session_start
    Session: session-abc123
    Run: -

────────────────────────────────────────────────────────────
[2] 14:30:25 | message_received
    Session: session-abc123
    Run: -
    Channel: webchat, From: user-123
    Content: 你好，帮我创建一个文件

────────────────────────────────────────────────────────────
[3] 14:30:26 | model_call_started
    Session: session-abc123
    Run: run-xyz789
    Provider: anthropic/claude-sonnet-4-20250514

────────────────────────────────────────────────────────────
[4] 14:30:26 | llm_input
    Session: session-abc123
    Run: run-xyz789
    Provider: anthropic/claude-sonnet-4-20250514
    History Messages: 2

────────────────────────────────────────────────────────────
[5] 14:30:28 | llm_output
    Session: session-abc123
    Run: run-xyz789
    Provider: anthropic/claude-sonnet-4-20250514
    Usage: {"input":1234,"output":567,"total":1801}

────────────────────────────────────────────────────────────
[6] 14:30:28 | model_call_ended
    Session: session-abc123
    Run: run-xyz789
    Outcome: success, Duration: 2150ms

────────────────────────────────────────────────────────────
[7] 14:30:28 | before_tool_call
    Session: session-abc123
    Run: run-xyz789
    Tool: write_file
    Params: {"path":"/tmp/test.txt","content":"Hello"}

────────────────────────────────────────────────────────────
[8] 14:30:29 | after_tool_call
    Session: session-abc123
    Run: run-xyz789
    Tool: write_file, Status: success
    Duration: 45ms

════════════════════════════════════════════════════════════
[统计] 总事件数: 8
[统计] 事件类型分布:
  - session_start: 1
  - message_received: 1
  - model_call_started: 1
  - llm_input: 1
  - llm_output: 1
  - model_call_ended: 1
  - before_tool_call: 1
  - after_tool_call: 1
════════════════════════════════════════════════════════════
```

## 验证检查清单

- [ ] 插件编译成功（`dist/` 目录存在）
- [ ] 测试服务器启动成功（监听 9000 端口）
- [ ] 插件连接到测试服务器（显示 `✓ 插件已连接!`）
- [ ] 收到 `session_start` 事件
- [ ] 收到 `message_received` 事件
- [ ] 收到 `model_call_started` 事件
- [ ] 收到 `llm_input` 事件
- [ ] 收到 `llm_output` 事件
- [ ] 收到 `model_call_ended` 事件
- [ ] 收到 `before_tool_call` 事件（如果 Agent 使用了工具）
- [ ] 收到 `after_tool_call` 事件（如果 Agent 使用了工具）
- [ ] 收到 `session_end` 事件（会话结束时）

## 故障排查

### 插件未连接

1. 检查 OpenClaw 日志中是否有插件加载错误
2. 确认 `openclaw.plugin.json` 格式正确
3. 确认插件文件在正确的目录

### 未收到事件

1. 确认 `openclaw.json` 中插件配置正确
2. 确认 `enabled: true`
3. 确认 WebSocket 端点地址正确
4. 检查 OpenClaw 日志中是否有插件相关错误

### 事件格式不正确

1. 检查插件编译是否成功
2. 检查 TypeScript 类型定义是否正确
3. 查看测试服务器原始数据输出
