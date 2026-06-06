/**
 * ProxyContextWindowView - 基于代理数据的 Context Window 视图
 * 
 * 显示 LLM 实际收到的完整 request body：
 * - messages（system + user + assistant）
 * - tools（工具定义列表）
 * - 请求参数（model、stream、max_tokens 等）
 * - 响应数据（assistant 回复 + usage）
 */

import { useState, useEffect, useMemo } from 'react';

interface ProxyRequest {
  id: number;
  timestamp: number;
  model: string;
  request_body: {
    messages: Array<{
      role: string;
      content: string | Array<{ type: string; text?: string }>;
    }>;
    tools?: Array<{
      type: string;
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }>;
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    [key: string]: unknown;
  };
  response_body: {
    raw?: string;
  } | null;
  status_code: number;
  duration_ms: number;
  messages_count: number;
  tools_count: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

interface ProxyContextWindowViewProps {
  proxyUrl?: string;
}

export function ProxyContextWindowView({ proxyUrl = 'http://localhost:9002' }: ProxyContextWindowViewProps) {
  const [requests, setRequests] = useState<ProxyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [proxyUrl]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${proxyUrl}/api/requests?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error('[ProxyContextWindow] Failed to load:', err);
      setError(`无法连接到代理服务器 (${proxyUrl})`);
    } finally {
      setLoading(false);
    }
  };

  const selected = useMemo(
    () => requests.find((r) => r.id === selectedId) || null,
    [requests, selectedId]
  );

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  if (error) {
    return (
      <div style={styles.error}>
        <p>{error}</p>
        <button style={styles.retryBtn} onClick={loadRequests}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <h3 style={styles.sidebarTitle}>LLM 请求列表 ({requests.length})</h3>
        <div style={styles.list}>
          {requests.map((req) => (
            <div
              key={req.id}
              style={{
                ...styles.listItem,
                ...(selectedId === req.id ? styles.listItemActive : {}),
              }}
              onClick={() => setSelectedId(req.id)}
            >
              <div style={styles.listItemHeader}>
                <span style={styles.modelName}>{req.model?.split('/').pop() || req.model}</span>
                <span style={styles.tokenBadge}>{req.total_tokens} tok</span>
              </div>
              <div style={styles.listItemMeta}>
                <span>{req.messages_count} msgs</span>
                <span>{req.tools_count} tools</span>
                <span>{req.duration_ms}ms</span>
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <div style={styles.empty}>
              暂无 LLM 请求数据
              <div style={styles.emptyHint}>
                配置 OpenClaw 使用代理后，这里会显示每次 LLM 调用的完整上下文
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.main}>
        {selected ? (
          <RequestDetail request={selected} />
        ) : (
          <div style={styles.placeholder}>
            <p style={styles.placeholderText}>选择一个请求查看完整的 Context Window</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestDetail({ request }: { request: ProxyRequest }) {
  const messages = request.request_body.messages || [];
  const tools = request.request_body.tools || [];
  const [expandedMsg, setExpandedMsg] = useState<string | number | null>(null);

  return (
    <div style={styles.detail}>
      <div style={styles.detailHeader}>
        <h2 style={styles.detailTitle}>Context Window</h2>
        <div style={styles.detailMeta}>
          <span style={styles.metaBadge}>{request.model}</span>
          <span style={styles.metaBadge}>{messages.length} messages</span>
          <span style={styles.metaBadge}>{tools.length} tools</span>
        </div>
      </div>

      {/* Token 统计 */}
      <div style={styles.tokenStats}>
        <div style={styles.tokenStat}>
          <span style={styles.tokenStatLabel}>Input</span>
          <span style={styles.tokenStatValue}>{request.input_tokens}</span>
        </div>
        <div style={styles.tokenStat}>
          <span style={styles.tokenStatLabel}>Output</span>
          <span style={styles.tokenStatValue}>{request.output_tokens}</span>
        </div>
        <div style={styles.tokenStat}>
          <span style={styles.tokenStatLabel}>Total</span>
          <span style={styles.tokenStatValue}>{request.total_tokens}</span>
        </div>
        <div style={styles.tokenStat}>
          <span style={styles.tokenStatLabel}>Duration</span>
          <span style={styles.tokenStatValue}>{request.duration_ms}ms</span>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Messages ({messages.length})</h3>
        <div style={styles.messages}>
          {messages.map((msg, i) => {
            const content = typeof msg.content === 'string' 
              ? msg.content 
              : Array.isArray(msg.content)
                ? msg.content.map(c => c.text || JSON.stringify(c)).join('\n')
                : JSON.stringify(msg.content);
            
            const charCount = content.length;
            const isExpanded = expandedMsg === i;
            const isLong = content.length > 500;
            const displayContent = isLong && !isExpanded ? content.slice(0, 500) + '...' : content;

            return (
              <div key={i} style={styles.message}>
                <div style={styles.messageHeader}>
                  <span style={{
                    ...styles.messageRole,
                    backgroundColor: msg.role === 'system' ? '#8b5cf6' 
                      : msg.role === 'user' ? '#3b82f6' 
                      : '#22c55e',
                  }}>
                    {msg.role}
                  </span>
                  <span style={styles.messageIndex}>[{i}]</span>
                  <span style={styles.charCount}>{charCount} 字符</span>
                  {isLong && (
                    <button 
                      style={styles.expandBtn}
                      onClick={() => setExpandedMsg(isExpanded ? null : i)}
                    >
                      {isExpanded ? '收起' : '展开'}
                    </button>
                  )}
                </div>
                <pre style={styles.messageContent}>{displayContent}</pre>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tools */}
      {tools.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Tools ({tools.length})</h3>
          <div style={styles.tools}>
            {tools.map((tool, i) => {
              const toolJson = JSON.stringify(tool, null, 2);
              const charCount = toolJson.length;
              const isExpanded = expandedMsg === `tool-${i}`;

              return (
                <div key={i} style={styles.tool}>
                  <div style={styles.toolHeader}>
                    <span style={styles.toolName}>{tool.function.name}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={styles.charCount}>{charCount} 字符</span>
                      <button 
                        style={styles.expandBtn}
                        onClick={() => setExpandedMsg(isExpanded ? null : `tool-${i}`)}
                      >
                        {isExpanded ? '收起' : '展开'}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <pre style={styles.toolContent}>{toolJson}</pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Request Parameters */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Request Parameters</h3>
        <div style={styles.params}>
          {Object.entries(request.request_body)
            .filter(([key]) => !['messages', 'tools'].includes(key))
            .map(([key, value]) => (
              <div key={key} style={styles.param}>
                <span style={styles.paramKey}>{key}</span>
                <span style={styles.paramValue}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: 'calc(100vh - 120px)',
    backgroundColor: '#0f172a',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#94a3b8',
    fontSize: '14px',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#ef4444',
    gap: '12px',
  },
  retryBtn: {
    padding: '6px 16px',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '13px',
  },
  sidebar: {
    width: '300px',
    borderRight: '1px solid #334155',
    backgroundColor: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarTitle: {
    margin: 0,
    padding: '16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#f8fafc',
    borderBottom: '1px solid #334155',
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  listItem: {
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '4px',
    border: '1px solid transparent',
    transition: 'all 0.2s',
  },
  listItemActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  listItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  modelName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  tokenBadge: {
    fontSize: '11px',
    backgroundColor: '#334155',
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#94a3b8',
  },
  listItemMeta: {
    display: 'flex',
    gap: '8px',
    fontSize: '11px',
    color: '#64748b',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#64748b',
    fontSize: '14px',
    gap: '8px',
  },
  emptyHint: {
    fontSize: '12px',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  placeholderText: {
    color: '#475569',
    fontSize: '14px',
  },
  detail: {
    maxWidth: '900px',
  },
  detailHeader: {
    marginBottom: '20px',
  },
  detailTitle: {
    margin: '0 0 12px 0',
    fontSize: '20px',
    fontWeight: 600,
    color: '#f8fafc',
  },
  detailMeta: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  metaBadge: {
    fontSize: '12px',
    backgroundColor: '#334155',
    padding: '4px 10px',
    borderRadius: '6px',
    color: '#94a3b8',
  },
  tokenStats: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#1e293b',
    borderRadius: '10px',
  },
  tokenStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
  },
  tokenStatLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  tokenStatValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  messages: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  message: {
    backgroundColor: '#1e293b',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderBottom: '1px solid #334155',
  },
  messageRole: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    padding: '3px 10px',
    borderRadius: '6px',
  },
  messageIndex: {
    fontSize: '11px',
    color: '#64748b',
  },
  charCount: {
    fontSize: '11px',
    color: '#94a3b8',
    backgroundColor: '#334155',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  expandBtn: {
    marginLeft: 'auto',
    padding: '3px 8px',
    border: '1px solid #475569',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '11px',
  },
  messageContent: {
    margin: 0,
    padding: '14px',
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#e2e8f0',
    backgroundColor: 'transparent',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '400px',
    overflow: 'auto',
  },
  tools: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tool: {
    padding: '12px 14px',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    border: '1px solid #334155',
  },
  toolHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  toolName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  toolDesc: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  toolContent: {
    margin: 0,
    padding: '12px',
    fontSize: '12px',
    lineHeight: 1.5,
    color: '#e2e8f0',
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '400px',
    overflow: 'auto',
  },
  params: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  param: {
    display: 'flex',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: '#1e293b',
    borderRadius: '6px',
    fontSize: '13px',
  },
  paramKey: {
    color: '#8b5cf6',
    fontWeight: 500,
    minWidth: '120px',
  },
  paramValue: {
    color: '#e2e8f0',
  },
};
