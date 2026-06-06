import { useState, useMemo } from 'react';
import type { VizEvent } from '../types';
import { formatTimestamp, truncate } from '../utils/format';

interface ContextWindowViewProps {
  events: VizEvent[];
}

interface ContextWindowData {
  timestamp: number;
  provider: string;
  model: string;
  systemPrompt: string;
  messages: Array<{
    role: string;
    content: string;
    thinking?: string;
    tokenEstimate?: number;
  }>;
  tools: Array<{ name: string; description: string }>;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  contextTokenBudget?: number;
  estimatedHistoryTokens?: number;
}

export function ContextWindowView({ events }: ContextWindowViewProps) {
  const contextWindows = useMemo<ContextWindowData[]>(() => {
    const windows: ContextWindowData[] = [];
    
    try {
      console.log('[ContextWindowView] Total events:', events.length);
      
      // 配对 llm_input 和 llm_output 事件
      const inputEvents = events.filter(e => e.type === 'llm_input');
      const outputEvents = events.filter(e => e.type === 'llm_output');
      
      console.log('[ContextWindowView] llm_input:', inputEvents.length, '| llm_output:', outputEvents.length);
      
      for (let i = 0; i < inputEvents.length; i++) {
        const input = inputEvents[i];
        const output = outputEvents[i];
        
        if (!input || !output) continue;
        
        const inputData = input.data as Record<string, unknown>;
        const outputData = output.data as Record<string, unknown>;
        
        const messages: ContextWindowData['messages'] = [];
        
        // 添加 system prompt
        if (inputData.systemPrompt) {
          messages.push({
            role: 'system',
            content: String(inputData.systemPrompt),
          });
        }
        
        // 添加历史消息
        const historyMessages = inputData.historyMessages as Array<{
          role: string;
          content: string;
          thinking?: string;
        }> | undefined;
        
        if (historyMessages && Array.isArray(historyMessages)) {
          for (const msg of historyMessages) {
            if (!msg) continue;
            
            // 解析 content：可能是字符串，也可能是 [{type: 'text', text: '...'}] 格式
            let content = '';
            if (typeof msg.content === 'string') {
              // 尝试解析 JSON 数组格式
              try {
                const parsed = JSON.parse(msg.content);
                if (Array.isArray(parsed)) {
                  content = parsed
                    .filter((item: any) => item?.type === 'text')
                    .map((item: any) => item.text || '')
                    .join('\n');
                } else {
                  content = msg.content;
                }
              } catch {
                content = msg.content;
              }
            } else {
              content = JSON.stringify(msg.content || '');
            }
            
            messages.push({
              role: msg.role || 'unknown',
              content,
              thinking: msg.thinking,
            });
          }
        }
        
        // 添加当前用户消息（来自 llm_input 的 prompt 字段）
        if (inputData.prompt) {
          const promptContent = String(inputData.prompt);
          // 检查是否已经在 historyMessages 中（避免重复）
          const alreadyExists = messages.some(m => m.role === 'user' && m.content === promptContent);
          if (!alreadyExists) {
            messages.push({
              role: 'user',
              content: promptContent,
            });
          }
        }
        
        // 添加 assistant 回复
        if (outputData?.fullAssistantText) {
          messages.push({
            role: 'assistant',
            content: String(outputData.fullAssistantText),
          });
        }
        
        const usage = outputData?.usage as ContextWindowData['usage'] | undefined;
        
        windows.push({
          timestamp: input.timestamp,
          provider: String(inputData.provider || ''),
          model: String(inputData.model || ''),
          systemPrompt: String(inputData.systemPrompt || ''),
          messages,
          tools: Array.isArray(inputData.tools) ? inputData.tools as Array<{ name: string; description: string }> : [],
          usage: {
            input: Number(usage?.input) || 0,
            output: Number(usage?.output) || 0,
            cacheRead: Number(usage?.cacheRead) || 0,
            cacheWrite: Number(usage?.cacheWrite) || 0,
            total: Number(usage?.total) || 0,
          },
          contextTokenBudget: inputData.contextTokenBudget ? Number(inputData.contextTokenBudget) : undefined,
          estimatedHistoryTokens: inputData.estimatedHistoryTokens ? Number(inputData.estimatedHistoryTokens) : undefined,
        });
      }
    } catch (err) {
      console.error('[ContextWindowView] Error parsing data:', err);
    }
    
    return windows.reverse(); // 最新的在前面
  }, [events]);

  if (contextWindows.length === 0) {
    return (
      <div style={styles.empty}>
        <p>暂无 Context Window 数据</p>
        <p style={styles.hint}>发送消息到 Agent 后，这里会显示每次 LLM 调用的完整上下文</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {contextWindows.map((window, index) => (
        <ContextWindowCard key={index} data={window} index={index} totalCount={contextWindows.length} />
      ))}
    </div>
  );
}

function ContextWindowCard({ data, index, totalCount }: { data: ContextWindowData; index: number; totalCount: number }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<number | null>(null);
  
  const totalTokens = data.usage?.total || 0;
  const contextBudget = data.contextTokenBudget || 200000;
  const usagePercent = contextBudget > 0 ? (totalTokens / contextBudget) * 100 : 0;
  
  const roleColors: Record<string, string> = {
    system: '#8b5cf6',
    user: '#3b82f6',
    assistant: '#10b981',
  };
  
  const roleLabels: Record<string, string> = {
    system: 'System',
    user: 'User',
    assistant: 'Assistant',
  };

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div style={styles.headerLeft}>
          <span style={styles.callIndex}>#{totalCount - index}</span>
          <span style={styles.provider}>{data.provider}/{data.model}</span>
          <span style={styles.time}>{formatTimestamp(data.timestamp)}</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.tokenBadge}>
            {totalTokens.toLocaleString()} tokens
          </span>
          <span style={{
            ...styles.expandBtn,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        </div>
      </div>
      
      {/* Token 使用进度条 */}
      <div style={styles.tokenBar}>
        <div style={styles.tokenBarBg}>
          <div style={{
            ...styles.tokenBarFill,
            width: `${Math.min(usagePercent, 100)}%`,
            backgroundColor: usagePercent > 80 ? '#ef4444' : usagePercent > 50 ? '#f59e0b' : '#22c55e',
          }} />
        </div>
        <span style={styles.tokenBarLabel}>
          {usagePercent.toFixed(1)}% of {contextBudget.toLocaleString()}
        </span>
      </div>
      
      {expanded && (
        <div style={styles.cardBody}>
          {/* 消息列表 */}
          <div style={styles.messagesSection}>
            <h4 style={styles.sectionTitle}>
              Messages ({data.messages.length})
            </h4>
            <div style={styles.messageList}>
              {data.messages.map((msg, msgIndex) => (
                <div
                  key={msgIndex}
                  style={{
                    ...styles.messageItem,
                    borderLeftColor: roleColors[msg.role] || '#6b7280',
                  }}
                  onClick={() => setSelectedMessage(selectedMessage === msgIndex ? null : msgIndex)}
                >
                  <div style={styles.messageHeader}>
                    <span style={{
                      ...styles.roleBadge,
                      backgroundColor: roleColors[msg.role] || '#6b7280',
                    }}>
                      {roleLabels[msg.role] || msg.role}
                    </span>
                    <span style={styles.messageIndex}>[{msgIndex}]</span>
                  </div>
                  {msg.thinking && (
                    <div style={styles.thinkingBlock}>
                      <div style={styles.thinkingLabel}>💭 Thinking</div>
                      <pre style={styles.thinkingContent}>
                        {truncate(msg.thinking, expanded ? 500 : 100)}
                      </pre>
                    </div>
                  )}
                  <pre style={styles.messageContent}>
                    {truncate(msg.content, selectedMessage === msgIndex ? 2000 : 200)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
          
          {/* Token 统计 */}
          <div style={styles.statsSection}>
            <h4 style={styles.sectionTitle}>Token Usage</h4>
            <div style={styles.statsGrid}>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Input</span>
                <span style={styles.statValue}>{(data.usage?.input || 0).toLocaleString()}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Output</span>
                <span style={styles.statValue}>{(data.usage?.output || 0).toLocaleString()}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Cache Read</span>
                <span style={styles.statValue}>{(data.usage?.cacheRead || 0).toLocaleString()}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Cache Write</span>
                <span style={styles.statValue}>{(data.usage?.cacheWrite || 0).toLocaleString()}</span>
              </div>
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Total</span>
                <span style={styles.statValue}>{(data.usage?.total || 0).toLocaleString()}</span>
              </div>
              {data.estimatedHistoryTokens && (
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>History Tokens (est.)</span>
                  <span style={styles.statValue}>{data.estimatedHistoryTokens.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Tools */}
          {data.tools.length > 0 && (
            <div style={styles.toolsSection}>
              <h4 style={styles.sectionTitle}>
                Available Tools ({data.tools.length})
              </h4>
              <div style={styles.toolList}>
                {data.tools.map((tool, toolIndex) => (
                  <div key={toolIndex} style={styles.toolItem}>
                    <span style={styles.toolName}>{tool.name}</span>
                    <span style={styles.toolDesc}>{truncate(tool.description, 80)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #334155',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    cursor: 'pointer',
    backgroundColor: '#1e293b',
    transition: 'background-color 0.15s',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  callIndex: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  provider: {
    fontSize: '13px',
    color: '#94a3b8',
  },
  time: {
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  tokenBadge: {
    backgroundColor: '#334155',
    color: '#e2e8f0',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  expandBtn: {
    fontSize: '10px',
    color: '#64748b',
    transition: 'transform 0.2s',
  },
  tokenBar: {
    padding: '0 16px 12px',
  },
  tokenBarBg: {
    height: '6px',
    backgroundColor: '#334155',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  tokenBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s, background-color 0.3s',
  },
  tokenBarLabel: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '4px',
    display: 'block',
  },
  cardBody: {
    padding: '16px',
    borderTop: '1px solid #334155',
  },
  messagesSection: {
    marginBottom: '20px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    fontWeight: 600,
    color: '#f8fafc',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  messageItem: {
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    padding: '12px',
    borderLeft: '3px solid',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  roleBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#fff',
  },
  messageIndex: {
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  thinkingBlock: {
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    padding: '8px',
    marginBottom: '8px',
    borderLeft: '2px solid #8b5cf6',
  },
  thinkingLabel: {
    fontSize: '10px',
    color: '#a78bfa',
    marginBottom: '4px',
  },
  thinkingContent: {
    fontSize: '11px',
    color: '#c4b5fd',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  messageContent: {
    fontSize: '12px',
    color: '#e2e8f0',
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'inherit',
  },
  statsSection: {
    marginBottom: '20px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '8px',
  },
  statItem: {
    backgroundColor: '#0f172a',
    borderRadius: '6px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '10px',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e2e8f0',
    fontFamily: 'monospace',
  },
  toolsSection: {
    marginBottom: '20px',
  },
  toolList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  toolItem: {
    backgroundColor: '#0f172a',
    borderRadius: '4px',
    padding: '8px',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  toolName: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#f59e0b',
    minWidth: '120px',
  },
  toolDesc: {
    fontSize: '11px',
    color: '#94a3b8',
  },
};
