// Import Third-party Dependencies
import {
  expect,
  test
} from "@playwright/test";
import {
  recordSockets,
  treeRow
} from "@jolly-pixel/e2e";
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import { addNode } from "../support/hierarchy.ts";
import { openOfflineEditor } from "../support/offline.ts";

test("an offline model opens without a socket and keeps its edits after a reload", async({ page }) => {
  const sockets = recordSockets(page);
  await openOfflineEditor(page);
  await addNode(page, "Block", "Arm");

  await page.reload();
  await waitForEditor(page);

  await expect(treeRow(page, "Arm")).toBeVisible();
  expect(sockets).toEqual([]);
});
