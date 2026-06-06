import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { ToolCallNode, ToolCallEdge } from '../types';
import { formatDuration, truncate } from '../utils/format';

interface FlowChartViewProps {
  nodes: ToolCallNode[];
  edges: ToolCallEdge[];
}

export function FlowChartView({ nodes, edges }: FlowChartViewProps) {
  const flowNodes: Node[] = nodes.map((node) => ({
    id: node.id,
    position: { x: 0, y: 0 },
    data: {
      label: node.toolName,
      category: node.toolCategory,
      status: node.status,
      durationMs: node.durationMs,
      params: node.params,
      result: node.result,
      filePath: node.filePath,
    },
    style: {
      backgroundColor: getNodeBg(node.toolCategory, node.status),
      color: getNodeColor(node.toolCategory, node.status),
      border: `1px solid ${getNodeBorder(node.toolCategory, node.status)}`,
      borderRadius: '8px',
      padding: '12px',
      minWidth: '200px',
      fontSize: '12px',
    },
  }));

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.from,
    target: edge.to,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    style: { stroke: '#64748b', strokeWidth: 2 },
  }));

  if (nodes.length === 0) {
    return (
      <div style={styles.empty}>
        <p>暂无工具调用</p>
        <p style={styles.hint}>工具调用流程图将在这里显示</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background color="#334155" gap={16} />
        <Controls style={{ backgroundColor: '#1e293b', color: '#e2e8f0' }} />
      </ReactFlow>
    </div>
  );
}

function getNodeBg(category: string, status: string): string {
  if (status === 'pending') return '#1e293b';
  const colors: Record<string, string> = {
    file_read: '#0c4a6e',
    file_write: '#713f12',
    file_edit: '#713f12',
    exec: '#14532d',
    network: '#581c87',
    search: '#1e3a5f',
    memory: '#4a1d6a',
  };
  return colors[category] || '#1e293b';
}

function getNodeColor(category: string, status: string): string {
  if (status === 'error') return '#fca5a5';
  const colors: Record<string, string> = {
    file_read: '#7dd3fc',
    file_write: '#fde047',
    file_edit: '#fde047',
    exec: '#86efac',
    network: '#d8b4fe',
    search: '#93c5fd',
    memory: '#d8b4fe',
  };
  return colors[category] || '#e2e8f0';
}

function getNodeBorder(category: string, status: string): string {
  if (status === 'error') return '#ef4444';
  if (status === 'pending') return '#475569';
  const colors: Record<string, string> = {
    file_read: '#0ea5e9',
    file_write: '#eab308',
    file_edit: '#eab308',
    exec: '#22c55e',
    network: '#a855f7',
    search: '#3b82f6',
    memory: '#a855f7',
  };
  return colors[category] || '#475569';
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    minHeight: '400px',
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
};
