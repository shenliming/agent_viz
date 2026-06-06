import { useState, useEffect, useCallback, useRef } from 'react';
import type { VizEvent, ConnectionStatus } from '../types';

const WS_URL = 'ws://localhost:9001/ws';
const API_URL = 'http://localhost:9001/api';
const RECONNECT_INTERVAL = 3000;

export function useWebSocket() {
  const [events, setEvents] = useState<VizEvent[]>([]);
  const [connection, setConnection] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载历史事件
  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/events?limit=2000`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      // 转换为前端事件格式
      const historyEvents: VizEvent[] = data.map((e: any) => ({
        type: e.type,
        timestamp: e.timestamp,
        sessionId: e.session_id,
        sessionKey: e.session_key,
        runId: e.run_id,
        data: e.data || {},
      }));
      
      // 按时间排序
      historyEvents.sort((a, b) => a.timestamp - b.timestamp);
      setEvents(historyEvents);
      console.log(`[Viz] 加载了 ${historyEvents.length} 条历史事件`);
    } catch (err) {
      console.error('[Viz] 加载历史事件失败:', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnection({ connected: false, connecting: true });
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnection({ connected: true, connecting: false, lastConnected: Date.now() });
      console.log('[Viz] WebSocket connected');
    };

    ws.onclose = () => {
      setConnection({ connected: false, connecting: false });
      console.log('[Viz] WebSocket disconnected, reconnecting...');
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_INTERVAL);
    };

    ws.onerror = (error) => {
      setConnection({ connected: false, connecting: false, error: 'Connection failed' });
      console.error('[Viz] WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => {
          // 避免重复添加
          const exists = prev.some(e => 
            e.timestamp === data.timestamp && 
            e.type === data.type && 
            e.runId === data.runId
          );
          if (exists) return prev;
          return [...prev, data];
        });
      } catch (e) {
        console.error('[Viz] Failed to parse message:', e);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnection({ connected: false, connecting: false });
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    loadHistory();
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect, loadHistory]);

  return { events, connection, connect, disconnect, clearEvents };
}
