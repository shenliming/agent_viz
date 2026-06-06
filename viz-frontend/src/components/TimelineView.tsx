import type { VizEvent } from '../types';
import { formatTimestamp, getEventColor, getEventLabel, truncate } from '../utils/format';

interface TimelineViewProps {
  events: VizEvent[];
  onSelectEvent: (event: VizEvent) => void;
}

export function TimelineView({ events, onSelectEvent }: TimelineViewProps) {
  if (events.length === 0) {
    return (
      <div style={styles.empty}>
        <p>等待事件...</p>
        <p style={styles.hint}>请发送消息到 Agent 开始监控</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {events.map((event, index) => (
        <div
          key={`${event.timestamp}-${index}`}
          style={styles.eventItem}
          onClick={() => onSelectEvent(event)}
        >
          <div style={styles.timeColumn}>
            <div style={styles.dot} />
            <span style={styles.time}>{formatTimestamp(event.timestamp)}</span>
          </div>
          <div style={styles.eventContent}>
            <div style={styles.eventHeader}>
              <span
                style={{
                  ...styles.badge,
                  backgroundColor: getEventColor(event.type),
                }}
              >
                {getEventLabel(event.type)}
              </span>
              {event.sessionId && (
                <span style={styles.sessionId}>
                  {event.sessionId.slice(0, 8)}...
                </span>
              )}
            </div>
            <div style={styles.eventDetails}>
              {getEventSummary(event)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getEventSummary(event: VizEvent): string {
  const data = event.data as Record<string, unknown>;
  switch (event.type) {
    case 'llm_input':
      return `Provider: ${data.provider || 'unknown'}, Messages: ${(data.historyMessages as any[])?.length || 0}`;
    case 'llm_output':
      const usage = data.usage as Record<string, number> | undefined;
      return `Provider: ${data.provider || 'unknown'}, Tokens: ${usage?.total || 0}`;
    case 'model_call_started':
      return `Provider: ${data.provider || 'unknown'}`;
    case 'model_call_ended':
      return `Outcome: ${data.outcome || 'unknown'}, Duration: ${data.durationMs || 0}ms`;
    case 'before_tool_call':
      return `Tool: ${data.toolName || 'unknown'}, Category: ${data.toolCategory || 'other'}`;
    case 'after_tool_call':
      return `Tool: ${data.toolName || 'unknown'}, Status: ${data.status || 'unknown'}, Duration: ${data.durationMs || 0}ms`;
    case 'agent_state_change':
      return `State: ${data.from || 'unknown'} → ${data.to || 'unknown'}, Reason: ${data.reason || ''}`;
    case 'session_start':
      return `Session started`;
    case 'session_end':
      return `Session ended`;
    case 'before_compaction':
      return `Compaction triggered: ${data.trigger || 'unknown'}`;
    case 'after_compaction':
      return `Compaction done: ${data.summaryLength || 0} chars`;
    default:
      return truncate(JSON.stringify(data), 80);
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#64748b',
  },
  hint: {
    fontSize: '12px',
    marginTop: '8px',
  },
  eventItem: {
    display: 'flex',
    gap: '16px',
    padding: '12px',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background-color 0.15s',
    borderBottom: '1px solid #1e293b',
  },
  timeColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '100px',
    position: 'relative',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    marginTop: '4px',
  },
  time: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '8px',
    fontFamily: 'monospace',
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#fff',
  },
  sessionId: {
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  eventDetails: {
    fontSize: '12px',
    color: '#94a3b8',
  },
};
