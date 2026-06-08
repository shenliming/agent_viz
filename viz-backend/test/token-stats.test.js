import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractTokenTrend, getTokenSummary, getTokenByModel } from '../lib/token-stats.js';

function createMockCall(index, options = {}) {
  return {
    id: index + 1,
    timestamp: options.timestamp || (Date.now() + index * 2000),
    model: options.model || 'gpt-4',
    input_tokens: options.inputTokens || 1000,
    output_tokens: options.outputTokens || 200,
    total_tokens: options.totalTokens || 1200,
  };
}

describe('extractTokenTrend', () => {
  it('should return empty array for empty input', () => {
    assert.deepStrictEqual(extractTokenTrend([]), []);
    assert.deepStrictEqual(extractTokenTrend(null), []);
  });

  it('should extract token trend from calls', () => {
    const calls = [
      createMockCall(0, { inputTokens: 1000, outputTokens: 200 }),
      createMockCall(1, { inputTokens: 1500, outputTokens: 300 }),
    ];
    const trend = extractTokenTrend(calls);
    
    assert.strictEqual(trend.length, 2);
    assert.strictEqual(trend[0].loopIndex, 1);
    assert.strictEqual(trend[0].inputTokens, 1000);
    assert.strictEqual(trend[1].loopIndex, 2);
    assert.strictEqual(trend[1].inputTokens, 1500);
  });

  it('should sort by timestamp', () => {
    const calls = [
      createMockCall(0, { inputTokens: 3000, timestamp: 3000 }),
      createMockCall(1, { inputTokens: 1000, timestamp: 1000 }),
    ];
    const trend = extractTokenTrend(calls);
    
    assert.strictEqual(trend[0].inputTokens, 1000);
    assert.strictEqual(trend[1].inputTokens, 3000);
  });
});

describe('getTokenSummary', () => {
  it('should return zeros for empty input', () => {
    const summary = getTokenSummary([]);
    assert.strictEqual(summary.totalInput, 0);
    assert.strictEqual(summary.callCount, 0);
  });

  it('should calculate correct summary', () => {
    const calls = [
      createMockCall(0, { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 }),
      createMockCall(1, { inputTokens: 1500, outputTokens: 300, totalTokens: 1800 }),
    ];
    const summary = getTokenSummary(calls);
    
    assert.strictEqual(summary.totalInput, 2500);
    assert.strictEqual(summary.totalOutput, 500);
    assert.strictEqual(summary.total, 3000);
    assert.strictEqual(summary.avgPerCall, 1500);
    assert.strictEqual(summary.maxPerCall, 1800);
    assert.strictEqual(summary.minPerCall, 1200);
    assert.strictEqual(summary.callCount, 2);
  });

  it('should handle null values', () => {
    const calls = [
      { id: 1, timestamp: Date.now(), model: 'gpt-4' },
    ];
    const summary = getTokenSummary(calls);
    
    assert.strictEqual(summary.totalInput, 0);
    assert.strictEqual(summary.callCount, 1);
  });
});

describe('getTokenByModel', () => {
  it('should return empty array for empty input', () => {
    assert.deepStrictEqual(getTokenByModel([]), []);
    assert.deepStrictEqual(getTokenByModel(null), []);
  });

  it('should group by model', () => {
    const calls = [
      createMockCall(0, { model: 'gpt-4', totalTokens: 1000 }),
      createMockCall(1, { model: 'gpt-4', totalTokens: 2000 }),
      createMockCall(2, { model: 'claude', totalTokens: 1500 }),
    ];
    const byModel = getTokenByModel(calls);
    
    assert.strictEqual(byModel.length, 2);
    
    const gpt4 = byModel.find(m => m.model === 'gpt-4');
    assert.ok(gpt4);
    assert.strictEqual(gpt4.callCount, 2);
    assert.strictEqual(gpt4.totalTokens, 3000);
    assert.strictEqual(gpt4.avgTokens, 1500);
    
    const claude = byModel.find(m => m.model === 'claude');
    assert.ok(claude);
    assert.strictEqual(claude.callCount, 1);
    assert.strictEqual(claude.totalTokens, 1500);
  });

  it('should handle unknown model', () => {
    const calls = [
      { id: 1, timestamp: Date.now(), total_tokens: 500 },
    ];
    const byModel = getTokenByModel(calls);
    
    assert.strictEqual(byModel.length, 1);
    assert.strictEqual(byModel[0].model, 'unknown');
  });
});
