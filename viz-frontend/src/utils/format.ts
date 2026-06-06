import { format } from 'date-fns';

export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return format(date, 'HH:mm:ss.SSS');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function truncate(str: string | null | undefined, maxLen: number = 100): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

export function getEventColor(type: string): string {
  const colors: Record<string, string> = {
    llm_input: '#3b82f6',
    llm_output: '#10b981',
    model_call_started: '#8b5cf6',
    model_call_ended: '#6366f1',
    before_tool_call: '#f59e0b',
    after_tool_call: '#f97316',
    agent_state_change: '#ec4899',
    session_start: '#22c55e',
    session_end: '#ef4444',
    before_compaction: '#6b7280',
    after_compaction: '#9ca3af',
    message_received: '#06b6d4',
    message_sent: '#14b8a6',
  };
  return colors[type] || '#6b7280';
}

export function getEventLabel(type: string): string {
  const labels: Record<string, string> = {
    llm_input: 'LLM Input',
    llm_output: 'LLM Output',
    model_call_started: 'Model Call Start',
    model_call_ended: 'Model Call End',
    before_tool_call: 'Tool Call Start',
    after_tool_call: 'Tool Call End',
    agent_state_change: 'State Change',
    session_start: 'Session Start',
    session_end: 'Session End',
    before_compaction: 'Compaction Start',
    after_compaction: 'Compaction End',
    message_received: 'Message Received',
    message_sent: 'Message Sent',
  };
  return labels[type] || type;
}
