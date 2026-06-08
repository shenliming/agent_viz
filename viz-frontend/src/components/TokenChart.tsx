import type { TokenData } from '../types/loop';

interface TokenChartProps {
  data: TokenData;
}

export function TokenChart({ data }: TokenChartProps) {
  const { trend, summary, byModel } = data;

  if (trend.length === 0) {
    return <div style={styles.empty}>暂无 Token 数据</div>;
  }

  const maxTokens = Math.max(...trend.map(t => t.totalTokens), 1);

  return (
    <div style={styles.container}>
      {/* Summary Cards */}
      <div style={styles.summaryCards}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryValue}>{formatToken(summary.totalInput)}</span>
          <span style={styles.summaryLabel}>总输入 Token</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryValue}>{formatToken(summary.totalOutput)}</span>
          <span style={styles.summaryLabel}>总输出 Token</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryValue}>{formatToken(summary.total)}</span>
          <span style={styles.summaryLabel}>总计</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryValue}>{summary.avgPerCall.toFixed(0)}</span>
          <span style={styles.summaryLabel}>平均/次</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryValue}>{summary.callCount}</span>
          <span style={styles.summaryLabel}>调用次数</span>
        </div>
      </div>

      {/* Trend Chart */}
      <div style={styles.chartSection}>
        <h3 style={styles.chartTitle}>Token 使用趋势</h3>
        <div style={styles.chart}>
          {trend.map((point, i) => (
            <div key={i} style={styles.barGroup}>
              <div style={styles.barContainer}>
                {/* Input Token Bar */}
                <div
                  style={{
                    ...styles.bar,
                    height: `${(point.inputTokens / maxTokens) * 100}%`,
                    backgroundColor: '#3b82f6',
                  }}
                  title={`输入: ${point.inputTokens}`}
                />
                {/* Output Token Bar */}
                <div
                  style={{
                    ...styles.bar,
                    height: `${(point.outputTokens / maxTokens) * 100}%`,
                    backgroundColor: '#10b981',
                  }}
                  title={`输出: ${point.outputTokens}`}
                />
              </div>
              <span style={styles.barLabel}>#{point.loopIndex}</span>
            </div>
          ))}
        </div>
        <div style={styles.legend}>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendDot, backgroundColor: '#3b82f6' }} />
            输入 Token
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.legendDot, backgroundColor: '#10b981' }} />
            输出 Token
          </span>
        </div>
      </div>

      {/* By Model Table */}
      {byModel.length > 1 && (
        <div style={styles.modelSection}>
          <h3 style={styles.chartTitle}>按模型统计</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>模型</th>
                <th style={styles.th}>调用次数</th>
                <th style={styles.th}>总 Token</th>
                <th style={styles.th}>平均 Token</th>
              </tr>
            </thead>
            <tbody>
              {byModel.map((m, i) => (
                <tr key={i}>
                  <td style={styles.td}>{m.model}</td>
                  <td style={styles.td}>{m.callCount}</td>
                  <td style={styles.td}>{formatToken(m.totalTokens)}</td>
                  <td style={styles.td}>{m.avgTokens.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatToken(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return `${count}`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#64748b',
  },
  summaryCards: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  summaryCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 20px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    minWidth: '100px',
  },
  summaryValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '4px',
  },
  chartSection: {
    padding: '16px',
    backgroundColor: '#0f172a',
    borderRadius: '12px',
  },
  chartTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    color: '#e2e8f0',
  },
  chart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    height: '200px',
    overflowX: 'auto',
    paddingBottom: '24px',
  },
  barGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '20px',
    flex: 1,
  },
  barContainer: {
    display: 'flex',
    gap: '2px',
    alignItems: 'flex-end',
    height: '180px',
  },
  bar: {
    width: '8px',
    minWidth: '8px',
    borderRadius: '2px 2px 0 0',
    transition: 'height 0.3s',
  },
  barLabel: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '4px',
  },
  legend: {
    display: 'flex',
    gap: '16px',
    marginTop: '12px',
    justifyContent: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#94a3b8',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  modelSection: {
    padding: '16px',
    backgroundColor: '#0f172a',
    borderRadius: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid #334155',
    color: '#94a3b8',
    fontSize: '12px',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid #1e293b',
    color: '#e2e8f0',
    fontSize: '13px',
  },
};
