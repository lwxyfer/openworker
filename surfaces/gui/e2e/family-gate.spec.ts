import { test, expect } from "./fixtures";

// Every file-capable persona starts inside an explicit project directory. Chat-like personas with
// `needs_workspace: false` remain folder-free.

const personaMenu = (page: import("@playwright/test").Page) => page.locator(".newsplit-menu");

async function startAs(page: import("@playwright/test").Page, persona: RegExp) {
  await page.getByLabel("Choose a persona").click();
  await personaMenu(page).getByRole("button", { name: persona }).click();
}

test("default file-capable agent exposes a project-folder entry", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open project folder" })).toBeVisible();

  await page.getByRole("button", { name: "Open project folder" }).click();
  const picker = page.locator(".gate-overlay");
  await expect(picker.getByText("New project")).toBeVisible();
  await picker.getByRole("button", { name: "Close project picker" }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByText("Draft the launch note").first()).toBeVisible();
});

test("Projects is a top-level section above Recent and a chosen folder opens blank", async ({ page }) => {
  await page.goto("/");
  const projects = page.getByTestId("projects-section");
  const recent = page.getByTestId("recent-header");
  await expect(projects).toBeVisible();
  expect(await projects.evaluate((node, recentNode) =>
    !!(node.compareDocumentPosition(recentNode as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    await recent.elementHandle(),
  )).toBe(true);

  await projects.getByRole("button", { name: "Open project folder" }).click();
  const picker = page.locator(".gate-overlay");
  await picker.getByPlaceholder("/path/to/your/project").fill("/tmp/new-openworker-project");
  await picker.getByRole("button", { name: "Create", exact: true }).click();

  await expect(picker).toHaveCount(0);
  await expect(projects.getByText("new-openworker-project", { exact: true })).toBeVisible();
  await expect(page.getByText("New session", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: /What should we produce/ })).toBeVisible();
});

test("a fresh default-agent session stays inside the active project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await expect(page.locator(".gate-overlay")).toHaveCount(0);
  await expect(page.getByText("launch-note", { exact: true }).first()).toBeVisible();
});

test("knowledge persona: a file-capable new session requires a project folder", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder(/Ask the coworker/)).toBeVisible();

  await startAs(page, /Ops/);
  const gate = page.locator(".gate-overlay");
  await expect(gate).toBeVisible();
  await expect(gate.getByText("Choose a project folder")).toBeVisible();

  await gate.getByPlaceholder("/path/to/your/project").fill("/tmp/e2e-ops-project");
  await gate.getByRole("button", { name: "Open", exact: true }).click();
  await expect(gate).toHaveCount(0);
});

test("code persona: the folder gate blocks until a project is chosen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder(/Ask the coworker/)).toBeVisible();

  await startAs(page, /Code/);

  const gate = page.locator(".gate-overlay");
  await expect(gate).toBeVisible();
  await expect(gate.getByText("Choose a project folder")).toBeVisible();
  // No escape hatch: the gate offers pick-a-folder only (no "switch to Chat" — owner call, §16).
  await expect(gate.getByText(/chat/i)).toHaveCount(0);

  await gate.getByPlaceholder("/path/to/your/project").fill("/tmp/e2e-project");
  await gate.getByRole("button", { name: "Open", exact: true }).click();

  // Gate clears, the session is rooted in the chosen folder, and the code composer is live.
  await expect(page.locator(".gate-overlay")).toHaveCount(0);
  await expect(page.getByPlaceholder(/Ask the coder/)).toBeVisible();
});
