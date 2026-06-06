/**
 * Viz Proxy - LLM 请求代理服务器
 * 
 * 拦截 OpenClaw → LLM API 的完整 HTTP 请求，捕获：
 * - 完整的 request body（messages + tools + 参数）
 * - 完整的 response body（assistant 回复 + usage）
 * 
 * 架构：
 * OpenClaw → viz-proxy (9002) → LLM API (可配置)
 */

const http = require('http');
const { URL } = require('url');
const Database = require('better-sqlite3');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// ========== 配置 ==========
const PROXY_PORT = process.env.PROXY_PORT || 9002;
const TARGET_URL = process.env.LLM_TARGET || 'http://localhost:1234';
const DB_PATH = path.join(__dirname, 'data', 'proxy.db');
const target = new URL(TARGET_URL);

// 确保数据目录存在
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

// ========== SQLite 存储 ==========
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS llm_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    target_url TEXT NOT NULL,
    model TEXT,
    request_body TEXT NOT NULL,
    response_body TEXT,
    status_code INTEGER,
    duration_ms INTEGER,
    messages_count INTEGER,
    tools_count INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_llm_requests_timestamp ON llm_requests(timestamp);
  CREATE INDEX IF NOT EXISTS idx_llm_requests_model ON llm_requests(model);
`);

// ========== 简单 HTTP 代理 ==========
function forwardRequest(clientReq, clientRes) {
  const startTime = Date.now();
  
  // 构建目标请求
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: target.host },
  };
  
  // 捕获请求体
  const bodyChunks = [];
  
  clientReq.on('data', chunk => {
    bodyChunks.push(chunk);
  });
  
  clientReq.on('end', () => {
    const requestBody = Buffer.concat(bodyChunks);
    
    // 更新 Content-Length
    options.headers['content-length'] = requestBody.length;
    
    // 发送目标请求
    const proxyReq = http.request(options, (proxyRes) => {
      // 设置响应头
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // 捕获响应体
      const responseChunks = [];
      
      proxyRes.on('data', chunk => {
        responseChunks.push(chunk);
        // 流式转发
        clientRes.write(chunk);
      });
      
      proxyRes.on('end', () => {
        clientRes.end();
        
        // 存储到数据库（只处理 chat completions）
        if (clientReq.url.includes('/chat/completions')) {
          const responseBody = Buffer.concat(responseChunks);
          storeLlmRequest(requestBody, responseBody, proxyRes.statusCode, Date.now() - startTime);
        }
      });
    });
    
    proxyReq.on('error', (err) => {
      console.error('[proxy] Target error:', err.message);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      }
      clientRes.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    });
    
    // 发送请求体
    if (bodyChunks.length > 0) {
      for (const chunk of bodyChunks) {
        proxyReq.write(chunk);
      }
    }
    proxyReq.end();
  });
  
  clientReq.on('error', (err) => {
    console.error('[proxy] Client error:', err.message);
  });
}

function storeLlmRequest(requestBody, responseBody, statusCode, duration) {
  try {
    const req = JSON.parse(requestBody.toString());
    const messages = req.messages || [];
    const tools = req.tools || [];
    
    // 解析 token usage
    let inputTokens = 0, outputTokens = 0, totalTokens = 0;
    
    const respStr = responseBody.toString();
    
    // 尝试从非流式响应中提取
    try {
      const resp = JSON.parse(respStr);
      if (resp.usage) {
        inputTokens = resp.usage.prompt_tokens || 0;
        outputTokens = resp.usage.completion_tokens || 0;
        totalTokens = resp.usage.total_tokens || 0;
      }
    } catch {
      // 流式响应：从 data: 行中提取 usage
      const lines = respStr.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.usage) {
              inputTokens = parsed.usage.prompt_tokens || 0;
              outputTokens = parsed.usage.completion_tokens || 0;
              totalTokens = parsed.usage.total_tokens || 0;
            }
          } catch {}
        }
      }
    }
    
    const stmt = db.prepare(`
      INSERT INTO llm_requests (
        timestamp, target_url, model, request_body, response_body,
        status_code, duration_ms, messages_count, tools_count,
        input_tokens, output_tokens, total_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      Date.now(),
      TARGET_URL,
      req.model || 'unknown',
      requestBody.toString(),
      respStr ? JSON.stringify({ raw: respStr }) : null,
      statusCode,
      duration,
      messages.length,
      tools.length,
      inputTokens,
      outputTokens,
      totalTokens
    );
    
    // WebSocket 广播
    const wsEvent = {
      type: 'llm_proxy_request',
      timestamp: Date.now(),
      data: {
        model: req.model,
        messages,
        tools,
        usage: { input: inputTokens, output: outputTokens, total: totalTokens },
        duration,
        status: statusCode,
      },
    };
    
    broadcast(wsEvent);
    
    console.log(`[proxy] ✓ ${req.model} | ${messages.length} msgs | ${tools.length} tools | ${totalTokens} tok | ${duration}ms`);
  } catch (err) {
    console.error('[proxy] Error storing:', err.message);
  }
}

// ========== HTTP 服务器 ==========
const server = http.createServer((req, res) => {
  // REST API
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }
  
  // 代理转发
  forwardRequest(req, res);
});

// ========== REST API ==========
function handleApi(req, res) {
  const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'GET' && url.pathname === '/api/requests') {
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    
    const rows = db.prepare(`
      SELECT * FROM llm_requests ORDER BY timestamp DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    res.end(JSON.stringify(rows.map(r => ({
      ...r,
      request_body: JSON.parse(r.request_body),
      response_body: r.response_body ? JSON.parse(r.response_body) : null,
    }))));
    
  } else if (req.method === 'GET' && url.pathname === '/api/stats') {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        AVG(duration_ms) as avg_duration_ms
      FROM llm_requests
    `).get();
    
    const models = db.prepare(`
      SELECT model, COUNT(*) as count, SUM(total_tokens) as tokens
      FROM llm_requests GROUP BY model ORDER BY count DESC
    `).all();
    
    res.end(JSON.stringify({ ...stats, models }));
    
  } else if (req.method === 'DELETE' && url.pathname === '/api/requests') {
    db.prepare('DELETE FROM llm_requests').run();
    res.end(JSON.stringify({ success: true }));
    
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

// ========== WebSocket 广播 ==========
const wss = new WebSocket.Server({ server, path: '/ws' });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log('[proxy] ✓ WebSocket client connected');
  
  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('[proxy] ✗ WebSocket client disconnected');
  });
});

function broadcast(event) {
  const message = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ========== 启动 ==========
server.listen(PROXY_PORT, () => {
  console.log(`[proxy] 🚀 Viz Proxy running on port ${PROXY_PORT}`);
  console.log(`[proxy] 📡 Forwarding to: ${TARGET_URL}`);
  console.log(`[proxy] 📊 REST API: http://localhost:${PROXY_PORT}/api/requests`);
  console.log(`[proxy] 🔌 WebSocket: ws://localhost:${PROXY_PORT}/ws`);
  console.log(`[proxy] 💾 Database: ${DB_PATH}`);
});
