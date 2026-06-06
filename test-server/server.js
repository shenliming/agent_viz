/**
 * Agent Viz 测试服务器
 * 
 * 简单的 WebSocket 服务器，用于接收和显示插件发送的事件
 * 运行: npm start
 */

import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 9000;

const wss = new WebSocketServer({ port: PORT });

console.log(`[test-server] Agent Viz 测试服务器启动在 ws://localhost:${PORT}`);
console.log('[test-server] 等待插件连接...\n');

let eventCount = 0;
const events = [];

wss.on('connection', (ws) => {
  console.log('[test-server] ✓ 客户端已连接!');
  
  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());
      eventCount++;
      events.push(event);
      
      // 广播给所有连接的客户端（包括前端）
      const message = JSON.stringify(event);
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      });
      
      // 格式化输出
      const timestamp = new Date(event.timestamp).toLocaleTimeString();
      const type = event.type || 'unknown';
      const sessionId = event.sessionId || event.sessionKey || '-';
      
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`[${eventCount}] ${timestamp} | ${type}`);
      console.log(`    Session: ${sessionId}`);
      console.log(`    Run: ${event.runId || '-'}`);
      
      // 根据事件类型显示关键信息
      if (type === 'model_call_started') {
        console.log(`    Provider: ${event.data?.provider}/${event.data?.model}`);
      } else if (type === 'model_call_ended') {
        console.log(`    Outcome: ${event.data?.outcome}, Duration: ${event.data?.durationMs}ms`);
      } else if (type === 'before_tool_call') {
        console.log(`    Tool: ${event.data?.toolName} (${event.data?.toolCategory || 'unknown'})`);
        if (event.data?.filePath) console.log(`    File: ${event.data.filePath}`);
        console.log(`    Params: ${JSON.stringify(event.data?.params).slice(0, 100)}`);
      } else if (type === 'after_tool_call') {
        console.log(`    Tool: ${event.data?.toolName} (${event.data?.toolCategory || 'unknown'}), Status: ${event.data?.status}`);
        if (event.data?.filePath) console.log(`    File: ${event.data.filePath}`);
        console.log(`    Duration: ${event.data?.durationMs}ms`);
        if (event.data?.result) console.log(`    Result: ${event.data.result.slice(0, 100)}`);
      } else if (type === 'llm_input') {
        console.log(`    Provider: ${event.data?.provider}/${event.data?.model}`);
        console.log(`    History Messages: ${event.data?.historyMessageCount || 0}`);
        if (event.data?.estimatedHistoryTokens) console.log(`    Est. History Tokens: ${event.data.estimatedHistoryTokens}`);
        if (event.data?.thinkingMessages?.length > 0) console.log(`    Thinking Messages: ${event.data.thinkingMessages.length}`);
      } else if (type === 'llm_output') {
        console.log(`    Provider: ${event.data?.provider}/${event.data?.model}`);
        console.log(`    Usage: ${JSON.stringify(event.data?.usage)}`);
        if (event.data?.thinkingContent) console.log(`    Thinking: ${event.data.thinkingContent.slice(0, 100)}...`);
        if (event.data?.contextTokenBudget) console.log(`    Context Budget: ${event.data.contextTokenBudget} tokens`);
      } else if (type === 'before_compaction') {
        console.log(`    Messages: ${event.data?.messageCount}, Tokens: ${event.data?.tokenCount}`);
      } else if (type === 'after_compaction') {
        console.log(`    Messages: ${event.data?.messageCount}, Tokens: ${event.data?.tokenCount}, Compacted: ${event.data?.compactedCount}`);
      } else if (type === 'session_start') {
        console.log(`    Session: ${event.data?.sessionId}`);
      } else if (type === 'session_end') {
        console.log(`    Messages: ${event.data?.messageCount}, Duration: ${event.data?.durationMs}ms`);
        console.log(`    Reason: ${event.data?.reason}`);
      } else if (type === 'message_received') {
        console.log(`    Channel: ${event.data?.channel}, From: ${event.data?.senderId}`);
        console.log(`    Content: ${event.data?.content?.slice(0, 100)}`);
      } else if (type === 'message_sent') {
        console.log(`    Channel: ${event.data?.channel}`);
        console.log(`    Content: ${event.data?.content?.slice(0, 100)}`);
      } else if (type === 'agent_state_change') {
        console.log(`    State: ${event.data?.from} → ${event.data?.to}`);
        console.log(`    Reason: ${event.data?.reason}`);
      }
      
    } catch (err) {
      console.error('[test-server] 解析事件失败:', err);
      console.error('[test-server] 原始数据:', data.toString().slice(0, 200));
    }
  });
  
  ws.on('close', () => {
    console.log('\n[test-server] ✗ 插件已断开连接');
  });
  
  ws.on('error', (err) => {
    console.error('[test-server] WebSocket 错误:', err.message);
  });
});

// 定期打印统计
setInterval(() => {
  if (eventCount > 0) {
    const types = {};
    events.forEach(e => {
      const type = e.type || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[统计] 总事件数: ${eventCount}`);
    console.log('[统计] 事件类型分布:');
    Object.entries(types).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });
    console.log(`${'═'.repeat(60)}\n`);
  }
}, 30000);

process.on('SIGINT', () => {
  console.log('\n[test-server] 服务器关闭');
  wss.close();
  process.exit(0);
});
