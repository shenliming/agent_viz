/**
 * Loop Types - 推断循环类型和工具选择原因
 * 
 * 纯函数模块，无副作用。
 * 基于规则推断，可后续扩展为 LLM 辅助推断。
 */

/**
 * 循环类型常量
 */
export const LoopType = {
  TOOL_USE: 'tool_use',         // 使用了工具
  DIRECT_ANSWER: 'direct_answer', // 直接回答，无工具调用
  ERROR_RETRY: 'error_retry',   // 错误重试
};

/**
 * 推断循环类型
 * 
 * @param {Object} loop - 当前循环对象
 * @param {Array} allLoops - 所有循环数组（用于检测重试）
 * @param {number} currentIndex - 当前循环索引
 * @returns {string} LoopType 之一
 */
export function inferLoopType(loop, allLoops = [], currentIndex = 0) {
  if (!loop) return LoopType.DIRECT_ANSWER;

  // 检查是否有错误重试特征
  if (isRetryLoop(allLoops, currentIndex)) {
    return LoopType.ERROR_RETRY;
  }

  // 有工具调用 → tool_use
  if (loop.toolCalls && loop.toolCalls.length > 0) {
    return LoopType.TOOL_USE;
  }

  // 无工具调用 → direct_answer
  return LoopType.DIRECT_ANSWER;
}

/**
 * 推断工具选择原因（从 context 中提取线索）
 * 
 * @param {Array} messages - 当前循环的 messages
 * @param {Array} toolCalls - 工具调用列表
 * @returns {string|null} 推断的原因
 */
export function inferToolChoiceReason(messages, toolCalls) {
  if (!toolCalls || toolCalls.length === 0) return null;
  if (!messages || messages.length === 0) return null;

  const toolNames = toolCalls.map(tc => tc.name);
  const userMessages = messages.filter(m => m.role === 'user');
  
  if (userMessages.length === 0) return null;

  // 获取最后一条用户消息
  const lastUserMessage = userMessages[userMessages.length - 1];
  const userContent = typeof lastUserMessage.content === 'string'
    ? lastUserMessage.content.toLowerCase()
    : '';

  // 基于关键词推断
  const reasons = [];

  for (const toolName of toolNames) {
    const reason = inferSingleToolReason(toolName, userContent);
    if (reason) reasons.push(reason);
  }

  return reasons.length > 0 ? reasons.join('; ') : null;
}

/**
 * 检测是否是重试循环
 * 
 * 重试循环的特征：
 * - 当前循环调用的工具与前一个循环相同
 * - 前一个循环的工具调用失败了
 * 
 * @param {Array} loops - 循环数组
 * @param {number} currentIndex - 当前循环索引
 * @returns {boolean}
 */
export function isRetryLoop(loops, currentIndex) {
  if (currentIndex <= 0 || !loops || loops.length <= 1) return false;

  const currentLoop = loops[currentIndex];
  const previousLoop = loops[currentIndex - 1];

  if (!currentLoop || !previousLoop) return false;

  // 检查前一个循环是否有失败的工具调用
  const previousFailed = previousLoop.toolCalls?.some(tc => tc.status === 'error') || false;
  if (!previousFailed) return false;

  // 检查当前循环是否调用了相同的工具
  const currentTools = new Set(currentLoop.toolCalls?.map(tc => tc.name) || []);
  const previousTools = previousLoop.toolCalls?.map(tc => tc.name) || [];

  return previousTools.some(name => currentTools.has(name));
}

// ========== 内部辅助函数 ==========

/**
 * 推断单个工具的选择原因
 */
function inferSingleToolReason(toolName, userContent) {
  const patterns = {
    web_search: {
      keywords: ['搜索', 'search', '查找', '查一下', '查询', '今天', '最新', '天气', '新闻'],
      reason: '需要外部信息',
    },
    file_read: {
      keywords: ['读', 'read', '查看文件', '打开', '内容'],
      reason: '需要读取文件内容',
    },
    file_write: {
      keywords: ['写', 'write', '保存', '创建文件', '存储'],
      reason: '需要写入文件',
    },
    file_edit: {
      keywords: ['编辑', 'edit', '修改', '替换'],
      reason: '需要编辑文件',
    },
    exec: {
      keywords: ['执行', 'run', '命令', 'command', '终端'],
      reason: '需要执行命令',
    },
    memory: {
      keywords: ['记忆', 'memory', '回忆', '之前'],
      reason: '需要访问记忆',
    },
  };

  const pattern = patterns[toolName];
  if (!pattern) return null;

  const matched = pattern.keywords.some(kw => userContent.includes(kw));
  return matched ? `${toolName}: ${pattern.reason}` : null;
}
