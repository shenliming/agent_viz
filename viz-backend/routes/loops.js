/**
 * Loops API Routes - 循环分析的 REST API
 * 
 * 依赖注入：需要传入 proxyDb 实例
 */

import { Router } from 'express';
import { analyzeLoops, getLoopDetail, getLoopStats } from '../lib/loop-analyzer.js';
import { extractTokenTrend, getTokenSummary, getTokenByModel } from '../lib/token-stats.js';

/**
 * 创建循环分析路由
 * 
 * @param {Database} proxyDb - viz-proxy 的 SQLite 数据库实例
 * @param {Database} [eventsDb] - viz-backend 的 events 数据库实例（可选，用于融合 plugin 层数据）
 * @returns {Router} Express Router
 */
export function createLoopsRouter(proxyDb, eventsDb = null) {
  const router = Router();

  /**
   * 从 events.db 获取工具调用事件，按时间范围匹配到循环中
   */
  function enrichLoopsWithPluginEvents(loops) {
    if (!eventsDb || loops.length === 0) return loops;

    try {
      // 获取所有 before_tool_call 和 after_tool_call 事件
      const events = eventsDb.prepare(`
        SELECT type, timestamp, data
        FROM events
        WHERE type IN ('before_tool_call', 'after_tool_call')
        ORDER BY timestamp ASC
      `).all();

      if (events.length === 0) return loops;

      // 解析事件数据
      const parsedEvents = events.map(e => ({
        type: e.type,
        timestamp: e.timestamp,
        data: JSON.parse(e.data),
      }));

      // 将事件匹配到对应的循环中
      for (const loop of loops) {
        const loopStart = loop.startTime;
        const loopEnd = loop.endTime;

        // 找到在这个循环时间范围内的事件
        const matchedEvents = parsedEvents.filter(e =>
          e.timestamp >= loopStart && e.timestamp <= loopEnd
        );

        if (matchedEvents.length > 0) {
          // 合并 tool call 结果
          const afterToolCalls = matchedEvents.filter(e => e.type === 'after_tool_call');
          if (afterToolCalls.length > 0 && loop.toolCalls) {
            for (const tc of loop.toolCalls) {
              const matchingResult = afterToolCalls.find(e =>
                e.data.toolName === tc.name
              );
              if (matchingResult) {
                tc.result = matchingResult.data.result;
                tc.status = matchingResult.data.status;
                tc.durationMs = matchingResult.data.durationMs;
              }
            }
          }

          // 添加状态变化信息
          const stateChanges = matchedEvents.filter(e => e.type === 'agent_state_change');
          if (stateChanges.length > 0) {
            loop.stateChanges = stateChanges.map(e => ({
              from: e.data.from,
              to: e.data.to,
              reason: e.data.reason,
              timestamp: e.timestamp,
            }));
          }
        }
      }
    } catch (err) {
      console.warn('[loops-api] 融合 plugin 事件失败:', err.message);
    }

    return loops;
  }

  /**
   * GET /api/loops/stats
   * 获取循环统计信息
   */
  router.get('/stats', (req, res) => {
    try {
      const rows = proxyDb.prepare(`
        SELECT * FROM llm_requests ORDER BY timestamp ASC
      `).all();

      const loops = analyzeLoops(rows);
      const stats = getLoopStats(loops);
      res.json(stats);
    } catch (err) {
      console.error('[loops-api] Error getting stats:', err.message);
      res.status(500).json({ error: 'Failed to get loop stats' });
    }
  });

  /**
   * GET /api/loops/tokens
   * 获取 token 使用趋势
   */
  router.get('/tokens', (req, res) => {
    try {
      const rows = proxyDb.prepare(`
        SELECT * FROM llm_requests ORDER BY timestamp ASC
      `).all();

      const trend = extractTokenTrend(rows);
      const summary = getTokenSummary(rows);
      const byModel = getTokenByModel(rows);

      res.json({ trend, summary, byModel });
    } catch (err) {
      console.error('[loops-api] Error getting token stats:', err.message);
      res.status(500).json({ error: 'Failed to get token stats' });
    }
  });

  /**
   * GET /api/loops
   * 获取所有循环列表
   * Query params:
   *   - limit: 返回数量限制（默认 100）
   *   - offset: 偏移量（默认 0）
   */
  router.get('/', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;

      const rows = proxyDb.prepare(`
        SELECT * FROM llm_requests 
        ORDER BY timestamp ASC 
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      let loops = analyzeLoops(rows);
      loops = enrichLoopsWithPluginEvents(loops);
      res.json(loops);
    } catch (err) {
      console.error('[loops-api] Error getting loops:', err.message);
      res.status(500).json({ error: 'Failed to analyze loops' });
    }
  });

  /**
   * GET /api/loops/:loopIndex
   * 获取单个循环详情
   */
  router.get('/:loopIndex', (req, res) => {
    try {
      const loopIndex = parseInt(req.params.loopIndex);
      if (isNaN(loopIndex) || loopIndex < 1) {
        return res.status(400).json({ error: 'Invalid loop index' });
      }

      const rows = proxyDb.prepare(`
        SELECT * FROM llm_requests ORDER BY timestamp ASC
      `).all();

      let detail = getLoopDetail(rows, loopIndex);
      if (!detail) {
        return res.status(404).json({ error: 'Loop not found' });
      }

      // 融合 plugin 层事件
      detail = enrichLoopsWithPluginEvents([detail])[0];
      res.json(detail);
    } catch (err) {
      console.error('[loops-api] Error getting loop detail:', err.message);
      res.status(500).json({ error: 'Failed to get loop detail' });
    }
  });

  return router;
}
