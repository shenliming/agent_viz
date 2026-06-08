/**
 * Loop Analyzer - 将 LLM 调用序列转换为结构化的循环序列
 * 
 * 纯函数模块，无副作用。
 * 数据库操作由调用方负责（依赖注入）。
 */

import {
  extractLastAssistantMessage,
  extractToolCalls,
  extractToolResults,
  extractTokenUsage,
  extractResponseContent,
} from './message-parser.js';
import { inferLoopType, inferToolChoiceReason } from './loop-types.js';

/**
 * 分析 LLM 调用序列，构建循环结构
 * 
 * @param {Array} llmCalls - 从 proxy.db 读取的 LLM 调用记录（按时间排序）
 * @param {Object} options - 可选配置
 * @returns {Array} 结构化的循环数组
 */
export function analyzeLoops(llmCalls, options = {}) {
  if (!Array.isArray(llmCalls) || llmCalls.length === 0) {
    return [];
  }

  // 确保按时间排序
  const sorted = [...llmCalls].sort((a, b) => a.timestamp - b.timestamp);
  
  const loops = [];
  
  for (let i = 0; i < sorted.length; i++) {
    const call = sorted[i];
    const loop = buildLoop(call, i, sorted);
    loops.push(loop);
  }

  // 第二轮：推断循环类型（需要完整 loops 数组）
  for (let i = 0; i < loops.length; i++) {
    loops[i].inferred.loopType = inferLoopType(loops[i], loops, i);
  }

  return loops;
}

/**
 * 获取单个循环的详细信息
 * 
 * @param {Array} llmCalls - 所有 LLM 调用记录
 * @param {number} loopIndex - 循环索引（从 1 开始）
 * @returns {Object|null} 循环详情
 */
export function getLoopDetail(llmCalls, loopIndex) {
  const loops = analyzeLoops(llmCalls);
  const target = loops.find(l => l.loopIndex === loopIndex);
  return target || null;
}

/**
 * 获取循环统计信息
 * 
 * @param {Array} loops - 循环数组
 * @returns {Object} 统计信息
 */
export function getLoopStats(loops) {
  if (!Array.isArray(loops) || loops.length === 0) {
    return {
      totalLoops: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      toolUseCount: 0,
      directAnswerCount: 0,
      errorRetryCount: 0,
      totalToolCalls: 0,
      totalTokens: 0,
    };
  }

  const totalDurationMs = loops.reduce((sum, l) => sum + (l.durationMs || 0), 0);
  const toolUseCount = loops.filter(l => l.inferred.loopType === 'tool_use').length;
  const directAnswerCount = loops.filter(l => l.inferred.loopType === 'direct_answer').length;
  const errorRetryCount = loops.filter(l => l.inferred.loopType === 'error_retry').length;
  const totalToolCalls = loops.reduce((sum, l) => sum + (l.toolCalls?.length || 0), 0);
  const totalTokens = loops.reduce((sum, l) => sum + (l.tokenUsage?.totalTokens || 0), 0);

  return {
    totalLoops: loops.length,
    totalDurationMs,
    avgDurationMs: Math.round(totalDurationMs / loops.length),
    toolUseCount,
    directAnswerCount,
    errorRetryCount,
    totalToolCalls,
    totalTokens,
  };
}

// ========== 内部辅助函数 ==========

/**
 * 解析 SSE 流式响应，合并为一个完整的 response 对象
 * 从流式 chunks 中提取 tool_calls 和 content
 */
function parseStreamingResponse(rawText) {
  if (!rawText) return null;

  const lines = rawText.split('\n');
  const merged = {
    id: '',
    model: '',
    choices: [],
    usage: null,
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) continue;

    const dataStr = trimmed.slice(6);
    if (dataStr === '[DONE]') continue;

    try {
      const chunk = JSON.parse(dataStr);

      if (chunk.id) merged.id = chunk.id;
      if (chunk.model) merged.model = chunk.model;
      if (chunk.usage) merged.usage = chunk.usage;

      if (Array.isArray(chunk.choices)) {
        for (const choice of chunk.choices) {
          const idx = choice.index || 0;
          if (!merged.choices[idx]) {
            merged.choices[idx] = {
              index: idx,
              message: { role: 'assistant', content: '', tool_calls: [] },
            };
          }

          const delta = choice.delta;
          if (!delta) continue;

          // 合并 content
          if (delta.content) {
            merged.choices[idx].message.content += delta.content;
          }

          // 合并 tool_calls（流式可能分段）
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const tcIdx = tc.index ?? 0;
              if (!merged.choices[idx].message.tool_calls[tcIdx]) {
                merged.choices[idx].message.tool_calls[tcIdx] = {
                  id: tc.id || '',
                  type: tc.type || 'function',
                  function: { name: '', arguments: '' },
                };
              }
              const existing = merged.choices[idx].message.tool_calls[tcIdx];
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name += tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            }
          }

          // 非流式的 finish_reason 标记
          if (choice.finish_reason) {
            merged.choices[idx].finish_reason = choice.finish_reason;
          }
        }
      }
    } catch {
      // 跳过无法解析的行
    }
  }

  return merged.choices.length > 0 ? merged : null;
}

/**
 * 从单个 LLM 调用构建循环对象
 */
function buildLoop(call, index, allCalls) {
  let request = null;
  let response = null;

  try {
    request = typeof call.request_body === 'string'
      ? JSON.parse(call.request_body)
      : call.request_body;
  } catch {
    request = null;
  }

  try {
    response = typeof call.response_body === 'string'
      ? JSON.parse(call.response_body)
      : call.response_body;
    
    // 处理 viz-proxy 存储的 { raw: "..." } 格式
    if (response && response.raw) {
      response = parseStreamingResponse(response.raw);
    }
  } catch {
    response = null;
  }

  const messages = request?.messages || [];
  const think = extractLastAssistantMessage(messages);
  const toolCalls = extractToolCalls(response);
  const observations = extractToolResults(messages);
  const tokenUsage = extractTokenUsage(response);
  const responseContent = extractResponseContent(response);

  const durationMs = call.duration_ms || 0;
  const timestamp = call.timestamp || Date.now();

  return {
    id: `loop-${index + 1}`,
    loopIndex: index + 1,
    startTime: timestamp,
    endTime: timestamp + durationMs,
    durationMs,
    model: call.model || request?.model || 'unknown',
    
    think: {
      content: think.content || responseContent,
      hasToolCall: toolCalls.length > 0,
    },
    
    toolCalls: toolCalls.map(tc => ({
      ...tc,
      arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
    })),
    
    observations,
    
    tokenUsage,
    
    inferred: {
      loopType: 'unknown', // 第二轮填充
      toolChoiceReason: inferToolChoiceReason(messages, toolCalls),
    },
  };
}
