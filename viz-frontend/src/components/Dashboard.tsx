import { useState, useMemo } from 'react';
import type { VizEvent, AgentState, ToolCallNode, ToolCallEdge } from '../types';
import { TimelineView } from './TimelineView';
import { FlowChartView } from './FlowChartView';
import { StatusPanel } from './StatusPanel';
import { ContextWindowView } from './ContextWindowView';
import { ProxyContextWindowView } from './ProxyContextWindowView';
import { LoopView } from './LoopView';
import { formatTimestamp, getEventLabel } from '../utils/format';

type TabType = 'timeline' | 'context' | 'proxy-context' | 'loops' | 'flowchart' | 'status';

export function Dashboard({ events, onClear }: { events: VizEvent[]; onClear?: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [selectedEvent, setSelectedEvent] = useState<VizEvent | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const toolCallNodes = useMemo<ToolCallNode[]>(() => {
    const nodes: ToolCallNode[] = [];
    const toolCalls = new Map<string, ToolCallNode>();

    for (const event of events) {
      if (event.type === 'before_tool_call') {
        const data = event.data as Record<string, unknown>;
        const id = `${event.runId}-${data.toolName}-${event.timestamp}`;
        const node: ToolCallNode = {
          id,
          toolName: String(data.toolName || ''),
          toolCategory: String(data.toolCategory || 'other'),
          params: (data.params || {}) as Record<string, unknown>,
          status: 'pending',
          timestamp: event.timestamp,
          filePath: data.filePath ? String(data.filePath) : undefined,
        };
        toolCalls.set(id, node);
        nodes.push(node);
      } else if (event.type === 'after_tool_call') {
        const data = event.data as Record<string, unknown>;
        const toolName = String(data.toolName || '');
        const status = String(data.status || 'success');
        const durationMs = data.durationMs ? Number(data.durationMs) : undefined;
        const result = data.result ? String(data.result) : undefined;
        const filePath = data.filePath ? String(data.filePath) : undefined;

        const matchingNode = nodes.findLast(
          (n) => n.toolName === toolName && n.status === 'pending'
        );
        if (matchingNode) {
          matchingNode.status = status as 'success' | 'error';
          matchingNode.durationMs = durationMs;
          matchingNode.result = result;
          matchingNode.filePath = filePath;
        }
      }
    }

    return nodes;
  }, [events]);

  const toolCallEdges = useMemo<ToolCallEdge[]>(() => {
    const edges: ToolCallEdge[] = [];
    for (let i = 1; i < toolCallNodes.length; i++) {
      edges.push({
        id: `edge-${i}`,
        from: toolCallNodes[i - 1].id,
        to: toolCallNodes[i].id,
      });
    }
    return edges;
  }, [toolCallNodes]);

  const sessions = useMemo(() => {
    const sessionMap = new Map<string, { id: string; eventCount: number; state: AgentState; lastEvent: number }>();
    for (const event of events) {
      if (!event.sessionId) continue;
      const session = sessionMap.get(event.sessionId) || {
        id: event.sessionId,
        eventCount: 0,
        state: 'unknown' as AgentState,
        lastEvent: 0,
      };
      session.eventCount++;
      session.lastEvent = event.timestamp;

      if (event.type === 'agent_state_change') {
        const data = event.data as Record<string, unknown>;
        session.state = (data.to as AgentState) || session.state;
      }
      sessionMap.set(event.sessionId, session);
    }
    return Array.from(sessionMap.values());
  }, [events]);

  const stats = useMemo(() => {
    const typeCount: Record<string, number> = {};
    for (const event of events) {
      typeCount[event.type] = (typeCount[event.type] || 0) + 1;
    }
    return { total: events.length, typeCount };
  }, [events]);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'timeline', label: '时间线' },
    { key: 'context', label: 'Context Window' },
    { key: 'proxy-context', label: '真实 Context' },
    { key: 'loops', label: '循环分析' },
    { key: 'flowchart', label: '工具调用图' },
    { key: 'status', label: '状态面板' },
  ];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>Agent Viz 监控面板</h1>
          {onClear && (
            <button 
              style={styles.clearBtn} 
              onClick={() => setShowClearConfirm(true)}
              title="清空所有历史数据"
            >
              🗑 清空历史
            </button>
          )}
        </div>
        <div style={styles.stats}>
          <span style={styles.statItem}>总事件: {stats.total}</span>
          {Object.entries(stats.typeCount).map(([type, count]) => (
            <span key={type} style={styles.statItem}>
              {getEventLabel(type)}: {count}
            </span>
          ))}
        </div>
      </header>

      {showClearConfirm && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>确认清空</h3>
            <p style={styles.modalText}>
              确定要清空所有历史数据吗？此操作不可恢复。
            </p>
            <div style={styles.modalActions}>
              <button 
                style={styles.cancelBtn} 
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </button>
              <button 
                style={styles.confirmBtn} 
                onClick={async () => {
                  try {
                    await fetch('http://localhost:9001/api/events', { method: 'DELETE' });
                    onClear?.();
                    setShowClearConfirm(false);
                  } catch (err) {
                    console.error('清空失败:', err);
                  }
                }}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      <nav style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div style={styles.content}>
        <div style={styles.main}>
          {activeTab === 'timeline' && (
            <TimelineView events={events} onSelectEvent={setSelectedEvent} />
          )}
          {activeTab === 'context' && (
            <ContextWindowView events={events} />
          )}
          {activeTab === 'proxy-context' && (
            <ProxyContextWindowView />
          )}
          {activeTab === 'loops' && (
            <LoopView />
          )}
          {activeTab === 'flowchart' && (
            <FlowChartView nodes={toolCallNodes} edges={toolCallEdges} />
          )}
          {activeTab === 'status' && <StatusPanel sessions={sessions} events={events} />}
        </div>

        {selectedEvent && (
          <div style={styles.detail}>
            <div style={styles.detailHeader}>
              <h3>事件详情</h3>
              <button style={styles.closeBtn} onClick={() => setSelectedEvent(null)}>
                ×
              </button>
            </div>
            <div style={styles.detailContent}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>类型</span>
                <span>{getEventLabel(selectedEvent.type)}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>时间</span>
                <span>{formatTimestamp(selectedEvent.timestamp)}</span>
              </div>
              {selectedEvent.sessionId && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Session</span>
                  <span>{selectedEvent.sessionId}</span>
                </div>
              )}
              {selectedEvent.runId && (
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Run</span>
                  <span>{selectedEvent.runId}</span>
                </div>
              )}
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>数据</span>
                <pre style={styles.dataBlock}>
                  {JSON.stringify(selectedEvent.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    padding: '12px 20px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#f8fafc',
  },
  clearBtn: {
    padding: '6px 12px',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  stats: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  statItem: {
    backgroundColor: '#334155',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    padding: '8px 20px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
    color: '#fff',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    overflow: 'auto',
  },
  detail: {
    width: '380px',
    backgroundColor: '#1e293b',
    borderLeft: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #334155',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  detailContent: {
    padding: '16px',
    overflow: 'auto',
    flex: 1,
  },
  detailRow: {
    marginBottom: '12px',
  },
  detailLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  dataBlock: {
    backgroundColor: '#0f172a',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '12px',
    overflow: 'auto',
    maxHeight: '400px',
    color: '#e2e8f0',
    margin: 0,
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '24px',
    minWidth: '400px',
    maxWidth: '500px',
  },
  modalTitle: {
    margin: '0 0 12px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#f8fafc',
  },
  modalText: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 16px',
    border: '1px solid #475569',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  confirmBtn: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#ef4444',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
};
