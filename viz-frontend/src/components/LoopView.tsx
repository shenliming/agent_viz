import { useState, useEffect } from 'react';
import type { Loop, LoopStats, TokenData } from '../types/loop';
import { fetchLoops, fetchLoopStats, fetchTokenData } from '../api/loops';
import { LoopCard } from './LoopCard';
import { LoopDetailModal } from './LoopDetailModal';
import { TokenChart } from './TokenChart';

export function LoopView() {
  const [loops, setLoops] = useState<Loop[]>([]);
  const [stats, setStats] = useState<LoopStats | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [selectedLoop, setSelectedLoop] = useState<Loop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'loops' | 'tokens'>('loops');

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

  function handleLoopClick(loop: Loop) {
    setSelectedLoop(loop);
  }

  if (loading) {
    return <div style={styles.loading}>Loading loops...</div>;
  }

  if (error) {
    return (
      <div style={styles.error}>
        <p>Failed to load loop data: {error}</p>
        <button onClick={loadData} style={styles.retryButton}>Retry</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Stats Summary */}
      {stats && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.totalLoops}</span>
            <span style={styles.statLabel}>总循环</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: '#3b82f6' }}>{stats.toolUseCount}</span>
            <span style={styles.statLabel}>工具调用</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: '#10b981' }}>{stats.directAnswerCount}</span>
            <span style={styles.statLabel}>直接回答</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{formatDuration(stats.totalDurationMs)}</span>
            <span style={styles.statLabel}>总耗时</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{formatDuration(stats.avgDurationMs)}</span>
            <span style={styles.statLabel}>平均耗时</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{formatToken(stats.totalTokens)}</span>
            <span style={styles.statLabel}>总 Token</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'loops' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('loops')}
        >
          🔄 循环列表
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'tokens' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('tokens')}
        >
          📊 Token 趋势
        </button>
      </div>

      {/* Content */}
      {activeTab === 'loops' ? (
        <div style={styles.loopsList}>
          {loops.length === 0 ? (
            <div style={styles.empty}>暂无循环数据</div>
          ) : (
            loops.map((loop) => (
              <LoopCard key={loop.id} loop={loop} onClick={handleLoopClick} />
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
        <LoopDetailModal
          loop={selectedLoop}
          onClose={() => setSelectedLoop(null)}
        />
      )}
    </div>
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '40px',
    color: '#ef4444',
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  statsBar: {
    display: 'flex',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '80px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  statLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '4px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  tab: {
    padding: '8px 16px',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  tabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6',
  },
  loopsList: {
    flex: 1,
    overflowY: 'auto',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#64748b',
  },
  tokensContent: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
  },
};
