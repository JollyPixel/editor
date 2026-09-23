// Import Third-party Dependencies
import { expect, test } from "@playwright/test";

// Import Internal Dependencies
import { treeRow } from "./support/panels.ts";

test("opens a persistent offline model without a socket", async({ page }) => {
  const sockets: string[] = [];
  page.on("websocket", (socket) => {
    if (!socket.url().includes("token=")) {
      sockets.push(socket.url());
    }
  });
  await page.goto("/?offline&max-fps=5");
  await expect(treeRow(page, "Block")).toBeVisible();

  expect(await page.evaluate(
    () => window.voxelModelEditor?.session.workspace?.persistent
  )).toBe(true);
  expect(sockets).toEqual([]);
});
