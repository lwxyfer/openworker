import { expect } from "@playwright/test";
import { test } from "./fixtures";

test("Agent Flow has an independent button and shares the right-panel slot", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();

  await expect(page.locator(".right-rail")).toBeVisible();
  const showFlow = page.getByRole("button", { name: "Show agent flow" });
  await expect(showFlow).toBeVisible();

  await showFlow.click();
  await expect(page.locator(".agent-flow-rail")).toBeVisible();
  await expect(page.locator(".right-rail")).toHaveCount(0);
  await expect(page.locator(".main")).toHaveClass(/flow-rail-open/);
  await expect(page.getByText("No run activity yet")).toBeVisible();

  await page.getByRole("button", { name: "Show side panel" }).click();
  await expect(page.locator(".right-rail")).toBeVisible();
  await expect(page.locator(".agent-flow-rail")).toHaveCount(0);
});

test("Agent Flow updates an approval and tool run live", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Draft the launch note").first().click();
  await page.getByRole("button", { name: "Show agent flow" }).click();

  const box = page.getByPlaceholder(/Ask the coworker/);
  await box.fill("please run a tool");
  await page.getByRole("button", { name: "Send" }).click();

  const flow = page.locator(".agent-flow-rail");
  await expect(flow.getByText("Permission approval")).toBeVisible();
  await expect(flow.getByText("Waiting", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Allow once" }).click();
  await expect(flow.getByText("Final answer")).toBeVisible();
  await expect(flow.getByText("Complete", { exact: true }).first()).toBeVisible();
});
