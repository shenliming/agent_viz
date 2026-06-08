import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLoops, getLoopDetail, getLoopStats } from '../lib/loop-analyzer.js';

// 辅助函数：创建 mock LLM call
function createMockCall(index, options = {}) {
  const {
    hasToolCalls = false,
    toolName = 'web_search',
    toolArgs = '{}',
    content = 'Thinking...',
    inputTokens = 1000,
    outputTokens = 200,
    durationMs = 1000,
    timestamp = Date.now() + index * 2000,
  } = options;

  const request = {
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Help me' },
    ],
  };

  if (hasToolCalls) {
    request.messages.push({
      role: 'assistant',
      content,
    });
  } else {
    request.messages.push({
      role: 'assistant',
      content: 'Here is the answer',
    });
  }

  const response = {
    choices: [{
      message: {
        role: 'assistant',
        content: hasToolCalls ? null : 'Here is the answer',
      },
    }],
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  };

  if (hasToolCalls) {
    response.choices[0].message.tool_calls = [
      {
        id: `call_${index}`,
        function: { name: toolName, arguments: toolArgs },
      },
    ];
  }

  return {
    id: index + 1,
    timestamp,
    model: 'gpt-4',
    request_body: JSON.stringify(request),
    response_body: JSON.stringify(response),
    status_code: 200,
    duration_ms: durationMs,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
  };
}

describe('analyzeLoops', () => {
  it('should return empty array for empty input', () => {
    assert.deepStrictEqual(analyzeLoops([]), []);
    assert.deepStrictEqual(analyzeLoops(null), []);
  });

  it('should build loops from LLM calls', () => {
    const calls = [
      createMockCall(0, { hasToolCalls: true }),
      createMockCall(1, { hasToolCalls: false }),
    ];
    const loops = analyzeLoops(calls);
    
    assert.strictEqual(loops.length, 2);
    assert.strictEqual(loops[0].loopIndex, 1);
    assert.strictEqual(loops[1].loopIndex, 2);
  });

  it('should identify tool_use loops', () => {
    const calls = [createMockCall(0, { hasToolCalls: true })];
    const loops = analyzeLoops(calls);
    
    assert.strictEqual(loops[0].inferred.loopType, 'tool_use');
    assert.strictEqual(loops[0].think.hasToolCall, true);
  });

  it('should identify direct_answer loops', () => {
    const calls = [createMockCall(0, { hasToolCalls: false })];
    const loops = analyzeLoops(calls);
    
    assert.strictEqual(loops[0].inferred.loopType, 'direct_answer');
    assert.strictEqual(loops[0].think.hasToolCall, false);
  });

  it('should extract token usage', () => {
    const calls = [createMockCall(0, { inputTokens: 1500, outputTokens: 300 })];
    const loops = analyzeLoops(calls);
    
    assert.strictEqual(loops[0].tokenUsage.inputTokens, 1500);
    assert.strictEqual(loops[0].tokenUsage.outputTokens, 300);
    assert.strictEqual(loops[0].tokenUsage.totalTokens, 1800);
  });

  it('should sort calls by timestamp', () => {
    const calls = [
      createMockCall(0, { timestamp: 3000 }),
      createMockCall(1, { timestamp: 1000 }),
      createMockCall(2, { timestamp: 2000 }),
    ];
    const loops = analyzeLoops(calls);
    
    assert.strictEqual(loops[0].startTime, 1000);
    assert.strictEqual(loops[1].startTime, 2000);
    assert.strictEqual(loops[2].startTime, 3000);
  });

  it('should handle malformed JSON gracefully', () => {
    const calls = [
      {
        id: 1,
        timestamp: Date.now(),
        model: 'gpt-4',
        request_body: 'invalid json',
        response_body: 'invalid json',
        duration_ms: 500,
      },
    ];
    const loops = analyzeLoops(calls);
    
    assert.strictEqual(loops.length, 1);
    assert.strictEqual(loops[0].model, 'gpt-4');
  });

  it('should handle viz-proxy raw response format', () => {
    const response = {
      choices: [{
        message: { role: 'assistant', content: 'Hello' },
      }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    };
    const calls = [
      {
        id: 1,
        timestamp: Date.now(),
        model: 'gpt-4',
        request_body: JSON.stringify({ messages: [{ role: 'assistant', content: 'Hi' }] }),
        response_body: JSON.stringify({ raw: JSON.stringify(response) }),
        duration_ms: 500,
      },
    ];
    const loops = analyzeLoops(calls);
    
    assert.strictEqual(loops[0].tokenUsage.totalTokens, 150);
  });
});

describe('getLoopDetail', () => {
  it('should return loop detail by index', () => {
    const calls = [
      createMockCall(0, { hasToolCalls: true }),
      createMockCall(1, { hasToolCalls: false }),
    ];
    
    const detail = getLoopDetail(calls, 1);
    assert.ok(detail);
    assert.strictEqual(detail.loopIndex, 1);
  });

  it('should return null for non-existent index', () => {
    const calls = [createMockCall(0)];
    const detail = getLoopDetail(calls, 99);
    assert.strictEqual(detail, null);
  });
});

describe('getLoopStats', () => {
  it('should return stats for empty loops', () => {
    const stats = getLoopStats([]);
    assert.strictEqual(stats.totalLoops, 0);
    assert.strictEqual(stats.totalDurationMs, 0);
  });

  it('should calculate correct stats', () => {
    const calls = [
      createMockCall(0, { hasToolCalls: true, durationMs: 2000, inputTokens: 1000, outputTokens: 200 }),
      createMockCall(1, { hasToolCalls: false, durationMs: 1000, inputTokens: 800, outputTokens: 300 }),
    ];
    const loops = analyzeLoops(calls);
    const stats = getLoopStats(loops);
    
    assert.strictEqual(stats.totalLoops, 2);
    assert.strictEqual(stats.totalDurationMs, 3000);
    assert.strictEqual(stats.avgDurationMs, 1500);
    assert.strictEqual(stats.toolUseCount, 1);
    assert.strictEqual(stats.directAnswerCount, 1);
    assert.strictEqual(stats.totalToolCalls, 1);
    assert.strictEqual(stats.totalTokens, 2300);
  });
});
