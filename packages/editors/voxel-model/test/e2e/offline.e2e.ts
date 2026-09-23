// Import Third-party Dependencies
import {
  expect,
  test
} from "@playwright/test";
import {
  recordSockets,
  treeRow
} from "@jolly-pixel/e2e";
import { openEditor } from "@jolly-pixel/e2e/editor";

test("opens a persistent offline model without a socket", async({ page }) => {
  const sockets = recordSockets(page);
  await openEditor(page, {
    maxFps: 5,
    query: {
      offline: ""
    }
  });
  await expect(treeRow(page, "Block")).toBeVisible();

  expect(await page.evaluate(
    () => window.voxelModelEditor?.session.workspace?.persistent
  )).toBe(true);
  expect(sockets).toEqual([]);
});
