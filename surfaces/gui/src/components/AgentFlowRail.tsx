import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import type { FlowGraphState, FlowNode } from "../agentFlow/types";
import { Icon, type IconName } from "./Icon";

interface Props {
  active?: boolean;
  graph: FlowGraphState;
  onClose: () => void;
  sessionTitle?: string;
}

type CanvasNodeData = {
  flowNode: FlowNode;
  active: boolean;
};

type AgentCanvasNode = Node<CanvasNodeData, "agentFlow">;

const NODE_WIDTH = 228;
const NODE_GAP_X = 48;
const NODE_GAP_Y = 62;

const STATUS_LABELS: Record<FlowNode["status"], string> = {
  queued: "Queued",
  running: "Running",
  waiting: "Waiting",
  succeeded: "Complete",
  failed: "Failed",
  interrupted: "Stopped",
};

const KIND_LABELS: Record<FlowNode["kind"], string> = {
  turn: "Turn",
  model: "Model",
  tool: "Tool",
  subagent: "Agent",
  gate: "Approval",
  final: "Result",
};

const KIND_ICONS: Record<FlowNode["kind"], IconName> = {
  turn: "chat",
  model: "sparkle",
  tool: "wrench",
  subagent: "branch",
  gate: "shield",
  final: "diamond",
};

const LEGEND_STATUSES: FlowNode["status"][] = [
  "queued",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "interrupted",
];

function AgentFlowCard({ data, selected }: NodeProps<AgentCanvasNode>) {
  const node = data.flowNode;
  const detail = node.detail || node.preview;
  const duration = formatDuration(node.startedAt, node.endedAt);

  return (
    <article
      className={[
        "agent-flow-node",
        `kind-${node.kind}`,
        `status-${node.status}`,
        data.active ? "is-current" : "",
        selected ? "is-selected" : "",
      ].filter(Boolean).join(" ")}
      aria-label={`${node.label}, ${STATUS_LABELS[node.status]}`}
    >
      <Handle type="target" position={Position.Top} className="agent-flow-handle" />
      <div className="agent-flow-node-topline">
        <span className="agent-flow-node-kind">
          <span className="agent-flow-node-icon"><Icon name={KIND_ICONS[node.kind]} size={13} /></span>
          {KIND_LABELS[node.kind]}
        </span>
        <span className={`agent-flow-node-status status-${node.status}`}>
          <span className="agent-flow-status-dot" />
          {STATUS_LABELS[node.status]}
        </span>
      </div>
      <div className="agent-flow-node-label" title={node.label}>{node.label}</div>
      {(node.toolName || node.iteration != null || duration) && (
        <div className="agent-flow-node-meta">
          {node.toolName && <span title={node.toolName}>{node.toolName}</span>}
          {node.iteration != null && <span>Iteration {node.iteration}</span>}
          {duration && <span>{duration}</span>}
        </div>
      )}
      {detail && <div className="agent-flow-node-detail" title={detail}>{detail}</div>}
      {data.active && <span className="agent-flow-current-tag">Current</span>}
      <Handle type="source" position={Position.Bottom} className="agent-flow-handle" />
    </article>
  );
}

const NODE_TYPES = { agentFlow: AgentFlowCard };

export function AgentFlowRail({ active = true, graph, onClose, sessionTitle }: Props) {
  const flowRef = useRef<ReactFlowInstance<AgentCanvasNode, Edge> | null>(null);
  const previousRevision = useRef(-1);
  const previousSession = useRef(graph.sessionId);
  const [ready, setReady] = useState(false);
  const canvas = useMemo(() => toCanvasGraph(graph), [graph]);
  const summary = useMemo(() => summarizeGraph(graph), [graph]);

  const focusCurrent = useCallback(() => {
    if (!graph.activeNodeId) return;
    void flowRef.current?.fitView({
      nodes: [{ id: graph.activeNodeId }],
      duration: prefersReducedMotion() ? 0 : 260,
      padding: 0.75,
      maxZoom: 1.2,
    });
  }, [graph.activeNodeId]);

  useEffect(() => {
    if (previousSession.current !== graph.sessionId) {
      previousSession.current = graph.sessionId;
      previousRevision.current = -1;
    }
    if (!ready || canvas.nodes.length === 0) return;
    if (previousRevision.current === graph.revision) return;
    previousRevision.current = graph.revision;
    const frame = requestAnimationFrame(() => {
      void flowRef.current?.fitView({
        padding: 0.2,
        maxZoom: 1,
        duration: prefersReducedMotion() ? 0 : 180,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [canvas.nodes.length, graph.revision, graph.sessionId, ready]);

  if (!active) return null;

  return (
    <aside className="agent-flow-rail" aria-label="Agent run flow">
      <header className="agent-flow-head">
        <div className="agent-flow-heading">
          <span className="agent-flow-title-icon"><Icon name="flow" size={16} /></span>
          <div className="agent-flow-heading-copy">
            <h2>Agent flow</h2>
            <span className="agent-flow-subtitle" title={sessionTitle}>
              {sessionTitle || "Current session"}
            </span>
          </div>
        </div>
        <div className="agent-flow-head-actions">
          <span
            className={`agent-flow-summary status-${summary.status}`}
            role="status"
            aria-live="polite"
          >
            <span className="agent-flow-status-dot" />
            {summary.label}
          </span>
          <button
            type="button"
            className="agent-flow-icon-btn"
            onClick={onClose}
            title="Close agent flow"
            aria-label="Close agent flow"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </header>

      <div className="agent-flow-toolbar">
        <div className="agent-flow-legend" aria-label="Run status legend">
          {LEGEND_STATUSES.map((status) => (
            <span className={`agent-flow-legend-item status-${status}`} key={status}>
              <span className="agent-flow-status-dot" />
              {STATUS_LABELS[status]}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="agent-flow-focus-btn"
          onClick={focusCurrent}
          disabled={!graph.activeNodeId}
          title={graph.activeNodeId ? "Focus the current step" : "No active step"}
        >
          <Icon name="locate" size={13} />
          Current
        </button>
      </div>

      <div className="agent-flow-canvas" data-testid="agent-flow-canvas">
        <ReactFlow<AgentCanvasNode, Edge>
          nodes={canvas.nodes}
          edges={canvas.edges}
          nodeTypes={NODE_TYPES}
          onInit={(instance) => {
            flowRef.current = instance;
            setReady(true);
          }}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.35}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          proOptions={{ hideAttribution: true }}
          aria-label="Agent run graph"
        >
          <Background color="var(--line-strong)" gap={20} size={1} />
          {canvas.nodes.length > 0 && (
            <Controls
              className="agent-flow-controls"
              position="bottom-left"
              showInteractive={false}
              aria-label="Agent flow view controls"
            />
          )}
        </ReactFlow>

        {canvas.nodes.length === 0 && (
          <div className="agent-flow-empty">
            <span className="agent-flow-empty-icon"><Icon name="flow" size={25} /></span>
            <strong>No run activity yet</strong>
            <span>The agent's steps will appear here when this session starts running.</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function toCanvasGraph(graph: FlowGraphState): { nodes: AgentCanvasNode[]; edges: Edge[] } {
  const positions = layoutNodes(graph.nodes, graph.edges);
  const nodes: AgentCanvasNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: "agentFlow",
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: { flowNode: node, active: node.id === graph.activeNodeId },
    selected: node.id === graph.activeNodeId,
    draggable: false,
    connectable: false,
    focusable: true,
    ariaLabel: `${node.label}, ${STATUS_LABELS[node.status]}`,
  }));

  const edges: Edge[] = graph.edges.map((edge) => {
    const active = edge.animated ?? edge.status === "running";
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.kind === "branch" ? "smoothstep" : "default",
      animated: active,
      className: [
        "agent-flow-edge",
        `status-${edge.status}`,
        `kind-${edge.kind}`,
      ].join(" "),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
      },
      style: { strokeWidth: active ? 1.8 : 1.35 },
    };
  });

  return { nodes, edges };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function layoutNodes(nodes: FlowNode[], edges: FlowGraphState["edges"]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return positions;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  nodes.forEach((node) => {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  });
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    outgoing.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  });

  const depth = new Map<string, number>();
  const queue = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
  queue.forEach((id) => depth.set(id, 0));
  const remainingIncoming = new Map(incoming);
  let cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor++];
    const nextDepth = (depth.get(id) ?? 0) + 1;
    for (const target of outgoing.get(id) ?? []) {
      depth.set(target, Math.max(depth.get(target) ?? 0, nextDepth));
      const count = (remainingIncoming.get(target) ?? 1) - 1;
      remainingIncoming.set(target, count);
      if (count === 0) queue.push(target);
    }
  }

  // A malformed/cyclic trace should still be visible rather than collapsing every node at 0,0.
  let fallbackDepth = Math.max(0, ...depth.values());
  nodes.forEach((node) => {
    if (!depth.has(node.id)) depth.set(node.id, ++fallbackDepth);
  });

  const layers = new Map<number, FlowNode[]>();
  nodes.forEach((node) => {
    const layer = depth.get(node.id) ?? 0;
    layers.set(layer, [...(layers.get(layer) ?? []), node]);
  });

  [...layers.entries()].sort(([a], [b]) => a - b).forEach(([layer, layerNodes]) => {
    const layerWidth = layerNodes.length * NODE_WIDTH + Math.max(0, layerNodes.length - 1) * NODE_GAP_X;
    layerNodes.forEach((node, index) => {
      positions.set(node.id, {
        x: index * (NODE_WIDTH + NODE_GAP_X) - layerWidth / 2 + NODE_WIDTH / 2,
        y: layer * (116 + NODE_GAP_Y),
      });
    });
  });

  return positions;
}

function summarizeGraph(graph: FlowGraphState): { status: FlowNode["status"] | "idle"; label: string } {
  if (graph.nodes.length === 0) return { status: "idle", label: "Idle" };
  const active = graph.activeNodeId
    ? graph.nodes.find((node) => node.id === graph.activeNodeId)
    : undefined;
  if (active) return { status: active.status, label: STATUS_LABELS[active.status] };
  const latest = graph.nodes[graph.nodes.length - 1];
  return { status: latest.status, label: STATUS_LABELS[latest.status] };
}

function formatDuration(startedAt?: number, endedAt?: number): string | null {
  if (startedAt == null) return null;
  const end = endedAt ?? Date.now();
  const elapsed = Math.max(0, end - startedAt);
  if (elapsed < 1_000) return `${Math.round(elapsed)}ms`;
  if (elapsed < 60_000) return `${(elapsed / 1_000).toFixed(elapsed < 10_000 ? 1 : 0)}s`;
  const minutes = Math.floor(elapsed / 60_000);
  const seconds = Math.round((elapsed % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}
