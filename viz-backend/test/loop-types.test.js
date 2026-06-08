import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferLoopType, inferToolChoiceReason, isRetryLoop, LoopType } from '../lib/loop-types.js';

describe('inferLoopType', () => {
  it('should return tool_use when loop has tool calls', () => {
    const loop = {
      toolCalls: [{ id: 'call_1', name: 'web_search', arguments: '{}' }],
      observations: [],
    };
    assert.strictEqual(inferLoopType(loop), LoopType.TOOL_USE);
  });

  it('should return direct_answer when no tool calls', () => {
    const loop = {
      toolCalls: [],
      observations: [],
      think: { content: 'Here is the answer' },
    };
    assert.strictEqual(inferLoopType(loop), LoopType.DIRECT_ANSWER);
  });

  it('should return direct_answer for null loop', () => {
    assert.strictEqual(inferLoopType(null), LoopType.DIRECT_ANSWER);
  });

  it('should return error_retry for retry loop', () => {
    const loops = [
      {
        toolCalls: [{ id: 'call_1', name: 'web_search', status: 'error' }],
        observations: [],
      },
      {
        toolCalls: [{ id: 'call_2', name: 'web_search', arguments: '{}' }],
        observations: [],
      },
    ];
    assert.strictEqual(inferLoopType(loops[1], loops, 1), LoopType.ERROR_RETRY);
  });
});

describe('inferToolChoiceReason', () => {
  it('should infer reason for web_search', () => {
    const messages = [
      { role: 'user', content: '帮我查一下今天的天气' },
    ];
    const toolCalls = [{ id: 'call_1', name: 'web_search', arguments: '{}' }];
    const reason = inferToolChoiceReason(messages, toolCalls);
    assert.ok(reason);
    assert.ok(reason.includes('web_search'));
  });

  it('should infer reason for file_write', () => {
    const messages = [
      { role: 'user', content: '把结果保存到文件里' },
    ];
    const toolCalls = [{ id: 'call_1', name: 'file_write', arguments: '{}' }];
    const reason = inferToolChoiceReason(messages, toolCalls);
    assert.ok(reason);
    assert.ok(reason.includes('file_write'));
  });

  it('should return null when no tool calls', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    assert.strictEqual(inferToolChoiceReason(messages, []), null);
  });

  it('should return null when no messages', () => {
    const toolCalls = [{ id: 'call_1', name: 'web_search', arguments: '{}' }];
    assert.strictEqual(inferToolChoiceReason(null, toolCalls), null);
  });

  it('should return null for unknown tool', () => {
    const messages = [{ role: 'user', content: 'Hello' }];
    const toolCalls = [{ id: 'call_1', name: 'unknown_tool', arguments: '{}' }];
    assert.strictEqual(inferToolChoiceReason(messages, toolCalls), null);
  });
});

describe('isRetryLoop', () => {
  it('should detect retry loop with same failed tool', () => {
    const loops = [
      {
        toolCalls: [{ id: 'call_1', name: 'web_search', status: 'error' }],
      },
      {
        toolCalls: [{ id: 'call_2', name: 'web_search' }],
      },
    ];
    assert.strictEqual(isRetryLoop(loops, 1), true);
  });

  it('should not detect retry when previous succeeded', () => {
    const loops = [
      {
        toolCalls: [{ id: 'call_1', name: 'web_search', status: 'success' }],
      },
      {
        toolCalls: [{ id: 'call_2', name: 'web_search' }],
      },
    ];
    assert.strictEqual(isRetryLoop(loops, 1), false);
  });

  it('should not detect retry for different tool', () => {
    const loops = [
      {
        toolCalls: [{ id: 'call_1', name: 'web_search', status: 'error' }],
      },
      {
        toolCalls: [{ id: 'call_2', name: 'file_read' }],
      },
    ];
    assert.strictEqual(isRetryLoop(loops, 1), false);
  });

  it('should return false for first loop', () => {
    const loops = [
      { toolCalls: [{ name: 'web_search' }] },
    ];
    assert.strictEqual(isRetryLoop(loops, 0), false);
  });

  it('should return false for empty loops', () => {
    assert.strictEqual(isRetryLoop([], 0), false);
    assert.strictEqual(isRetryLoop(null, 0), false);
  });
});
