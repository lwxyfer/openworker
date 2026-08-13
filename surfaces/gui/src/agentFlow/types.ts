import type { ConversationMessage } from "../api";
import type { WsEvent } from "../types";

/** The small, UI-independent state machine shared by history replay and live events. */
export type FlowNodeStatus =
  | "queued"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "interrupted";

export type FlowNodeKind =
  | "turn"
  | "model"
  | "tool"
  | "subagent"
  | "gate"
  | "final";

export type FlowEdgeKind = "sequence" | "branch" | "return";

export interface FlowNode {
  /** Stable within a session. Tool nodes use the server call id whenever one is available. */
  id: string;
  kind: FlowNodeKind;
  status: FlowNodeStatus;
  label: string;
  sessionId: string;
  /** The id of the owning `turn` node (including on the turn node itself). */
  turnId: string;
  parentId?: string;
  iteration?: number;
  callId?: string;
  toolName?: string;
  args?: unknown;
  preview?: string;
  detail?: string;
  /** Epoch milliseconds. Missing on old history and on live events without a timestamp. */
  startedAt?: number;
  /** Epoch milliseconds. */
  endedAt?: number;
  /** Sub-agents are opaque until the backend publishes their child event stream. */
  collapsed?: boolean;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  kind: FlowEdgeKind;
  status: FlowNodeStatus;
  animated?: boolean;
}

export interface FlowGraphState {
  sessionId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  activeTurnId?: string;
  activeNodeId?: string;
  /** Increments for accepted actions so memoized renderers can cheaply observe updates. */
  revision: number;
}

export type AgentFlowAction =
  | { type: "reset"; sessionId: string }
  | { type: "hydrate"; sessionId: string; messages: ConversationMessage[] }
  | { type: "event"; sessionId: string; event: WsEvent };

