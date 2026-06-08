# Agent 内部流程可视化 — 详细设计与实现计划

## 一、设计原则

1. **模块化**：每个功能独立成模块，通过明确定义的接口通信
2. **可测试**：核心逻辑纯函数，不依赖外部状态，易于单元测试
3. **可复用**：通用工具函数抽离，避免重复代码
4. **渐进增强**：核心功能仅依赖 proxy 数据，plugin 数据作为可选增强
5. **向后兼容**：不破坏现有 API 和组件

---

## 二、模块划分

```
viz-backend/
├── lib/
│   ├── loop-analyzer.js      # 循环分析器（核心）
│   ├── message-parser.js     # 消息解析器
│   ├── loop-types.js         # 循环类型推断
│   └── token-stats.js        # Token 统计
├── routes/
│   └── loops.js              # REST API 路由
├── test/
│   ├── loop-analyzer.test.js
│   ├── message-parser.test.js
│   ├── loop-types.test.js
│   └── token-stats.test.js
└── server.js                 # 主入口（新增路由注册）

viz-frontend/src/
├── types/
│   └── loop.ts               # 循环相关类型定义
├── api/
│   └── loops.ts              # API 客户端
├── components/
│   ├── LoopView.tsx          # 循环视图主组件
│   ├── LoopCard.tsx          # 单个循环卡片
│   ├── LoopDetailModal.tsx   # 循环详情弹窗
│   └── TokenChart.tsx        # Token 使用量图表
└── utils/
    └── format.ts             # 复用现有格式化工具
```

---

## 三、模块详细设计

### 模块 1: message-parser.js

**职责**：从 LLM request/response 中提取结构化信息

**抽象接口**：

```javascript
/**
 * 从 messages 数组中提取最后一次 assistant 消息（思考内容）
 * @param {Array} messages - OpenAI 格式的 messages 数组
 * @returns {Object} { content: string, hasToolResults: boolean }
 */
function extractLastAssistantMessage(messages)

/**
 * 从 response 中提取 tool_calls
 * @param {Object} response - LLM response 对象
 * @returns {Array} [{ id, name, arguments }]
 */
function extractToolCalls(response)

/**
 * 从 messages 中提取 tool results（observation）
 * @param {Array} messages - OpenAI 格式的 messages 数组
 * @returns {Array} [{ toolCallId, toolName, content }]
 */
function extractToolResults(messages)

/**
 * 从 response 中提取 token usage
 * @param {Object} response - LLM response 对象
 * @returns {Object} { inputTokens, outputTokens, totalTokens }
 */
function extractTokenUsage(response)
```

**设计特点**：
- 纯函数，无副作用
- 不依赖数据库或网络
- 输入输出都是普通 JS 对象
- 易于 mock 和测试

**测试策略**：
- 测试各种 response 格式（有 tool_calls、无 tool_calls、流式、非流式）
- 测试边界情况（空 messages、null content）

---

### 模块 2: loop-analyzer.js

**职责**：将 LLM 调用序列转换为结构化的循环序列

**抽象接口**：

```javascript
/**
 * 分析 LLM 调用序列，构建循环结构
 * @param {Array} llmCalls - 从 proxy.db 读取的 LLM 调用记录
 * @param {Object} options - 可选配置
 * @returns {Array} 结构化的循环数组
 */
function analyzeLoops(llmCalls, options = {})

/**
 * 获取单个循环的详细信息
 * @param {Array} llmCalls - 所有 LLM 调用记录
 * @param {number} loopIndex - 循环索引（从 1 开始）
 * @returns {Object} 循环详情
 */
function getLoopDetail(llmCalls, loopIndex)

/**
 * 获取循环统计信息
 * @param {Array} loops - 循环数组
 * @returns {Object} { totalLoops, totalDuration, avgDuration, toolUseCount, directAnswerCount }
 */
function getLoopStats(loops)
```

**核心算法**：

```
输入: [LLM Call 1, LLM Call 2, LLM Call 3, ...]
输出: [Loop 1, Loop 2, Loop 3, ...]

对每个 LLM Call:
  1. 解析 request_body → messages
  2. 解析 response_body → choices
  3. 提取 think 内容（最后一条 assistant message）
  4. 提取 tool_calls（response 中的工具调用决定）
  5. 提取 observations（messages 中的 tool results）
  6. 提取 token usage
  7. 推断循环类型（tool_use / direct_answer / error_retry）
  8. 构建 Loop 对象
```

**设计特点**：
- 核心函数 `analyzeLoops` 是纯函数
- 数据库操作由调用方负责（依赖注入）
- 支持可选的 plugin 事件增强（通过 options 传入）

**测试策略**：
- 使用 mock 的 LLM 调用数据测试循环构建
- 测试单次调用、多次调用、无 tool_calls 等场景
- 测试循环统计计算

---

### 模块 3: loop-types.js

**职责**：推断循环类型和工具选择原因

**抽象接口**：

```javascript
/**
 * 推断循环类型
 * @param {Object} loop - 循环对象
 * @returns {string} 'tool_use' | 'direct_answer' | 'error_retry'
 */
function inferLoopType(loop)

/**
 * 推断工具选择原因（从 context 中提取线索）
 * @param {Array} messages - 当前循环的 messages
 * @param {Array} toolCalls - 工具调用列表
 * @returns {string|null} 推断的原因
 */
function inferToolChoiceReason(messages, toolCalls)

/**
 * 检测是否是重试循环
 * @param {Array} loops - 循环数组
 * @param {number} currentIndex - 当前循环索引
 * @returns {boolean}
 */
function isRetryLoop(loops, currentIndex)
```

**设计特点**：
- 纯函数，基于规则推断
- 可后续扩展为 LLM 辅助推断

---

### 模块 4: token-stats.js

**职责**：Token 使用量统计和趋势分析

**抽象接口**：

```javascript
/**
 * 从 LLM 调用序列中提取 token 使用趋势
 * @param {Array} llmCalls - LLM 调用记录
 * @returns {Array} [{ loopIndex, inputTokens, outputTokens, totalTokens, timestamp }]
 */
function extractTokenTrend(llmCalls)

/**
 * 计算 token 统计摘要
 * @param {Array} llmCalls - LLM 调用记录
 * @returns {Object} { totalInput, totalOutput, total, avgPerCall, maxPerCall }
 */
function getTokenSummary(llmCalls)
```

---

### 模块 5: loops.js (REST API 路由)

**职责**：提供循环分析的 HTTP API

**路由设计**：

```
GET /api/loops                    # 获取所有循环列表
GET /api/loops/:loopIndex         # 获取单个循环详情
GET /api/loops/stats              # 获取循环统计
GET /api/loops/tokens             # 获取 token 使用趋势
```

**设计特点**：
- 路由模块独立，通过 express.Router() 导出
- 数据库连接通过依赖注入
- 错误处理统一

---

### 模块 6: 前端组件

**组件树**：

```
LoopView (主容器)
├── LoopSummary (统计概览)
├── LoopList (循环列表)
│   └── LoopCard × N (单个循环卡片)
│       ├── ThinkSection (思考内容)
│       ├── ToolCallBadges (工具调用标签)
│       └── ObservationPreview (观察结果预览)
└── LoopDetailModal (详情弹窗)
    ├── MessageList (消息列表)
    ├── ResponseDetail (响应详情)
    └── ToolExecutionDetail (工具执行详情)

TokenChart (独立图表组件)
├── TokenTrendLine (趋势折线图)
└── TokenSummaryCard (统计卡片)
```

**数据流**：

```
LoopView
  ↓ (useEffect)
fetch('/api/loops')
  ↓
setLoops(data)
  ↓ (render)
LoopSummary + LoopList
  ↓ (click)
LoopDetailModal
```

---

## 四、实现顺序

### Phase 1: 后端核心模块（可独立测试）

1. **message-parser.js** + 单元测试
2. **loop-types.js** + 单元测试
3. **loop-analyzer.js** + 单元测试
4. **token-stats.js** + 单元测试

### Phase 2: 后端 API

5. **loops.js** (REST API 路由)
6. 集成到 server.js

### Phase 3: 前端组件

7. **类型定义** (loop.ts)
8. **API 客户端** (loops.ts)
9. **LoopCard.tsx** (循环卡片)
10. **LoopView.tsx** (循环视图)
11. **LoopDetailModal.tsx** (详情弹窗)
12. **TokenChart.tsx** (Token 图表)

### Phase 4: 集成

13. 集成到 Dashboard
14. 视图联动

---

## 五、数据结构定义

### LLM Call（从 proxy.db 读取）

```javascript
{
  id: 1,
  timestamp: 1717747200000,
  model: "gpt-4",
  request_body: '{"messages": [...], "tools": [...], ...}',  // JSON 字符串
  response_body: '{"choices": [...], "usage": {...}}',       // JSON 字符串
  status_code: 200,
  duration_ms: 2300,
  input_tokens: 2100,
  output_tokens: 300,
  total_tokens: 2400,
}
```

### Loop（分析器输出）

```javascript
{
  id: "loop-1",
  loopIndex: 1,
  startTime: 1717747200000,
  endTime: 1717747202300,
  durationMs: 2300,
  model: "gpt-4",
  
  think: {
    content: "我需要搜索今天的天气信息...",
    hasToolCall: true,
  },
  
  toolCalls: [
    {
      id: "call_abc123",
      name: "web_search",
      arguments: '{"query": "today weather"}',
    }
  ],
  
  observations: [
    {
      toolCallId: "call_abc123",
      toolName: "web_search",
      content: "Today's weather is sunny, 25°C",
    }
  ],
  
  tokenUsage: {
    inputTokens: 2100,
    outputTokens: 300,
    totalTokens: 2400,
  },
  
  inferred: {
    loopType: "tool_use",
  },
}
```

---

## 六、测试策略

### 单元测试（后端）

使用 Node.js 原生 assert 或 vitest：

```javascript
// test/message-parser.test.js
import { describe, it, expect } from 'vitest';
import { extractToolCalls, extractLastAssistantMessage } from '../lib/message-parser.js';

describe('extractToolCalls', () => {
  it('should extract tool_calls from response', () => {
    const response = {
      choices: [{
        message: {
          role: 'assistant',
          tool_calls: [{
            id: 'call_1',
            function: { name: 'web_search', arguments: '{}' }
          }]
        }
      }]
    };
    const result = extractToolCalls(response);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('web_search');
  });

  it('should return empty array when no tool_calls', () => {
    const response = {
      choices: [{
        message: { role: 'assistant', content: 'Hello' }
      }]
    };
    expect(extractToolCalls(response)).toEqual([]);
  });
});
```

### 集成测试

- 测试完整 API 端点
- 测试前端组件渲染

---

*创建时间: 2026-06-07*
