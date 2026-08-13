import { describe, expect, it } from "vitest";
import type { ConversationMessage } from "../api";
import type { WsEvent } from "../types";
import {
  agentFlowReducer,
  createFlowState,
  hydrateFlowFromMessages,
  reduceFlowEvent,
} from "./reducer";

const ws = (type: WsEvent["type"], data: Record<string, unknown> = {}): WsEvent => ({ type, data });

describe("hydrateFlowFromMessages", () => {
  it("rebuilds turn → model → parallel tools → next model → final semantics", () => {
    const messages: ConversationMessage[] = [
      { role: "system", content: "system prompt" },
      { role: "user", content: "Inspect the repository", ts: 10 },
      {
        role: "assistant",
        content: "I will inspect it.",
        reasoning: "Need two independent reads",
        ts: 11,
        tool_calls: [
          { id: "call-a", function: { name: "read_file", arguments: '{"path":"a.ts"}' } },
          { id: "call-b", function: { name: "git_log", arguments: "{}" } },
        ],
      },
      { role: "tool", tool_call_id: "call-a", content: "file contents", ts: 12 },
      { role: "tool", tool_call_id: "call-b", content: '{"commits":[]}', ts: 13 },
      { role: "assistant", content: "Everything looks good.", ts: 14 },
    ];

    const graph = hydrateFlowFromMessages("session-1", messages);
    expect(graph.nodes.map((node) => [node.kind, node.status])).toEqual([
      ["turn", "succeeded"],
      ["model", "succeeded"],
      ["tool", "succeeded"],
      ["tool", "succeeded"],
      ["model", "succeeded"],
      ["final", "succeeded"],
    ]);

    const [turn, firstModel, firstTool, secondTool, secondModel, final] = graph.nodes;
    expect(turn.detail).toBe("Inspect the repository");
    expect(firstModel.detail).toBe("Need two independent reads");
    expect(firstTool).toMatchObject({ callId: "call-a", toolName: "read_file", args: { path: "a.ts" } });
    expect(secondTool).toMatchObject({ callId: "call-b", toolName: "git_log" });
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: turn.id, target: firstModel.id, kind: "sequence" }),
      expect.objectContaining({ source: firstModel.id, target: firstTool.id, kind: "branch" }),
      expect.objectContaining({ source: firstModel.id, target: secondTool.id, kind: "branch" }),
      expect.objectContaining({ source: firstTool.id, target: secondModel.id, kind: "return" }),
      expect.objectContaining({ source: secondTool.id, target: secondModel.id, kind: "return" }),
      expect.objectContaining({ source: secondModel.id, target: final.id, kind: "sequence" }),
    ]));
    expect(graph.activeTurnId).toBeUndefined();
    expect(graph.activeNodeId).toBeUndefined();
  });

  it("keeps unanswered historical calls waiting and renders explore as an opaque sub-agent", () => {
    const graph = hydrateFlowFromMessages("session-2", [
      { role: "user", content: "research this" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "explore-1", function: { name: "explore", arguments: '{"task":"map it"}' } },
        ],
      },
    ]);

    const turn = graph.nodes.find((node) => node.kind === "turn");
    const child = graph.nodes.find((node) => node.kind === "subagent");
    expect(turn?.status).toBe("waiting");
    expect(child).toMatchObject({
      status: "waiting",
      collapsed: true,
      callId: "explore-1",
      toolName: "explore",
      args: { task: "map it" },
    });
    expect(graph.activeTurnId).toBe(turn?.id);
    expect(graph.activeNodeId).toBe(child?.id);
  });

  it("derives failed and interrupted tool/turn states from canonical results and notices", () => {
    const failed = hydrateFlowFromMessages("failed", [
      { role: "user", content: "do it" },
      {
        role: "assistant",
        tool_calls: [{ id: "bad", function: { name: "shell", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "bad", content: '{"error":"nope"}' },
      { role: "notice", kind: "error", text: "provider unavailable" },
    ]);
    expect(failed.nodes.find((node) => node.toolName === "shell")?.status).toBe("failed");
    expect(failed.nodes.find((node) => node.kind === "turn")?.status).toBe("failed");
    expect(failed.nodes.find((node) => node.id.endsWith(":terminal"))).toMatchObject({
      kind: "final",
      status: "failed",
      detail: "provider unavailable",
    });

    const interrupted = hydrateFlowFromMessages("stopped", [
      { role: "user", content: "do it" },
      { role: "assistant", content: "partial" },
      { role: "notice", kind: "interrupted" },
    ]);
    expect(interrupted.nodes.find((node) => node.kind === "turn")?.status).toBe("interrupted");
    expect(interrupted.nodes.find((node) => node.id.endsWith(":terminal"))?.status).toBe("interrupted");
  });

  it("separates consecutive user turns and marks an unfinished superseded turn interrupted", () => {
    const graph = hydrateFlowFromMessages("multi", [
      { role: "user", content: "first" },
      { role: "assistant", tool_calls: [{ id: "pending", function: { name: "read", arguments: "{}" } }] },
      { role: "user", content: "second" },
      { role: "assistant", content: "done" },
    ]);
    const turns = graph.nodes.filter((node) => node.kind === "turn");
    expect(turns.map((turn) => turn.status)).toEqual(["interrupted", "succeeded"]);
    expect(new Set(graph.nodes.map((node) => node.turnId))).toEqual(new Set(turns.map((turn) => turn.id)));
  });
});

describe("reduceFlowEvent", () => {
  it("tracks a complete live run and creates the next model iteration after tool results", () => {
    let graph = createFlowState("live");
    graph = reduceFlowEvent(graph, ws("turn_start", { input: "inspect", ts: 20 }));
    graph = reduceFlowEvent(graph, ws("reasoning_delta", { text: "thinking" }));
    graph = reduceFlowEvent(graph, ws("assistant_message", { text: "", tool_calls: ["read_file"] }));
    graph = reduceFlowEvent(graph, ws("tool_proposed", {
      call_id: "c1",
      name: "read_file",
      arguments: { path: "a.ts" },
    }));
    graph = reduceFlowEvent(graph, ws("tool_started", { call_id: "c1", name: "read_file" }));
    graph = reduceFlowEvent(graph, ws("tool_finished", {
      call_id: "c1",
      name: "read_file",
      status: "ok",
      result_preview: "contents",
    }));
    graph = reduceFlowEvent(graph, ws("iteration_end", { iteration: 1 }));
    graph = reduceFlowEvent(graph, ws("assistant_message", { text: "Done", tool_calls: [] }));
    graph = reduceFlowEvent(graph, ws("turn_end", { status: "completed" }));
    graph = reduceFlowEvent(graph, ws("turn_done"));

    const tool = graph.nodes.find((node) => node.callId === "c1");
    expect(tool).toMatchObject({ status: "succeeded", preview: "contents", args: { path: "a.ts" } });
    expect(graph.nodes.filter((node) => node.kind === "model").map((node) => node.iteration)).toEqual([1, 2]);
    expect(graph.nodes.find((node) => node.kind === "final")).toMatchObject({ status: "succeeded", detail: "Done" });
    expect(graph.nodes.find((node) => node.kind === "turn")?.status).toBe("succeeded");
    expect(graph.nodes.some((node) => node.label === "Stopped")).toBe(false);
    expect(graph.activeTurnId).toBeUndefined();
  });

  it("updates the same call-id node idempotently instead of appending duplicates", () => {
    let graph = createFlowState("idempotent");
    graph = reduceFlowEvent(graph, ws("turn_start", { input: "go" }));
    const events = [
      ws("tool_proposed", { call_id: "same", name: "shell", arguments: { command: "pwd" } }),
      ws("tool_proposed", { call_id: "same", name: "shell", arguments: { command: "pwd" } }),
      ws("tool_started", { call_id: "same", name: "shell" }),
      ws("tool_started", { call_id: "same", name: "shell" }),
      ws("tool_finished", { call_id: "same", name: "shell", status: "error", reason: "boom" }),
      ws("tool_finished", { call_id: "same", name: "shell", status: "error", reason: "boom" }),
    ];
    for (const event of events) graph = reduceFlowEvent(graph, event);

    const calls = graph.nodes.filter((node) => node.callId === "same");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ status: "failed", detail: "boom" });
    expect(graph.edges.filter((edge) => edge.target === calls[0].id)).toHaveLength(1);
  });

  it("uses a stable call id even when a later event omits the tool name", () => {
    let graph = createFlowState("sparse");
    graph = reduceFlowEvent(graph, ws("turn_start", { input: "go" }));
    graph = reduceFlowEvent(graph, ws("tool_proposed", { call_id: "call-1", name: "shell" }));
    graph = reduceFlowEvent(graph, ws("tool_started", { call_id: "call-1" }));
    graph = reduceFlowEvent(graph, ws("tool_finished", { call_id: "call-1", status: "ok" }));
    expect(graph.nodes.filter((node) => node.callId === "call-1")).toHaveLength(1);
    expect(graph.nodes.find((node) => node.callId === "call-1")).toMatchObject({
      toolName: "shell",
      status: "succeeded",
    });
  });

  it("resumes a hydrated pending tool without inventing a call or model iteration", () => {
    let graph = hydrateFlowFromMessages("resume", [
      { role: "user", content: "inspect" },
      {
        role: "assistant",
        tool_calls: [{ id: "persisted-call", function: { name: "read", arguments: '{"path":"a"}' } }],
      },
    ]);
    graph = reduceFlowEvent(graph, ws("turn_start", { input: "(resumed)" }));
    expect(graph.nodes.filter((node) => node.kind === "model")).toHaveLength(1);
    graph = reduceFlowEvent(graph, ws("tool_proposed", { name: "read", arguments: { path: "a" } }));
    graph = reduceFlowEvent(graph, ws("tool_started", { name: "read" }));
    graph = reduceFlowEvent(graph, ws("tool_finished", { name: "read", status: "ok" }));
    expect(graph.nodes.filter((node) => node.kind === "tool")).toHaveLength(1);
    expect(graph.nodes.find((node) => node.callId === "persisted-call")?.status).toBe("succeeded");
    graph = reduceFlowEvent(graph, ws("iteration_end", { iteration: 0 }));
    expect(graph.nodes.filter((node) => node.kind === "model")).toHaveLength(2);
  });

  it("streams model reasoning and answer previews into the running model node", () => {
    let graph = createFlowState("streaming");
    graph = reduceFlowEvent(graph, ws("turn_start", { input: "go" }));
    graph = reduceFlowEvent(graph, ws("reasoning_delta", { text: "one " }));
    graph = reduceFlowEvent(graph, ws("reasoning_delta", { text: "two" }));
    graph = reduceFlowEvent(graph, ws("assistant_delta", { text: "Hello " }));
    graph = reduceFlowEvent(graph, ws("assistant_delta", { text: "world" }));
    expect(graph.nodes.find((node) => node.kind === "model")).toMatchObject({
      status: "running",
      detail: "one two",
      preview: "Hello world",
    });
  });

  it("falls back to FIFO matching for parallel same-name tools without call ids", () => {
    let graph = createFlowState("legacy");
    graph = reduceFlowEvent(graph, ws("turn_start", { input: "read both" }));
    graph = reduceFlowEvent(graph, ws("assistant_message", { text: "", tool_calls: ["read", "read"] }));
    graph = reduceFlowEvent(graph, ws("tool_proposed", { name: "read", arguments: { path: "a" } }));
    graph = reduceFlowEvent(graph, ws("tool_proposed", { name: "read", arguments: { path: "b" } }));
    graph = reduceFlowEvent(graph, ws("tool_started", { name: "read" }));
    graph = reduceFlowEvent(graph, ws("tool_started", { name: "read" }));
    graph = reduceFlowEvent(graph, ws("tool_finished", { name: "read", status: "ok", result_preview: "A" }));
    graph = reduceFlowEvent(graph, ws("tool_finished", { name: "read", status: "error", reason: "B failed" }));

    const calls = graph.nodes.filter((node) => node.toolName === "read");
    expect(calls).toHaveLength(2);
    expect(calls.map((node) => node.args)).toEqual([{ path: "a" }, { path: "b" }]);
    expect(calls.map((node) => node.status)).toEqual(["succeeded", "failed"]);
    expect(calls.map((node) => node.preview)).toEqual(["A", "B failed"]);
  });

  it("represents approval as a waiting gate and resolves it when execution starts", () => {
    let graph = createFlowState("approval");
    graph = reduceFlowEvent(graph, ws("turn_start", { input: "run it" }));
    graph = reduceFlowEvent(graph, ws("tool_proposed", {
      call_id: "exec-1",
      name: "shell",
      arguments: { command: "npm test" },
    }));
    graph = reduceFlowEvent(graph, ws("permission_required", {
      call_id: "exec-1",
      name: "shell",
      reason: "Needs approval",
    }));

    const tool = graph.nodes.find((node) => node.callId === "exec-1" && node.kind === "tool");
    const gate = graph.nodes.find((node) => node.kind === "gate");
    expect(tool?.status).toBe("waiting");
    expect(gate).toMatchObject({ status: "waiting", detail: "Needs approval", parentId: tool?.id });
    expect(graph.activeNodeId).toBe(gate?.id);
    expect(graph.edges.some((edge) => edge.source === gate?.id && edge.target === tool?.id)).toBe(true);

    graph = reduceFlowEvent(graph, ws("tool_started", { call_id: "exec-1", name: "shell" }));
    expect(graph.nodes.find((node) => node.id === gate?.id)?.status).toBe("succeeded");
    expect(graph.nodes.find((node) => node.id === tool?.id)?.status).toBe("running");
  });

  it("marks active work interrupted or failed, preserving a terminal detail node", () => {
    let interrupted = createFlowState("stop");
    interrupted = reduceFlowEvent(interrupted, ws("turn_start", { input: "go" }));
    interrupted = reduceFlowEvent(interrupted, ws("tool_proposed", { call_id: "x", name: "shell" }));
    interrupted = reduceFlowEvent(interrupted, ws("tool_started", { call_id: "x", name: "shell" }));
    interrupted = reduceFlowEvent(interrupted, ws("interrupted"));
    expect(interrupted.nodes.find((node) => node.callId === "x")?.status).toBe("interrupted");
    expect(interrupted.nodes.find((node) => node.kind === "turn")?.status).toBe("interrupted");

    let failed = createFlowState("error");
    failed = reduceFlowEvent(failed, ws("turn_start", { input: "go" }));
    failed = reduceFlowEvent(failed, ws("error", { error: "network down" }));
    expect(failed.nodes.find((node) => node.kind === "turn")?.status).toBe("failed");
    expect(failed.nodes.find((node) => node.id.endsWith(":terminal"))).toMatchObject({
      status: "failed",
      detail: "network down",
    });
  });

  it("ignores events explicitly tagged for another session", () => {
    const graph = createFlowState("current");
    const result = reduceFlowEvent(graph, ws("turn_start", { session_id: "old", input: "late frame" }));
    expect(result).toBe(graph);
    expect(result.nodes).toEqual([]);
  });
});

describe("agentFlowReducer", () => {
  it("hydrates and resets when the selected session changes", () => {
    let graph = createFlowState("one");
    graph = agentFlowReducer(graph, {
      type: "hydrate",
      sessionId: "one",
      messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }],
    });
    expect(graph.nodes.length).toBeGreaterThan(0);

    graph = agentFlowReducer(graph, { type: "reset", sessionId: "two" });
    expect(graph).toEqual(createFlowState("two"));

    const unchanged = agentFlowReducer(graph, {
      type: "event",
      sessionId: "one",
      event: ws("turn_start", { input: "late" }),
    });
    expect(unchanged).toBe(graph);
  });
});
