import type { Loop } from '../types/loop';
import { truncate } from '../utils/format';

interface LoopCardProps {
  loop: Loop;
  onClick: (loop: Loop) => void;
}

const LOOP_TYPE_CONFIG = {
  tool_use: { icon: '🔧', label: '工具调用', color: '#3b82f6', bg: '#1e3a5f' },
  direct_answer: { icon: '💬', label: '直接回答', color: '#10b981', bg: '#064e3b' },
  error_retry: { icon: '🔄', label: '错误重试', color: '#f59e0b', bg: '#78350f' },
  unknown: { icon: '❓', label: '未知', color: '#6b7280', bg: '#1f2937' },
};

export function LoopCard({ loop, onClick }: LoopCardProps) {
  const config = LOOP_TYPE_CONFIG[loop.inferred.loopType] || LOOP_TYPE_CONFIG.unknown;

  return (
    <div
      style={styles.card}
      onClick={() => onClick(loop)}
    >
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.loopIndex}>#{loop.loopIndex}</span>
          <span
            style={{
              ...styles.typeBadge,
              backgroundColor: config.bg,
              color: config.color,
              border: `1px solid ${config.color}`,
            }}
          >
            {config.icon} {config.label}
          </span>
          <span style={styles.duration}>{formatDuration(loop.durationMs)}</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.model}>{loop.model}</span>
          <span style={styles.tokens}>
            ↑{formatToken(loop.tokenUsage.inputTokens)} ↓{formatToken(loop.tokenUsage.outputTokens)}
          </span>
        </div>
      </div>

      {/* Think Content */}
      {loop.think.content && (
        <div style={styles.thinkSection}>
          <div style={styles.thinkLabel}>🧠 思考</div>
          <div style={styles.thinkContent}>{truncate(loop.think.content, 200)}</div>
        </div>
      )}

      {/* Tool Calls */}
      {loop.toolCalls.length > 0 && (
        <div style={styles.toolSection}>
          <div style={styles.toolLabel}>🔧 工具调用 ({loop.toolCalls.length})</div>
          <div style={styles.toolBadges}>
            {loop.toolCalls.map((tc, i) => (
              <span key={tc.id || i} style={styles.toolBadge}>
                {tc.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Observations */}
      {loop.observations.length > 0 && (
        <div style={styles.observationSection}>
          <div style={styles.observationLabel}>📋 观察结果</div>
          {loop.observations.map((obs, i) => (
            <div key={i} style={styles.observationItem}>
              <span style={styles.observationTool}>{obs.toolName}</span>
              <span style={styles.observationContent}>{truncate(obs.content || '', 100)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tool Choice Reason */}
      {loop.inferred.toolChoiceReason && (
        <div style={styles.reasonSection}>
          💡 {loop.inferred.toolChoiceReason}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatToken(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return `${count}`;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid #334155',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  loopIndex: {
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#e2e8f0',
  },
  typeBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
  },
  duration: {
    color: '#94a3b8',
    fontSize: '12px',
  },
  model: {
    fontFamily: 'monospace',
  },
  tokens: {
    fontFamily: 'monospace',
  },
  thinkSection: {
    marginBottom: '12px',
    padding: '8px 12px',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    borderLeft: '3px solid #3b82f6',
  },
  thinkLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '4px',
  },
  thinkContent: {
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: 1.5,
  },
  toolSection: {
    marginBottom: '12px',
  },
  toolLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '6px',
  },
  toolBadges: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  toolBadge: {
    padding: '3px 10px',
    backgroundColor: '#1e3a5f',
    color: '#93c5fd',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  observationSection: {
    marginBottom: '12px',
  },
  observationLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '6px',
  },
  observationItem: {
    display: 'flex',
    gap: '8px',
    padding: '6px 10px',
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    marginBottom: '4px',
    fontSize: '12px',
  },
  observationTool: {
    color: '#10b981',
    fontFamily: 'monospace',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  observationContent: {
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  reasonSection: {
    fontSize: '12px',
    color: '#fbbf24',
    padding: '6px 10px',
    backgroundColor: '#422006',
    borderRadius: '6px',
  },
};
