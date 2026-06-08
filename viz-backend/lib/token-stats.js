/**
 * Token Stats - Token 使用量统计和趋势分析
 * 
 * 纯函数模块，无副作用。
 */

/**
 * 从 LLM 调用序列中提取 token 使用趋势
 * 
 * @param {Array} llmCalls - LLM 调用记录（按时间排序）
 * @returns {Array} [{ loopIndex, inputTokens, outputTokens, totalTokens, timestamp, model }]
 */
export function extractTokenTrend(llmCalls) {
  if (!Array.isArray(llmCalls) || llmCalls.length === 0) {
    return [];
  }

  const sorted = [...llmCalls].sort((a, b) => a.timestamp - b.timestamp);

  return sorted.map((call, index) => ({
    loopIndex: index + 1,
    inputTokens: call.input_tokens || 0,
    outputTokens: call.output_tokens || 0,
    totalTokens: call.total_tokens || 0,
    timestamp: call.timestamp,
    model: call.model || 'unknown',
  }));
}

/**
 * 计算 token 统计摘要
 * 
 * @param {Array} llmCalls - LLM 调用记录
 * @returns {Object} { totalInput, totalOutput, total, avgPerCall, maxPerCall, minPerCall, callCount }
 */
export function getTokenSummary(llmCalls) {
  if (!Array.isArray(llmCalls) || llmCalls.length === 0) {
    return {
      totalInput: 0,
      totalOutput: 0,
      total: 0,
      avgPerCall: 0,
      maxPerCall: 0,
      minPerCall: 0,
      callCount: 0,
    };
  }

  const tokens = llmCalls.map(c => c.total_tokens || 0);
  const totalInput = llmCalls.reduce((sum, c) => sum + (c.input_tokens || 0), 0);
  const totalOutput = llmCalls.reduce((sum, c) => sum + (c.output_tokens || 0), 0);
  const total = totalInput + totalOutput;
  const callCount = llmCalls.length;

  return {
    totalInput,
    totalOutput,
    total,
    avgPerCall: Math.round(total / callCount),
    maxPerCall: Math.max(...tokens),
    minPerCall: Math.min(...tokens),
    callCount,
  };
}

/**
 * 按模型分组统计 token 使用量
 * 
 * @param {Array} llmCalls - LLM 调用记录
 * @returns {Array} [{ model, callCount, totalTokens, avgTokens }]
 */
export function getTokenByModel(llmCalls) {
  if (!Array.isArray(llmCalls) || llmCalls.length === 0) {
    return [];
  }

  const modelMap = new Map();

  for (const call of llmCalls) {
    const model = call.model || 'unknown';
    const total = call.total_tokens || 0;

    if (!modelMap.has(model)) {
      modelMap.set(model, { model, callCount: 0, totalTokens: 0 });
    }

    const entry = modelMap.get(model);
    entry.callCount++;
    entry.totalTokens += total;
  }

  return Array.from(modelMap.values()).map(entry => ({
    ...entry,
    avgTokens: Math.round(entry.totalTokens / entry.callCount),
  }));
}
