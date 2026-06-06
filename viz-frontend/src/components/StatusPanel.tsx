import type { VizEvent, AgentState } from '../types';
import { formatTimestamp, getEventColor, getEventLabel } from '../utils/format';

interface SessionData {
  id: string;
  eventCount: number;
  state: AgentState;
  lastEvent: number;
}

interface StatusPanelProps {
  sessions: SessionData[];
  events: VizEvent[];
}

const stateColors: Record<AgentState, string> = {
  idle: '#22c55e',
  thinking: '#3b82f6',
  executing: '#f59e0b',
  compacting: '#8b5cf6',
  terminated: '#ef4444',
  unknown: '#6b7280',
};

export function StatusPanel({ sessions, events }: StatusPanelProps) {
  const recentEvents = events.slice(-20).reverse();

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>会话列表 ({sessions.length})</h3>
        {sessions.length === 0 ? (
          <p style={styles.empty}>暂无会话</p>
        ) : (
          <div style={styles.sessionList}>
            {sessions.map((session) => (
              <div key={session.id} style={styles.sessionCard}>
                <div style={styles.sessionHeader}>
                  <span style={styles.sessionId}>
                    {session.id.slice(0, 12)}...
                  </span>
                  <span
                    style={{
                      ...styles.stateBadge,
                      backgroundColor: stateColors[session.state] || stateColors.unknown,
                    }}
                  >
                    {session.state}
                  </span>
                </div>
                <div style={styles.sessionInfo}>
                  <span>事件: {session.eventCount}</span>
                  <span>最后活动: {formatTimestamp(session.lastEvent)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>最近事件</h3>
        <div style={styles.eventList}>
          {recentEvents.map((event, index) => (
            <div key={`${event.timestamp}-${index}`} style={styles.eventItem}>
              <span
                style={{
                  ...styles.dot,
                  backgroundColor: getEventColor(event.type),
                }}
              />
              <div style={styles.eventInfo}>
                <span style={styles.eventType}>{getEventLabel(event.type)}</span>
                <span style={styles.eventTime}>{formatTimestamp(event.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '16px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#f8fafc',
  },
  empty: {
    color: '#64748b',
    fontSize: '12px',
    textAlign: 'center',
    padding: '20px',
  },
  sessionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sessionCard: {
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    padding: '12px',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  sessionId: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#94a3b8',
  },
  stateBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#fff',
    textTransform: 'capitalize',
  },
  sessionInfo: {
    display: 'flex',
    gap: '16px',
    fontSize: '11px',
    color: '#64748b',
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  eventItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '4px',
    backgroundColor: '#0f172a',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  eventInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    flex: 1,
    fontSize: '12px',
  },
  eventType: {
    color: '#e2e8f0',
  },
  eventTime: {
    color: '#64748b',
    fontFamily: 'monospace',
    fontSize: '11px',
  },
};
