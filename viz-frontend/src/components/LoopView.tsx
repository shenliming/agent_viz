import { useState, useEffect } from 'react';
import type { Loop, LoopStats, TokenData } from '../types/loop';
import { fetchLoops, fetchLoopStats, fetchTokenData } from '../api/loops';
import { LoopDetailModal } from './LoopDetailModal';
import { TokenChart } from './TokenChart';

const TYPE_CONFIG = {
  tool_use: { icon: '🔧', label: '工具调用', color: '#3b82f6', bg: '#1e3a5f', border: '#3b82f6' },
  direct_answer: { icon: '💬', label: '直接回答', color: '#10b981', bg: '#064e3b', border: '#10b981' },
  error_retry: { icon: '🔄', label: '错误重试', color: '#f59e0b', bg: '#78350f', border: '#f59e0b' },
  unknown: { icon: '❓', label: '未知', color: '#6b7280', bg: '#1f2937', border: '#6b7280' },
};

export function LoopView() {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [stats, setStats] = useState<LoopStats | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [selectedLoop, setSelectedLoop] = useState<Loop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'loops' | 'tokens'>('loops');
  const [expandedLoops, setExpandedLoops] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [loopsData, statsData, tokensData] = await Promise.all([
        fetchLoops(100),
        fetchLoopStats(),
        fetchTokenData(),
      ]);
      setLoops(loopsData);
      setStats(statsData);
      setTokenData(tokensData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function toggleLoop(index: number) {
    setExpandedLoops(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (loading) return <div style={styles.loading}>Loading...</div>;
  if (error) return <div style={styles.error}>{error}</div>;

  // 只展示有工具调用的循环，直接回答的折叠
  const toolLoops = loops.filter(l => l.inferred.loopType === 'tool_use');
  const directLoops = loops.filter(l => l.inferred.loopType === 'direct_answer');

  return (
    <div style={styles.container}>
      {/* Stats */}
      {stats && (
        <div style={styles.statsBar}>
          <Stat value={stats.totalLoops} label="总循环" />
          <Stat value={stats.toolUseCount} label="工具调用" color="#3b82f6" />
          <Stat value={stats.directAnswerCount} label="直接回答" color="#10b981" />
          <Stat value={formatDuration(stats.totalDurationMs)} label="总耗时" />
          <Stat value={formatToken(stats.totalTokens)} label="总 Token" />
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        <Tab active={activeTab === 'loops'} onClick={() => setActiveTab('loops')}>🔄 循环流程</Tab>
        <Tab active={activeTab === 'tokens'} onClick={() => setActiveTab('tokens')}>📊 Token 趋势</Tab>
      </div>

      {activeTab === 'loops' ? (
        <div style={styles.flowView}>
          {loops.length === 0 ? (
            <div style={styles.empty}>暂无循环数据</div>
          ) : (
            loops.map((loop, i) => (
              <div key={loop.id}>
                {/* Arrow connector */}
                {i > 0 && <div style={styles.arrow}>▼</div>}

                {/* Loop Node */}
                <div
                  style={{
                    ...styles.loopNode,
                    borderLeftColor: TYPE_CONFIG[loop.inferred.loopType]?.border || '#6b7280',
                  }}
                  onClick={() => toggleLoop(loop.loopIndex)}
                >
                  {/* Header */}
                  <div style={styles.loopHeader}>
                    <div style={styles.loopHeaderLeft}>
                      <span style={styles.loopIndex}>#{loop.loopIndex}</span>
                      <span style={{
                        ...styles.typeBadge,
                        backgroundColor: TYPE_CONFIG[loop.inferred.loopType]?.bg || '#1f2937',
                        color: TYPE_CONFIG[loop.inferred.loopType]?.color || '#6b7280',
                      }}>
                        {TYPE_CONFIG[loop.inferred.loopType]?.icon} {TYPE_CONFIG[loop.inferred.loopType]?.label}
                      </span>
                      <span style={styles.duration}>{formatDuration(loop.durationMs)}</span>
                      <span style={styles.tokens}>
                        ↑{formatToken(loop.tokenUsage.inputTokens)} ↓{formatToken(loop.tokenUsage.outputTokens)}
                      </span>
                    </div>
                    <span style={styles.expandIcon}>
                      {expandedLoops.has(loop.loopIndex) ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Expanded Content */}
                  {expandedLoops.has(loop.loopIndex) && (
                    <div style={styles.loopBody}>
                      {/* Think */}
                      <div style={styles.phase}>
                        <div style={styles.phaseLabel}>🧠 Think</div>
                        <div style={styles.phaseContent}>
                          {loop.think.content ? truncate(loop.think.content, 300) : <span style={styles.emptyText}>无思考内容</span>}
                        </div>
                      </div>

                      {/* Tool Calls */}
                      {loop.toolCalls.length > 0 && (
                        <div style={styles.phase}>
                          <div style={styles.phaseLabel}>🔧 Tool Calls ({loop.toolCalls.length})</div>
                          <div style={styles.toolCalls}>
                            {loop.toolCalls.map((tc, ti) => (
                              <div key={tc.id || ti} style={styles.toolCallItem}>
                                <span style={styles.toolName}>{tc.name}</span>
                                <span style={styles.toolArgs}>{truncate(tc.arguments, 150)}</span>
                                {/* 工具调用结果 */}
                                {tc.result && (
                                  <span style={styles.toolResult}>
                                    [{tc.status || 'done'}] {truncate(String(tc.result), 100)}
                                  </span>
                                )}
                                {tc.durationMs && (
                                  <span style={styles.toolDuration}>{tc.durationMs}ms</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Observations */}
                      {loop.observations.length > 0 && (
                        <div style={styles.phase}>
                          <div style={styles.phaseLabel}>📋 Observations</div>
                          {loop.observations.map((obs, oi) => (
                            <div key={oi} style={styles.observationItem}>
                              <span style={styles.obsTool}>{obs.toolName}</span>
                              <span style={styles.obsContent}>{truncate(obs.content || '', 200)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* State Changes */}
                      {loop.stateChanges && loop.stateChanges.length > 0 && (
                        <div style={styles.phase}>
                          <div style={styles.phaseLabel}>📊 State Changes</div>
                          {loop.stateChanges.map((sc, si) => (
                            <div key={si} style={styles.stateChangeItem}>
                              <span style={styles.stateFrom}>{sc.from}</span>
                              <span style={styles.stateArrow}>→</span>
                              <span style={styles.stateTo}>{sc.to}</span>
                              {sc.reason && <span style={styles.stateReason}>({sc.reason})</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tool Choice Reason */}
                      {loop.inferred.toolChoiceReason && (
                        <div style={styles.reason}>💡 {loop.inferred.toolChoiceReason}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={styles.tokensContent}>
          {tokenData && <TokenChart data={tokenData} />}
        </div>
      )}

      {/* Detail Modal */}
      {selectedLoop && (
        <LoopDetailModal loop={selectedLoop} onClose={() => setSelectedLoop(null)} />
      )}
    </div>
  );
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={styles.statItem}>
      <span style={{ ...styles.statValue, color: color || '#e2e8f0' }}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

function Tab({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      style={{
        ...styles.tab,
        ...(active ? styles.tabActive : {}),
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatToken(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return `${count}`;
}

function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    color: '#94a3b8',
  },
  error: {
    padding: '40px',
    color: '#ef4444',
    textAlign: 'center',
  },
  statsBar: {
    display: 'flex',
    gap: '16px',
    padding: '12px 16px',
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '70px',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '2px',
  },
  tabs: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
  },
  tab: {
    padding: '6px 14px',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6',
  },
  flowView: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 4px',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#64748b',
  },
  tokensContent: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    padding: '16px',
  },
  arrow: {
    textAlign: 'center',
    color: '#475569',
    fontSize: '12px',
    padding: '4px 0',
  },
  loopNode: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    borderLeft: '4px solid #3b82f6',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  loopHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
  },
  loopHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  loopIndex: {
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#e2e8f0',
  },
  typeBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
  },
  duration: {
    color: '#94a3b8',
    fontSize: '11px',
  },
  tokens: {
    color: '#64748b',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  expandIcon: {
    color: '#475569',
    fontSize: '10px',
  },
  loopBody: {
    padding: '0 14px 12px 14px',
    borderTop: '1px solid #1e293b',
  },
  phase: {
    marginTop: '10px',
  },
  phaseLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '4px',
    fontWeight: 500,
  },
  phaseContent: {
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: 1.5,
    padding: '8px 10px',
    backgroundColor: '#1e293b',
    borderRadius: '6px',
    borderLeft: '2px solid #3b82f6',
  },
  toolCalls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  toolCallItem: {
    padding: '6px 10px',
    backgroundColor: '#1e3a5f',
    borderRadius: '6px',
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  toolName: {
    color: '#93c5fd',
    fontFamily: 'monospace',
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  toolArgs: {
    color: '#64748b',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  toolResult: {
    color: '#10b981',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  toolDuration: {
    color: '#f59e0b',
    fontSize: '11px',
    fontFamily: 'monospace',
    marginLeft: 'auto',
  },
  observationItem: {
    padding: '6px 10px',
    backgroundColor: '#1e293b',
    borderRadius: '6px',
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
    borderLeft: '2px solid #10b981',
  },
  obsTool: {
    color: '#10b981',
    fontFamily: 'monospace',
    fontSize: '12px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  obsContent: {
    color: '#94a3b8',
    fontSize: '11px',
  },
  reason: {
    marginTop: '8px',
    fontSize: '11px',
    color: '#fbbf24',
    padding: '6px 10px',
    backgroundColor: '#422006',
    borderRadius: '6px',
  },
  emptyText: {
    color: '#475569',
    fontStyle: 'italic',
  },
  stateChangeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: '#1e293b',
    borderRadius: '6px',
    marginBottom: '4px',
    fontSize: '11px',
  },
  stateFrom: {
    color: '#ef4444',
    fontFamily: 'monospace',
    fontWeight: 500,
  },
  stateArrow: {
    color: '#64748b',
  },
  stateTo: {
    color: '#10b981',
    fontFamily: 'monospace',
    fontWeight: 500,
  },
  stateReason: {
    color: '#64748b',
    fontSize: '10px',
  },
};
