import { useWebSocket } from './hooks/useWebSocket';
import { Dashboard } from './components/Dashboard';
import type { ConnectionStatus } from './types';

export default function App() {
  const { events, connection, clearEvents } = useWebSocket();

  return (
    <>
      <ConnectionIndicator status={connection} />
      <Dashboard events={events} onClear={clearEvents} />
    </>
  );
}

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const color = status.connected ? '#22c55e' : status.connecting ? '#f59e0b' : '#ef4444';
  const text = status.connected ? '已连接' : status.connecting ? '连接中...' : '未连接';

  return (
    <div style={styles.indicator}>
      <span style={{ ...styles.dot, backgroundColor: color }} />
      <span style={styles.text}>{text}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  indicator: {
    position: 'fixed',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    padding: '6px 12px',
    borderRadius: '20px',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  text: {
    fontSize: '12px',
    color: '#e2e8f0',
  },
};
