/**
 * Agent Viz 持久化后端服务
 * 
 * 功能：
 * - WebSocket 接收插件事件并持久化到 SQLite
 * - REST API 供前端查询历史事件
 * - WebSocket 广播实时事件给前端
 * 
 * 运行: npm start
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HTTP_PORT = process.env.HTTP_PORT || 9001;
const WS_PORT = process.env.WS_PORT || 9000;
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data', 'events.db');

// 确保数据目录存在
const dataDir = join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ─── SQLite 数据库初始化 ───

const db = new Database(DB_PATH);

// 启用 WAL 模式提高并发性能
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    session_id TEXT,
    session_key TEXT,
    run_id TEXT,
    timestamp INTEGER NOT NULL,
    data TEXT,  -- JSON 字符串
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    event_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);
`);

// 预编译语句
const insertEvent = db.prepare(`
  INSERT INTO events (type, session_id, session_key, run_id, timestamp, data)
  VALUES (@type, @session_id, @session_key, @run_id, @timestamp, @data)
`);

const upsertSession = db.prepare(`
  INSERT INTO sessions (session_id, first_seen, last_seen, event_count)
  VALUES (@session_id, @timestamp, @timestamp, 1)
  ON CONFLICT(session_id) DO UPDATE SET
    last_seen = @timestamp,
    event_count = event_count + 1
`);

// 批量操作
const insertBatch = db.transaction((events) => {
  for (const event of events) {
    insertEvent.run(event);
    if (event.session_id) {
      upsertSession.run({
        session_id: event.session_id,
        timestamp: event.timestamp,
      });
    }
  }
});

console.log('[viz-backend] ✓ 数据库初始化完成:', DB_PATH);

// ─── REST API ───

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 获取所有会话列表
app.get('/api/sessions', (req, res) => {
  const sessions = db.prepare(`
    SELECT * FROM sessions ORDER BY last_seen DESC LIMIT 100
  `).all();
  res.json(sessions);
});

// 获取指定 session 的所有事件
app.get('/api/sessions/:sessionId/events', (req, res) => {
  const { sessionId } = req.params;
  const events = db.prepare(`
    SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC
  `).all(sessionId);
  
  // 解析 data JSON
  const parsed = events.map(e => ({
    ...e,
    data: e.data ? JSON.parse(e.data) : null,
  }));
  
  res.json(parsed);
});

// 获取所有事件（支持分页）
app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 500;
  const offset = parseInt(req.query.offset) || 0;
  const type = req.query.type;
  const sessionId = req.query.sessionId;
  
  let sql = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }
  
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const events = db.prepare(sql).all(...params);
  
  // 解析 data JSON
  const parsed = events.map(e => ({
    ...e,
    data: e.data ? JSON.parse(e.data) : null,
  }));
  
  res.json(parsed);
});

// 获取事件统计
app.get('/api/stats', (req, res) => {
  const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get();
  const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
  
  const typeDistribution = db.prepare(`
    SELECT type, COUNT(*) as count FROM events GROUP BY type ORDER BY count DESC
  `).all();
  
  const recentSessions = db.prepare(`
    SELECT * FROM sessions ORDER BY last_seen DESC LIMIT 10
  `).all();
  
  res.json({
    totalEvents: totalEvents.count,
    totalSessions: totalSessions.count,
    typeDistribution,
    recentSessions,
  });
});

// 获取指定 session 的统计信息
app.get('/api/sessions/:sessionId/stats', (req, res) => {
  const { sessionId } = req.params;
  
  const eventCount = db.prepare(
    'SELECT COUNT(*) as count FROM events WHERE session_id = ?'
  ).get(sessionId);
  
  const typeDistribution = db.prepare(`
    SELECT type, COUNT(*) as count FROM events 
    WHERE session_id = ? GROUP BY type ORDER BY count DESC
  `).all(sessionId);
  
  const timeRange = db.prepare(`
    SELECT MIN(timestamp) as first, MAX(timestamp) as last FROM events 
    WHERE session_id = ?
  `).get(sessionId);
  
  res.json({
    sessionId,
    eventCount: eventCount.count,
    typeDistribution,
    timeRange,
  });
});

// 删除指定 session 的数据
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  db.transaction(() => {
    db.prepare('DELETE FROM events WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
  })();
  
  res.json({ success: true });
});

// 清空所有数据
app.delete('/api/events', (req, res) => {
  db.transaction(() => {
    db.prepare('DELETE FROM events').run();
    db.prepare('DELETE FROM sessions').run();
  })();
  
  res.json({ success: true });
});

const httpServer = app.listen(HTTP_PORT, () => {
  console.log(`[viz-backend] ✓ REST API 启动在 http://localhost:${HTTP_PORT}`);
});

// ─── WebSocket 服务器 ───

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

let eventCount = 0;
const recentEvents = []; // 内存缓存最近的事件（用于新连接时发送）
const MAX_CACHE = 1000;

wss.on('connection', (ws, req) => {
  console.log('[viz-backend] ✓ 客户端已连接!');
  
  // 发送缓存的事件给新连接的前端
  for (const event of recentEvents) {
    ws.send(JSON.stringify(event));
  }
  
  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());
      eventCount++;
      
      // 持久化到数据库
      const sessionKey = event.sessionKey || event.sessionId;
      const eventData = {
        type: event.type,
        session_id: event.sessionId,
        session_key: sessionKey,
        run_id: event.runId,
        timestamp: event.timestamp,
        data: JSON.stringify(event.data || {}),
      };
      
      insertEvent.run(eventData);
      
      if (event.sessionId) {
        upsertSession.run({
          session_id: event.sessionId,
          timestamp: event.timestamp,
        });
      }
      
      // 添加到内存缓存
      recentEvents.push(event);
      if (recentEvents.length > MAX_CACHE) {
        recentEvents.shift();
      }
      
      // 广播给所有其他连接的客户端（前端）
      const message = JSON.stringify(event);
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(message);
        }
      });
      
      // 控制台输出
      const timestamp = new Date(event.timestamp).toLocaleTimeString();
      const type = event.type || 'unknown';
      const sessionId = event.sessionId || '-';
      
      console.log(`[${eventCount}] ${timestamp} | ${type} | session: ${sessionId}`);
      
    } catch (err) {
      console.error('[viz-backend] 处理消息失败:', err.message);
    }
  });
  
  ws.on('close', () => {
    console.log('[viz-backend] 客户端断开连接');
  });
  
  ws.on('error', (err) => {
    console.error('[viz-backend] WebSocket 错误:', err.message);
  });
});

console.log(`[viz-backend] ✓ WebSocket 启动在 ws://localhost:${HTTP_PORT}/ws`);
console.log(`[viz-backend] 等待插件和前端连接...\n`);

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[viz-backend] 正在关闭...');
  db.close();
  wss.close();
  httpServer.close();
  process.exit(0);
});
