import type { Loop } from '../types/loop';

interface LoopDetailModalProps {
  loop: Loop;
  onClose: () => void;
}

export function LoopDetailModal({ loop, onClose }: LoopDetailModalProps) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>循环 #{loop.loopIndex} 详情</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Meta Info */}
        <div style={styles.metaSection}>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>模型</span>
            <span style={styles.metaValue}>{loop.model}</span>
          </div>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>耗时</span>
            <span style={styles.metaValue}>{formatDuration(loop.durationMs)}</span>
          </div>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>类型</span>
            <span style={styles.metaValue}>{getLoopTypeLabel(loop.inferred.loopType)}</span>
          </div>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>输入 Token</span>
            <span style={styles.metaValue}>{loop.tokenUsage.inputTokens}</span>
          </div>
          <div style={styles.metaItem}>
            <span style={styles.metaLabel}>输出 Token</span>
            <span style={styles.metaValue}>{loop.tokenUsage.outputTokens}</span>
          </div>
        </div>

        {/* Think Content */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>🧠 思考内容</h3>
          <div style={styles.contentBlock}>
            {loop.think.content ? (
              <pre style={styles.preContent}>{loop.think.content}</pre>
            ) : (
              <span style={styles.emptyText}>无思考内容</span>
            )}
          </div>
        </div>

        {/* Tool Calls */}
        {loop.toolCalls.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>🔧 工具调用 ({loop.toolCalls.length})</h3>
            {loop.toolCalls.map((tc, i) => (
              <div key={tc.id || i} style={styles.toolCallItem}>
                <div style={styles.toolCallHeader}>
                  <span style={styles.toolName}>{tc.name}</span>
                  <span style={styles.toolId}>{tc.id}</span>
                  {tc.status && (
                    <span style={{
                      ...styles.toolStatus,
                      color: tc.status === 'success' ? '#10b981' : '#ef4444',
                    }}>
                      {tc.status}
                    </span>
                  )}
                </div>
                <div style={styles.toolArgs}>
                  <span style={styles.argLabel}>参数:</span>
                  <pre style={styles.preContent}>{formatJson(tc.arguments)}</pre>
                </div>
                {tc.result && (
                  <div style={styles.toolResult}>
                    <span style={styles.argLabel}>结果:</span>
                    <pre style={styles.preContent}>{tc.result}</pre>
                  </div>
                )}
                {tc.durationMs && (
                  <div style={styles.toolDuration}>
                    耗时: {formatDuration(tc.durationMs)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Observations */}
        {loop.observations.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>📋 观察结果</h3>
            {loop.observations.map((obs, i) => (
              <div key={i} style={styles.observationItem}>
                <span style={styles.observationTool}>{obs.toolName}</span>
                <pre style={styles.preContent}>
                  {obs.content || '(无内容)'}
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* Tool Choice Reason */}
        {loop.inferred.toolChoiceReason && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>💡 工具选择原因</h3>
            <div style={styles.reasonBlock}>{loop.inferred.toolChoiceReason}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getLoopTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    tool_use: '工具调用',
    direct_answer: '直接回答',
    error_retry: '错误重试',
    unknown: '未知',
  };
  return labels[type] || type;
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#0f172a',
    borderRadius: '16px',
    width: '80%',
    maxWidth: '800px',
    maxHeight: '80vh',
    overflow: 'auto',
    padding: '24px',
    border: '1px solid #334155',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    color: '#e2e8f0',
  },
  closeButton: {
    fontSize: '24px',
    color: '#94a3b8',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0 8px',
  },
  metaSection: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '20px',
    padding: '12px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
  },
  metaItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '100px',
  },
  metaLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '4px',
  },
  metaValue: {
    fontSize: '14px',
    color: '#e2e8f0',
    fontWeight: 500,
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '16px',
    color: '#e2e8f0',
    marginBottom: '12px',
    marginTop: 0,
  },
  contentBlock: {
    padding: '12px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    borderLeft: '3px solid #3b82f6',
  },
  preContent: {
    margin: 0,
    fontSize: '13px',
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'monospace',
    lineHeight: 1.5,
  },
  emptyText: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  toolCallItem: {
    padding: '12px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    marginBottom: '8px',
    borderLeft: '3px solid #10b981',
  },
  toolCallHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  toolName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#10b981',
    fontFamily: 'monospace',
  },
  toolId: {
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  toolStatus: {
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  toolArgs: {
    marginBottom: '8px',
  },
  toolResult: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#0f172a',
    borderRadius: '6px',
  },
  toolDuration: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  argLabel: {
    fontSize: '12px',
    color: '#64748b',
    display: 'block',
    marginBottom: '4px',
  },
  observationItem: {
    padding: '12px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  observationTool: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#f59e0b',
    fontFamily: 'monospace',
    display: 'block',
    marginBottom: '8px',
  },
  reasonBlock: {
    padding: '12px',
    backgroundColor: '#422006',
    borderRadius: '8px',
    color: '#fbbf24',
    fontSize: '14px',
    lineHeight: 1.5,
  },
};
