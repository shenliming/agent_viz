import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLastAssistantMessage,
  extractToolCalls,
  extractToolResults,
  extractTokenUsage,
  extractResponseContent,
} from '../lib/message-parser.js';

describe('extractLastAssistantMessage', () => {
  it('should extract last assistant message content', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'I will search for that' },
    ];
    const result = extractLastAssistantMessage(messages);
    assert.strictEqual(result.content, 'I will search for that');
    assert.strictEqual(result.hasToolResults, false);
  });

  it('should return null when no assistant message', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];
    const result = extractLastAssistantMessage(messages);
    assert.strictEqual(result.content, null);
  });

  it('should handle array content', () => {
    const messages = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Line 1' },
          { type: 'text', text: 'Line 2' },
        ],
      },
    ];
    const result = extractLastAssistantMessage(messages);
    assert.strictEqual(result.content, 'Line 1\nLine 2');
  });

  it('should handle empty messages', () => {
    const result = extractLastAssistantMessage([]);
    assert.strictEqual(result.content, null);
  });

  it('should handle null messages', () => {
    const result = extractLastAssistantMessage(null);
    assert.strictEqual(result.content, null);
  });

  it('should detect tool result messages', () => {
    const messages = [
      { role: 'assistant', content: 'Thinking...' },
      { role: 'tool', content: 'Result data', tool_call_id: 'call_1', name: 'search' },
      { role: 'assistant', content: 'Based on results...' },
    ];
    const result = extractLastAssistantMessage(messages);
    assert.strictEqual(result.hasToolResults, true);
  });
});

describe('extractToolCalls', () => {
  it('should extract tool_calls from OpenAI format response', () => {
    const response = {
      choices: [{
        message: {
          role: 'assistant',
          tool_calls: [
            {
              id: 'call_abc',
              function: { name: 'web_search', arguments: '{"query":"test"}' },
            },
          ],
        },
      }],
    };
    const result = extractToolCalls(response);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'call_abc');
    assert.strictEqual(result[0].name, 'web_search');
    assert.strictEqual(result[0].arguments, '{"query":"test"}');
  });

  it('should return empty array when no tool_calls', () => {
    const response = {
      choices: [{
        message: { role: 'assistant', content: 'Hello' },
      }],
    };
    const result = extractToolCalls(response);
    assert.deepStrictEqual(result, []);
  });

  it('should handle multiple tool_calls', () => {
    const response = {
      choices: [{
        message: {
          role: 'assistant',
          tool_calls: [
            { id: 'call_1', function: { name: 'search', arguments: '{}' } },
            { id: 'call_2', function: { name: 'read', arguments: '{}' } },
          ],
        },
      }],
    };
    const result = extractToolCalls(response);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'search');
    assert.strictEqual(result[1].name, 'read');
  });

  it('should handle null response', () => {
    const result = extractToolCalls(null);
    assert.deepStrictEqual(result, []);
  });

  it('should handle empty choices', () => {
    const response = { choices: [] };
    const result = extractToolCalls(response);
    assert.deepStrictEqual(result, []);
  });
});

describe('extractToolResults', () => {
  it('should extract tool result messages', () => {
    const messages = [
      { role: 'tool', content: 'Search result', tool_call_id: 'call_1', name: 'web_search' },
      { role: 'tool', content: 'File content', tool_call_id: 'call_2', name: 'file_read' },
    ];
    const result = extractToolResults(messages);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].toolCallId, 'call_1');
    assert.strictEqual(result[0].toolName, 'web_search');
    assert.strictEqual(result[0].content, 'Search result');
  });

  it('should return empty array when no tool messages', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];
    const result = extractToolResults(messages);
    assert.deepStrictEqual(result, []);
  });

  it('should handle null messages', () => {
    const result = extractToolResults(null);
    assert.deepStrictEqual(result, []);
  });
});

describe('extractTokenUsage', () => {
  it('should extract token usage from response', () => {
    const response = {
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 200,
        total_tokens: 1200,
      },
    };
    const result = extractTokenUsage(response);
    assert.deepStrictEqual(result, {
      inputTokens: 1000,
      outputTokens: 200,
      totalTokens: 1200,
    });
  });

  it('should handle alternative field names', () => {
    const response = {
      usage: {
        input_tokens: 500,
        output_tokens: 100,
        total_tokens: 600,
      },
    };
    const result = extractTokenUsage(response);
    assert.deepStrictEqual(result, {
      inputTokens: 500,
      outputTokens: 100,
      totalTokens: 600,
    });
  });

  it('should return zeros when no usage', () => {
    const result = extractTokenUsage({});
    assert.deepStrictEqual(result, {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });

  it('should handle null response', () => {
    const result = extractTokenUsage(null);
    assert.deepStrictEqual(result, {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });
});

describe('extractResponseContent', () => {
  it('should extract assistant text content', () => {
    const response = {
      choices: [{
        message: { role: 'assistant', content: 'Here is the answer' },
      }],
    };
    const result = extractResponseContent(response);
    assert.strictEqual(result, 'Here is the answer');
  });

  it('should return null when no content', () => {
    const response = {
      choices: [{
        message: { role: 'assistant', tool_calls: [] },
      }],
    };
    const result = extractResponseContent(response);
    assert.strictEqual(result, null);
  });

  it('should handle null response', () => {
    const result = extractResponseContent(null);
    assert.strictEqual(result, null);
  });
});
