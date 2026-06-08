/**
 * Message Parser - 从 LLM request/response 中提取结构化信息
 * 
 * 纯函数模块，无副作用，不依赖外部状态。
 * 所有函数接收普通 JS 对象，返回普通 JS 对象。
 */

/**
 * 从 messages 数组中提取最后一次 assistant 消息（思考内容）
 * 
 * @param {Array} messages - OpenAI 格式的 messages 数组
 * @returns {Object} { content: string|null, hasToolResults: boolean }
 */
export function extractLastAssistantMessage(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { content: null, hasToolResults: false };
  }

  // 从后往前找最后一条 assistant 消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      const content = extractContent(msg.content);
      return { content, hasToolResults: hasToolResultMessages(messages) };
    }
  }

  return { content: null, hasToolResults: hasToolResultMessages(messages) };
}

/**
 * 从 response 中提取 tool_calls
 * 
 * @param {Object} response - LLM response 对象（解析后的 JSON）
 * @returns {Array} [{ id, name, arguments }]
 */
export function extractToolCalls(response) {
  if (!response || !Array.isArray(response.choices)) {
    return [];
  }

  const toolCalls = [];
  
  for (const choice of response.choices) {
    const message = choice.message || choice.delta;
    if (!message) continue;

    // OpenAI 格式
    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        toolCalls.push({
          id: tc.id || `tc-${toolCalls.length}`,
          name: tc.function?.name || tc.name || 'unknown',
          arguments: tc.function?.arguments || tc.arguments || '{}',
        });
      }
    }
  }

  return toolCalls;
}

/**
 * 从 messages 中提取 tool results（observation）
 * 
 * @param {Array} messages - OpenAI 格式的 messages 数组
 * @returns {Array} [{ toolCallId, toolName, content }]
 */
export function extractToolResults(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  const results = [];
  
  for (const msg of messages) {
    if (msg.role === 'tool' || msg.role === 'function') {
      results.push({
        toolCallId: msg.tool_call_id || msg.tool_call_id || '',
        toolName: msg.name || 'unknown',
        content: extractContent(msg.content),
      });
    }
  }

  return results;
}

/**
 * 从 response 中提取 token usage
 * 
 * @param {Object} response - LLM response 对象（解析后的 JSON）
 * @returns {Object} { inputTokens, outputTokens, totalTokens }
 */
export function extractTokenUsage(response) {
  if (!response || !response.usage) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }

  const usage = response.usage;
  return {
    inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
    outputTokens: usage.completion_tokens || usage.output_tokens || 0,
    totalTokens: usage.total_tokens || 0,
  };
}

/**
 * 从 response 中提取 assistant 的文本内容
 * 
 * @param {Object} response - LLM response 对象
 * @returns {string|null}
 */
export function extractResponseContent(response) {
  if (!response || !Array.isArray(response.choices)) {
    return null;
  }

  const choice = response.choices[0];
  const message = choice?.message || choice?.delta;
  if (!message) return null;

  return extractContent(message.content);
}

// ========== 内部辅助函数 ==========

/**
 * 提取消息内容（支持字符串或数组格式）
 */
function extractContent(content) {
  if (content == null) return null;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(c => c != null && typeof c === 'object')
      .map(c => c.text || JSON.stringify(c))
      .join('\n');
  }
  return String(content);
}

/**
 * 检查 messages 中是否包含 tool 角色的消息
 */
function hasToolResultMessages(messages) {
  return messages.some(msg => msg.role === 'tool' || msg.role === 'function');
}
