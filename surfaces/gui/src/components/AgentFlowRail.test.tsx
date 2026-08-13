import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FlowGraphState } from "../agentFlow/types";
import { AgentFlowRail } from "./AgentFlowRail";

const fitView = vi.hoisted(() => vi.fn());

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  return {
    MarkerType: { ArrowClosed: "arrowclosed" },
    Position: { Top: "top", Bottom: "bottom" },
    ReactFlow: ({ children, onInit, nodes, ...props }: {
      children?: React.ReactNode;
      onInit?: (instance: { fitView: typeof fitView }) => void;
      nodes?: unknown[];
      [key: string]: unknown;
    }) => {
      React.useEffect(() => {
        onInit?.({ fitView });
      }, [onInit]);
      return React.createElement(
        "div",
        { "data-testid": "react-flow", "data-node-count": nodes?.length ?? 0, "aria-label": props["aria-label"] },
        children,
      );
    },
    Background: () => React.createElement("div", { "data-testid": "flow-background" }),
    Controls: () => React.createElement("div", { "data-testid": "flow-controls" }),
    Handle: () => React.createElement("span", { "data-testid": "flow-handle" }),
  };
});

function graph(overrides: Partial<FlowGraphState> = {}): FlowGraphState {
  return {
    sessionId: "session-1",
    nodes: [],
    edges: [],
    revision: 0,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  fitView.mockReset();
  vi.unstubAllGlobals();
});

describe("AgentFlowRail", () => {
  it("shows a useful empty state and closes from its own header", () => {
    const onClose = vi.fn();
    render(<AgentFlowRail graph={graph()} onClose={onClose} sessionTitle="Research session" />);

    expect(screen.getByRole("heading", { name: "Agent flow" })).toBeTruthy();
    expect(screen.getByText("Research session")).toBeTruthy();
    expect(screen.getByText("No run activity yet")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Current" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Close agent flow" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the active node without making the graph draggable", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));

    render(
      <AgentFlowRail
        graph={graph({
          activeNodeId: "turn-1",
          nodes: [{
            id: "turn-1",
            kind: "turn",
            status: "running",
            label: "Answer the user",
            sessionId: "session-1",
            turnId: "turn-1",
          }],
        })}
        onClose={vi.fn()}
      />,
    );

    const flow = screen.getByTestId("react-flow");
    expect(flow.getAttribute("data-node-count")).toBe("1");
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Current" }) as HTMLButtonElement).disabled).toBe(false);
    });

    fitView.mockClear(); // Ignore the initial fit-to-graph pass.
    fireEvent.click(screen.getByRole("button", { name: "Current" }));
    expect(fitView).toHaveBeenCalledWith({
      nodes: [{ id: "turn-1" }],
      duration: 260,
      padding: 0.75,
      maxZoom: 1.2,
    });
  });

  it("does not mount when inactive", () => {
    render(<AgentFlowRail active={false} graph={graph()} onClose={vi.fn()} />);
    expect(screen.queryByRole("complementary", { name: "Agent run flow" })).toBeNull();
  });
});
