import type { ConversationMessage } from "../api";
import type { WsEvent } from "../types";
import type {
  AgentFlowAction,
  FlowEdgeKind,
  FlowGraphState,
  FlowNode,
  FlowNodeStatus,
} from "./types";

const TERMINAL = new Set<FlowNodeStatus>(["succeeded", "failed", "interrupted"]);

export function createFlowState(sessionId: string): FlowGraphState {
  return { sessionId, nodes: [], edges: [], revision: 0 };
}

/**
 * Rebuild the graph from the canonical OpenAI-shaped transcript.
 *
 * Each user message starts a turn. Assistant messages are model iterations; their tool calls
 * branch from that iteration and converge on the next one. A tool-free assistant message is
 * represented by a final node so model work and user-visible output remain distinct concepts.
 */
export function hydrateFlowFromMessages(
  sessionId: string,
  messages: ConversationMessage[],
): FlowGraphState {
  const state = createFlowState(sessionId);
  const results = indexToolResults(messages);
  let turn: FlowNode | undefined;
  let iteration = 0;
  let frontier: string[] = [];
  let turnNumber = 0;

  const startTurn = (message?: ConversationMessage) => {
    if (turn && !TERMINAL.has(turn.status)) finishAbandonedHistoryTurn(state, turn);
    turnNumber += 1;
    iteration = 0;
    const id = turnNodeId(sessionId, turnNumber);
    turn = {
      id,
      kind: "turn",
      status: "running",
      label: `Turn ${turnNumber}`,
      sessionId,
      turnId: id,
      detail: message ? contentText(message.content) : undefined,
      startedAt: timestampMs(message?.ts),
    };
    state.nodes.push(turn);
    state.activeTurnId = id;
    state.activeNodeId = id;
    frontier = [id];
  };

  for (const message of messages || []) {
    if (message.role === "user") {
      startTurn(message);
      continue;
    }

    if (message.role === "assistant") {
      if (!turn) startTurn();
      if (!turn) continue;
      iteration += 1;
      const model: FlowNode = {
        id: modelNodeId(turn.id, iteration),
        kind: "model",
        status: "succeeded",
        label: `Model iteration ${iteration}`,
        sessionId,
        turnId: turn.id,
        parentId: turn.id,
        iteration,
        detail: stringValue(message.reasoning),
        preview: previewText(contentText(message.content)),
        startedAt: timestampMs(message.ts),
        endedAt: timestampMs(message.ts),
      };
      state.nodes.push(model);
      for (const source of frontier) {
        addEdge(state, source, model.id, source === turn.id ? "sequence" : "return", "succeeded");
      }

      const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      if (calls.length > 0) {
        frontier = [];
        calls.forEach((call, ordinal) => {
          const callId = stringValue(call?.id) || `history-${iteration}-${ordinal + 1}`;
          const name = toolCallName(call) || "tool";
          const result = results.get(callId);
          const status = result ? statusFromToolResult(result) : "waiting";
          const node: FlowNode = {
            id: callNodeId(turn!.id, callId),
            kind: name === "explore" ? "subagent" : "tool",
            status,
            label: name === "explore" ? "Explore sub-agent" : name,
            sessionId,
            turnId: turn!.id,
            parentId: model.id,
            iteration,
            callId,
            toolName: name,
            args: toolCallArguments(call),
            preview: result ? previewText(contentText(result.content)) : undefined,
            startedAt: timestampMs(message.ts),
            endedAt: result ? timestampMs(result.ts) : undefined,
            ...(name === "explore" ? { collapsed: true } : {}),
          };
          state.nodes.push(node);
          addEdge(state, model.id, node.id, "branch", status);
          frontier.push(node.id);
        });
        const pending = frontier.map((id) => findNode(state, id)).filter(isNode).filter((n) => !TERMINAL.has(n.status));
        if (pending.length > 0) {
          turn.status = "waiting";
          state.activeNodeId = pending[pending.length - 1].id;
        } else {
          turn.status = "running";
          state.activeNodeId = frontier[frontier.length - 1];
        }
      } else {
        const final: FlowNode = {
          id: finalNodeId(model.id),
          kind: "final",
          status: "succeeded",
          label: "Final answer",
          sessionId,
          turnId: turn.id,
          parentId: model.id,
          iteration,
          detail: contentText(message.content),
          preview: previewText(contentText(message.content)),
          startedAt: timestampMs(message.ts),
          endedAt: timestampMs(message.ts),
        };
        state.nodes.push(final);
        addEdge(state, model.id, final.id, "sequence", "succeeded");
        turn.status = "succeeded";
        turn.endedAt = timestampMs(message.ts);
        frontier = [final.id];
        state.activeNodeId = final.id;
      }
      continue;
    }

    if (message.role === "notice" && (message.kind === "error" || message.kind === "interrupted")) {
      if (!turn) startTurn();
      if (!turn) continue;
      const status: FlowNodeStatus = message.kind === "interrupted" ? "interrupted" : "failed";
      terminalizeTurn(
        state,
        turn,
        status,
        message.kind === "interrupted" ? "Interrupted" : "Error",
        stringValue(message.text),
        timestampMs(message.ts),
      );
      frontier = state.activeNodeId ? [state.activeNodeId] : [];
    }
  }

  if (turn && !TERMINAL.has(turn.status)) {
    const pending = nodesForTurn(state, turn.id).filter(
      (node) => node.kind !== "turn" && !TERMINAL.has(node.status),
    );
    state.activeTurnId = turn.id;
    state.activeNodeId = pending[pending.length - 1]?.id || frontier[frontier.length - 1] || turn.id;
  } else {
    state.activeTurnId = undefined;
    state.activeNodeId = undefined;
  }
  state.revision = messages?.length ? 1 : 0;
  return withAnimatedEdge(state);
}

/** Apply one event from the session's existing WebSocket; no additional connection is needed. */
export function reduceFlowEvent(state: FlowGraphState, event: WsEvent): FlowGraphState {
  const data = event.data || {};
  const eventSessionId = stringValue(data.session_id);
  // A late frame from the previous socket must never leak into the newly selected session.
  if (eventSessionId && eventSessionId !== state.sessionId) return state;

  const next = cloneState(state);
  const timestamp = eventTimestamp(data);

  switch (event.type) {
    case "turn_start":
      onTurnStart(next, data, timestamp);
      break;
    case "assistant_delta": {
      const model = ensureRunningModel(next, timestamp);
      if (model && typeof data.text === "string") {
        model.preview = appendStreamPreview(model.preview, data.text);
      }
      break;
    }
    case "reasoning_delta": {
      const model = ensureRunningModel(next, timestamp);
      if (model && typeof data.text === "string") {
        model.detail = `${model.detail || ""}${data.text}`;
      }
      break;
    }
    case "assistant_message":
      onAssistantMessage(next, data, timestamp);
      break;
    case "tool_proposed":
      onToolEvent(next, data, "proposed", timestamp);
      break;
    case "permission_required":
      onGateEvent(next, data, "permission", timestamp);
      break;
    case "directory_requested":
      onGateEvent(next, { ...data, name: data.name || "request_directory" }, "directory", timestamp);
      break;
    case "question_requested":
      onGateEvent(next, { ...data, name: data.name || "ask_user" }, "question", timestamp);
      break;
    case "plan_proposed":
      onGateEvent(next, { ...data, name: data.name || "propose_plan" }, "plan", timestamp);
      break;
    case "tool_started":
      onToolEvent(next, data, "started", timestamp);
      break;
    case "tool_finished":
      onToolEvent(next, data, "finished", timestamp);
      break;
    case "iteration_end":
      onIterationEnd(next, data, timestamp);
      break;
    case "turn_end":
      onTurnEnd(next, data, timestamp);
      break;
    case "interrupted":
      finishLiveTurn(next, "interrupted", "Interrupted", undefined, timestamp);
      break;
    case "error":
      finishLiveTurn(next, "failed", "Error", stringValue(data.error), timestamp);
      break;
    case "turn_done":
      // turn_end/error/interrupted is authoritative. This synthetic server frame only stops
      // animation and protects against a malformed stream ending without a terminal event.
      if (next.activeTurnId) {
        const activeTurn = findNode(next, next.activeTurnId);
        if (activeTurn && !TERMINAL.has(activeTurn.status)) {
          finishLiveTurn(next, "interrupted", "Stopped", undefined, timestamp);
        }
      }
      next.activeTurnId = undefined;
      next.activeNodeId = undefined;
      break;
    default:
      return state;
  }

  next.revision = state.revision + 1;
  refreshActiveTurnStatus(next);
  return withAnimatedEdge(next);
}

export function agentFlowReducer(state: FlowGraphState, action: AgentFlowAction): FlowGraphState {
  switch (action.type) {
    case "reset":
      return createFlowState(action.sessionId);
    case "hydrate":
      return hydrateFlowFromMessages(action.sessionId, action.messages);
    case "event":
      return action.sessionId === state.sessionId ? reduceFlowEvent(state, action.event) : state;
  }
}

function onTurnStart(state: FlowGraphState, data: Record<string, unknown>, timestamp?: number) {
  const active = state.activeTurnId ? findNode(state, state.activeTurnId) : undefined;
  const resumed = data.input === "" || data.input === "(resumed)" || data.retry === true;
  if (active && !TERMINAL.has(active.status) && resumed) {
    const pending = nodesForTurn(state, active.id).filter(
      (node) => node.kind !== "turn" && !TERMINAL.has(node.status),
    );
    active.status = pending.some((node) => node.status === "waiting") ? "waiting" : "running";
    // Durable resume first replays the unanswered trailing tool calls. Do not invent the next
    // model iteration until iteration_end confirms those calls have completed.
    if (pending.length > 0) {
      state.activeNodeId = pending.find((node) => node.kind === "gate")?.id
        || pending[pending.length - 1].id;
      return;
    }
    ensureRunningModel(state, timestamp);
    return;
  }
  if (active && !TERMINAL.has(active.status)) {
    terminalizeTurn(state, active, "interrupted", "Superseded", undefined, timestamp);
  }

  const externalId = stringValue(data.turn_id);
  const ordinal = countNodes(state, "turn") + 1;
  const id = externalId ? `${state.sessionId}:turn:${externalId}` : turnNodeId(state.sessionId, ordinal);
  const existing = findNode(state, id);
  if (existing) {
    if (TERMINAL.has(existing.status)) return;
    existing.status = "running";
    state.activeTurnId = existing.id;
    state.activeNodeId = existing.id;
    ensureRunningModel(state, timestamp);
    return;
  }
  const input = data.display ?? data.input;
  state.nodes.push({
    id,
    kind: "turn",
    status: "running",
    label: `Turn ${ordinal}`,
    sessionId: state.sessionId,
    turnId: id,
    detail: contentText(input),
    startedAt: timestamp,
  });
  state.activeTurnId = id;
  state.activeNodeId = id;
  ensureRunningModel(state, timestamp);
}

function onAssistantMessage(state: FlowGraphState, data: Record<string, unknown>, timestamp?: number) {
  const model = ensureRunningModel(state, timestamp);
  if (!model) return;
  model.status = "succeeded";
  model.endedAt = timestamp;
  model.detail = stringValue(data.reasoning) || model.detail;
  model.preview = previewText(contentText(data.text)) || model.preview;

  const calls = Array.isArray(data.tool_calls) ? data.tool_calls : [];
  if (calls.length === 0) {
    const id = finalNodeId(model.id);
    let final = findNode(state, id);
    if (!final) {
      final = {
        id,
        kind: "final",
        status: "succeeded",
        label: "Final answer",
        sessionId: state.sessionId,
        turnId: model.turnId,
        parentId: model.id,
        iteration: model.iteration,
        detail: contentText(data.text),
        preview: previewText(contentText(data.text)),
        startedAt: timestamp,
        endedAt: timestamp,
      };
      state.nodes.push(final);
    } else {
      final.status = "succeeded";
      final.detail = contentText(data.text);
      final.preview = previewText(contentText(data.text));
      final.endedAt = timestamp;
    }
    addEdge(state, model.id, final.id, "sequence", "succeeded");
    const turn = findNode(state, model.turnId);
    if (turn) {
      turn.status = "succeeded";
      turn.endedAt = timestamp;
    }
    state.activeNodeId = final.id;
    return;
  }

  // Newer backends may publish complete call objects here. Create only calls with stable ids;
  // today's name-only array is intentionally left for tool_proposed, avoiding duplicate rows.
  for (const rawCall of calls) {
    if (!rawCall || typeof rawCall !== "object" || Array.isArray(rawCall)) continue;
    const call = rawCall as Record<string, unknown>;
    const callId = eventCallId(call);
    if (!callId) continue;
    const fn = call.function && typeof call.function === "object" ? call.function as Record<string, unknown> : undefined;
    onToolEvent(
      state,
      {
        call_id: callId,
        name: call.name || fn?.name,
        arguments: call.arguments || fn?.arguments,
      },
      "proposed",
      timestamp,
    );
  }
}

type ToolPhase = "proposed" | "started" | "finished";

function onToolEvent(
  state: FlowGraphState,
  data: Record<string, unknown>,
  phase: ToolPhase,
  timestamp?: number,
) {
  const model = ensureModelForTool(state, timestamp);
  if (!model) return;
  const turnId = model.turnId;
  const name = stringValue(data.name) || "tool";
  const callId = eventCallId(data);
  let tool = findToolForEvent(state, turnId, name, callId, phase);

  if (!tool) {
    const fallbackOrdinal = nodesForTurn(state, turnId).filter(
      (node) => (node.kind === "tool" || node.kind === "subagent") && node.iteration === model.iteration,
    ).length + 1;
    const id = callId
      ? callNodeId(turnId, callId)
      : `${turnId}:tool:${model.iteration || 1}:${fallbackOrdinal}`;
    tool = {
      id,
      kind: name === "explore" ? "subagent" : "tool",
      status: phase === "started" ? "running" : phase === "finished" ? statusFromLive(data.status) : "queued",
      label: name === "explore" ? "Explore sub-agent" : name,
      sessionId: state.sessionId,
      turnId,
      parentId: model.id,
      iteration: model.iteration,
      callId,
      toolName: name,
      args: parseArguments(data.arguments),
      startedAt: timestamp,
      ...(name === "explore" ? { collapsed: true } : {}),
    };
    state.nodes.push(tool);
    addEdge(state, model.id, tool.id, "branch", tool.status);
  } else {
    if (callId) tool.callId = callId;
    if (name !== "tool") {
      tool.toolName = name;
      tool.label = name === "explore" ? "Explore sub-agent" : name;
      if (name === "explore") {
        tool.kind = "subagent";
        tool.collapsed = true;
      }
    }
    if (data.arguments !== undefined) tool.args = parseArguments(data.arguments);
    if (phase === "proposed" && !TERMINAL.has(tool.status)) tool.status = "queued";
    if (phase === "started" && !TERMINAL.has(tool.status)) tool.status = "running";
    if (phase === "finished") tool.status = statusFromLive(data.status);
  }

  if (phase === "finished") {
    tool.preview = previewText(contentText(data.result_preview ?? data.reason)) || tool.preview;
    tool.detail = stringValue(data.reason) || tool.detail;
    tool.endedAt = timestamp;
    resolveToolGate(state, tool, stringValue(data.status), timestamp);
  } else if (phase === "started") {
    tool.startedAt = tool.startedAt ?? timestamp;
    resolveToolGate(state, tool, "approved", timestamp);
  }

  updateIncomingEdgeStatus(state, tool.id, tool.status);
  state.activeNodeId = chooseActiveTool(state, turnId) || tool.id;
}

function onGateEvent(
  state: FlowGraphState,
  data: Record<string, unknown>,
  gateType: "permission" | "directory" | "question" | "plan",
  timestamp?: number,
) {
  const model = ensureModelForTool(state, timestamp);
  if (!model) return;
  const name = stringValue(data.name) || gateToolName(gateType);
  const callId = eventCallId(data);
  let tool = findToolForEvent(state, model.turnId, name, callId, "started");
  if (!tool) {
    onToolEvent(state, { ...data, name, status: "queued" }, "proposed", timestamp);
    tool = findToolForEvent(state, model.turnId, name, callId, "started");
  }
  if (!tool) return;
  if (callId) tool.callId = callId;
  tool.status = "waiting";

  const gateId = `${tool.id}:gate:${gateType}`;
  let gate = findNode(state, gateId);
  if (!gate) {
    gate = {
      id: gateId,
      kind: "gate",
      status: "waiting",
      label: gateLabel(gateType),
      sessionId: state.sessionId,
      turnId: tool.turnId,
      parentId: tool.id,
      iteration: tool.iteration,
      callId: tool.callId,
      toolName: tool.toolName,
      args: tool.args,
      detail: gateDetail(gateType, data),
      startedAt: timestamp,
    };
    state.nodes.push(gate);
    // Insert the human gate before execution instead of drawing a gate/tool cycle.
    for (const edge of state.edges.filter((item) => item.target === tool!.id && item.kind === "branch")) {
      edge.target = gate.id;
      edge.id = edgeId(edge.source, edge.target, edge.kind);
      edge.status = "waiting";
    }
    addEdge(state, gate.id, tool.id, "sequence", "waiting");
  } else {
    gate.status = "waiting";
    gate.detail = gateDetail(gateType, data) || gate.detail;
  }
  state.activeNodeId = gate.id;
}

function onIterationEnd(state: FlowGraphState, data: Record<string, unknown>, timestamp?: number) {
  const turn = activeTurn(state);
  if (!turn) return;
  const statedIteration = numberValue(data.iteration);
  // Durable resume emits iteration=0 for replayed trailing calls even though the canonical
  // history already contains model iteration 1. Never move the visual iteration backwards.
  const nextIteration = Math.max(
    maxIteration(state, turn.id) + 1,
    statedIteration !== undefined ? statedIteration + 1 : 1,
  );
  ensureRunningModel(state, timestamp, nextIteration);
}

function onTurnEnd(state: FlowGraphState, data: Record<string, unknown>, timestamp?: number) {
  const rawStatus = stringValue(data.status);
  if (rawStatus === "completed" || rawStatus === "ok" || rawStatus === "succeeded") {
    const turn = activeTurn(state);
    if (turn) {
      turn.status = "succeeded";
      turn.endedAt = timestamp;
    }
    return;
  }
  finishLiveTurn(
    state,
    rawStatus === "interrupted" ? "interrupted" : "failed",
    rawStatus === "max_iterations_exceeded" ? "Max iterations reached" : "Turn failed",
    rawStatus,
    timestamp,
  );
}

function ensureRunningModel(
  state: FlowGraphState,
  timestamp?: number,
  requestedIteration?: number,
): FlowNode | undefined {
  const turn = activeTurn(state);
  if (!turn) return undefined;
  const turnNodes = nodesForTurn(state, turn.id);
  const running = [...turnNodes].reverse().find(
    (node) => node.kind === "model" && node.status === "running" &&
      (requestedIteration === undefined || node.iteration === requestedIteration),
  );
  if (running) {
    state.activeNodeId = running.id;
    return running;
  }

  const iteration = requestedIteration ?? maxIteration(state, turn.id) + 1;
  const id = modelNodeId(turn.id, iteration);
  const existing = findNode(state, id);
  if (existing) {
    if (!TERMINAL.has(existing.status)) existing.status = "running";
    state.activeNodeId = existing.id;
    return existing;
  }

  const model: FlowNode = {
    id,
    kind: "model",
    status: "running",
    label: `Model iteration ${iteration}`,
    sessionId: state.sessionId,
    turnId: turn.id,
    parentId: turn.id,
    iteration,
    startedAt: timestamp,
  };
  state.nodes.push(model);
  const frontier = currentFrontier(state, turn.id, iteration);
  for (const source of frontier.length ? frontier : [turn.id]) {
    addEdge(state, source, model.id, source === turn.id ? "sequence" : "return", "running");
  }
  turn.status = "running";
  state.activeNodeId = model.id;
  return model;
}

function ensureModelForTool(state: FlowGraphState, timestamp?: number): FlowNode | undefined {
  const turn = activeTurn(state);
  if (!turn) return undefined;
  const newest = [...nodesForTurn(state, turn.id)].reverse().find((node) => node.kind === "model");
  return newest || ensureRunningModel(state, timestamp);
}

function finishLiveTurn(
  state: FlowGraphState,
  status: "failed" | "interrupted",
  label: string,
  detail?: string,
  timestamp?: number,
) {
  const turn = activeTurn(state);
  if (!turn) return;
  terminalizeTurn(state, turn, status, label, detail, timestamp);
}

function terminalizeTurn(
  state: FlowGraphState,
  turn: FlowNode,
  status: "failed" | "interrupted",
  label: string,
  detail?: string,
  timestamp?: number,
) {
  const nonterminal = nodesForTurn(state, turn.id).filter(
    (node) => node.kind !== "turn" && !TERMINAL.has(node.status),
  );
  for (const node of nonterminal) {
    node.status = status;
    node.endedAt = timestamp;
    updateIncomingEdgeStatus(state, node.id, status);
  }
  turn.status = status;
  turn.endedAt = timestamp;
  const id = `${turn.id}:terminal`;
  let terminal = findNode(state, id);
  if (!terminal) {
    terminal = {
      id,
      kind: "final",
      status,
      label,
      sessionId: state.sessionId,
      turnId: turn.id,
      parentId: turn.id,
      detail,
      preview: previewText(detail),
      startedAt: timestamp,
      endedAt: timestamp,
    };
    state.nodes.push(terminal);
  } else {
    terminal.status = status;
    terminal.label = label;
    terminal.detail = detail;
    terminal.endedAt = timestamp;
  }
  const sources = nonterminal.length > 0
    ? nonterminal.map((node) => node.id)
    : currentTerminalSources(state, turn.id, terminal.id);
  for (const source of sources.length ? sources : [turn.id]) {
    addEdge(state, source, terminal.id, "sequence", status);
  }
  state.activeNodeId = terminal.id;
}

function finishAbandonedHistoryTurn(state: FlowGraphState, turn: FlowNode) {
  const pending = nodesForTurn(state, turn.id).filter(
    (node) => node.kind !== "turn" && !TERMINAL.has(node.status),
  );
  for (const node of pending) node.status = "interrupted";
  turn.status = "interrupted";
}

function findToolForEvent(
  state: FlowGraphState,
  turnId: string,
  name: string,
  callId: string | undefined,
  phase: ToolPhase,
): FlowNode | undefined {
  const allTools = nodesForTurn(state, turnId).filter(
    (node) => node.kind === "tool" || node.kind === "subagent",
  );
  if (callId) {
    // Stable call ids are authoritative even when a sparse started/finished event omits `name`.
    const exact = allTools.find((node) => node.callId === callId);
    if (exact) return exact;
    const tools = allTools.filter((node) => node.toolName === name);
    // An old proposed frame may have lacked the id while a newer started/finished frame has it.
    const compatible = tools.find((node) => !node.callId && !TERMINAL.has(node.status));
    if (compatible) return compatible;
    return undefined;
  }
  const tools = allTools.filter((node) => node.toolName === name);
  // A proposal without an id can legitimately be the second parallel call with the same name;
  // always allocate it for a fresh live run. The exception is a hydrated unanswered call: it
  // already has its canonical call id and durable resume re-emits today's id-less proposal.
  if (phase === "proposed") {
    return tools.find((node) => !!node.callId && node.status === "waiting");
  }
  if (phase === "started") {
    return tools.find((node) => node.status === "queued")
      || tools.find((node) => node.status === "waiting")
      || tools.find((node) => node.status === "running");
  }
  return tools.find((node) => node.status === "running")
    || tools.find((node) => node.status === "waiting")
    || tools.find((node) => node.status === "queued");
}

function resolveToolGate(
  state: FlowGraphState,
  tool: FlowNode,
  rawStatus: string | undefined,
  timestamp?: number,
) {
  const gates = nodesForTurn(state, tool.turnId).filter(
    (node) => node.kind === "gate" && node.parentId === tool.id && !TERMINAL.has(node.status),
  );
  const status = rawStatus === "denied"
    ? "failed"
    : statusFromLive(rawStatus) === "interrupted"
      ? "interrupted"
      : "succeeded";
  for (const gate of gates) {
    gate.status = status;
    gate.endedAt = timestamp;
    updateIncomingEdgeStatus(state, gate.id, status);
  }
}

function refreshActiveTurnStatus(state: FlowGraphState) {
  const turn = activeTurn(state);
  if (!turn || TERMINAL.has(turn.status)) return;
  const activeNodes = nodesForTurn(state, turn.id).filter(
    (node) => node.kind !== "turn" && !TERMINAL.has(node.status),
  );
  turn.status = activeNodes.some((node) => node.status === "waiting") ? "waiting" : "running";
}

function chooseActiveTool(state: FlowGraphState, turnId: string): string | undefined {
  const activeTools = nodesForTurn(state, turnId).filter(
    (node) => (node.kind === "tool" || node.kind === "subagent" || node.kind === "gate") &&
      !TERMINAL.has(node.status),
  );
  return activeTools[0]?.id;
}

function currentFrontier(state: FlowGraphState, turnId: string, nextIteration: number): string[] {
  const previous = nodesForTurn(state, turnId).filter(
    (node) => node.iteration === nextIteration - 1 && (node.kind === "tool" || node.kind === "subagent"),
  );
  if (previous.length > 0) return previous.map((node) => node.id);
  const priorModel = findNode(state, modelNodeId(turnId, nextIteration - 1));
  return priorModel ? [priorModel.id] : [];
}

function currentTerminalSources(state: FlowGraphState, turnId: string, terminalId: string): string[] {
  const nodes = nodesForTurn(state, turnId).filter((node) => node.id !== terminalId && node.kind !== "turn");
  if (nodes.length === 0) return [];
  const max = Math.max(...nodes.map((node) => node.iteration || 0));
  const latest = nodes.filter((node) => (node.iteration || 0) === max);
  const tools = latest.filter((node) => node.kind === "tool" || node.kind === "subagent");
  return (tools.length ? tools : latest.filter((node) => node.kind === "model")).map((node) => node.id);
}

function activeTurn(state: FlowGraphState): FlowNode | undefined {
  if (state.activeTurnId) return findNode(state, state.activeTurnId);
  return [...state.nodes].reverse().find((node) => node.kind === "turn" && !TERMINAL.has(node.status));
}

function cloneState(state: FlowGraphState): FlowGraphState {
  return {
    ...state,
    nodes: state.nodes.map((node) => ({ ...node })),
    edges: state.edges.map((edge) => ({ ...edge })),
  };
}

function withAnimatedEdge(state: FlowGraphState): FlowGraphState {
  const activeStatus = state.activeNodeId ? findNode(state, state.activeNodeId)?.status : undefined;
  state.edges = state.edges.map((edge) => ({
    ...edge,
    animated: !!state.activeNodeId && edge.target === state.activeNodeId &&
      (activeStatus === "queued" || activeStatus === "running" || activeStatus === "waiting"),
  }));
  return state;
}

function addEdge(
  state: FlowGraphState,
  source: string,
  target: string,
  kind: FlowEdgeKind,
  status: FlowNodeStatus,
) {
  if (source === target) return;
  const id = edgeId(source, target, kind);
  const existing = state.edges.find((edge) => edge.id === id);
  if (existing) {
    existing.status = status;
    return;
  }
  state.edges.push({ id, source, target, kind, status });
}

function updateIncomingEdgeStatus(state: FlowGraphState, target: string, status: FlowNodeStatus) {
  for (const edge of state.edges) {
    if (edge.target === target) edge.status = status;
  }
}

function indexToolResults(messages: ConversationMessage[]): Map<string, ConversationMessage> {
  const results = new Map<string, ConversationMessage>();
  for (const message of messages || []) {
    if (message.role === "tool" && message.tool_call_id) results.set(message.tool_call_id, message);
  }
  return results;
}

function statusFromToolResult(message: ConversationMessage): FlowNodeStatus {
  const explicit = stringValue(message.status || message._status);
  if (explicit) return statusFromLive(explicit);
  const content = contentText(message.content);
  if (/interrupted by user|\binterrupted\b/i.test(content)) return "interrupted";
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "error" in parsed) return "failed";
  } catch {
    // Plain-text tool output is a successful result.
  }
  return "succeeded";
}

function statusFromLive(value: unknown): FlowNodeStatus {
  switch (String(value || "ok").toLowerCase()) {
    case "queued":
    case "proposed":
      return "queued";
    case "running":
    case "started":
      return "running";
    case "waiting":
    case "pending":
    case "pending_approval":
      return "waiting";
    case "ok":
    case "success":
    case "succeeded":
    case "completed":
    case "allowed":
    case "approved":
      return "succeeded";
    case "interrupted":
    case "cancelled":
    case "canceled":
    case "stopped":
      return "interrupted";
    default:
      return "failed";
  }
}

function gateToolName(type: "permission" | "directory" | "question" | "plan"): string {
  if (type === "directory") return "request_directory";
  if (type === "question") return "ask_user";
  if (type === "plan") return "propose_plan";
  return "tool";
}

function gateLabel(type: "permission" | "directory" | "question" | "plan"): string {
  if (type === "directory") return "Directory access";
  if (type === "question") return "Waiting for answer";
  if (type === "plan") return "Plan approval";
  return "Permission approval";
}

function gateDetail(type: "permission" | "directory" | "question" | "plan", data: Record<string, unknown>) {
  if (type === "plan") return stringValue(data.plan);
  if (type === "question") return stringValue(data.question);
  return stringValue(data.reason);
}

function eventCallId(data: Record<string, unknown>): string | undefined {
  return stringValue(data.call_id ?? data.tool_call_id ?? data.callId ?? data.id);
}

function toolCallName(call: unknown): string | undefined {
  if (!call || typeof call !== "object") return undefined;
  const record = call as Record<string, unknown>;
  if (record.function && typeof record.function === "object") {
    return stringValue((record.function as Record<string, unknown>).name);
  }
  return stringValue(record.name);
}

function toolCallArguments(call: unknown): unknown {
  if (!call || typeof call !== "object") return {};
  const record = call as Record<string, unknown>;
  const fn = record.function && typeof record.function === "object"
    ? record.function as Record<string, unknown>
    : record;
  return parseArguments(fn.arguments);
}

function parseArguments(value: unknown): unknown {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function eventTimestamp(data: Record<string, unknown>): number | undefined {
  return timestampMs(data.timestamp ?? data.ts);
}

function timestampMs(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}

function numberValue(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (content === undefined || content === null) return "";
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && typeof part === "object" && (part as Record<string, unknown>).type === "text")
      .map((part) => stringValue((part as Record<string, unknown>).text) || "")
      .filter(Boolean)
      .join("\n\n");
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function previewText(value: string | undefined, max = 180): string | undefined {
  if (!value) return undefined;
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function appendStreamPreview(current: string | undefined, delta: string, max = 180): string | undefined {
  const combined = `${current || ""}${delta}`;
  if (!combined) return undefined;
  return combined.length > max ? `${combined.slice(0, max - 1)}…` : combined;
}

function nodesForTurn(state: FlowGraphState, turnId: string): FlowNode[] {
  return state.nodes.filter((node) => node.turnId === turnId);
}

function maxIteration(state: FlowGraphState, turnId: string): number {
  return Math.max(0, ...nodesForTurn(state, turnId).map((node) => node.iteration || 0));
}

function countNodes(state: FlowGraphState, kind: FlowNode["kind"]): number {
  return state.nodes.filter((node) => node.kind === kind).length;
}

function findNode(state: FlowGraphState, id: string): FlowNode | undefined {
  return state.nodes.find((node) => node.id === id);
}

function isNode(value: FlowNode | undefined): value is FlowNode {
  return value !== undefined;
}

function turnNodeId(sessionId: string, ordinal: number): string {
  return `${sessionId}:turn:${ordinal}`;
}

function modelNodeId(turnId: string, iteration: number): string {
  return `${turnId}:model:${iteration}`;
}

function callNodeId(turnId: string, callId: string): string {
  return `${turnId}:call:${callId}`;
}

function finalNodeId(modelId: string): string {
  return `${modelId}:final`;
}

function edgeId(source: string, target: string, kind: FlowEdgeKind): string {
  return `${source}->${target}:${kind}`;
}
