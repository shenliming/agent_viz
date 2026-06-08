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
 * @returns {Router} Express Router
 */
export function createLoopsRouter(proxyDb) {
  const router = Router();

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

      const loops = analyzeLoops(rows);
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

      const detail = getLoopDetail(rows, loopIndex);
      if (!detail) {
        return res.status(404).json({ error: 'Loop not found' });
      }

      res.json(detail);
    } catch (err) {
      console.error('[loops-api] Error getting loop detail:', err.message);
      res.status(500).json({ error: 'Failed to get loop detail' });
    }
  });

  return router;
}
