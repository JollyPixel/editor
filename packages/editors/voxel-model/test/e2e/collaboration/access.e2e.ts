// Import Third-party Dependencies
import { treeRow } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import { test, expect } from "../fixtures.ts";
import {
  addNode,
  hierarchyAction
} from "../support/hierarchy.ts";
import { historyBar } from "../support/history.ts";
import { gizmoAttached } from "../support/scene.ts";

test("a role change applies live: view only for a spectator, editing again once promoted", async({
  page,
  access
}) => {
  const addBlock = hierarchyAction(page, "Add Block");
  const modelBadge = historyBar(page).getByRole("status");
  const textureBadge = page.locator("pixel-draw-panel [part=access-badge]");
  await treeRow(page, "Block").click();
  await expect.poll(() => gizmoAttached(page)).toBe(true);
  await expect(modelBadge).toHaveCount(0);

  await access.become("spectator");

  await expect(modelBadge).toHaveText("View only");
  await expect(textureBadge).toHaveText("View only");
  await expect(addBlock).toBeDisabled();
  await expect.poll(() => gizmoAttached(page)).toBe(false);

  await access.become("member");

  await expect(modelBadge).toHaveCount(0);
  await expect(textureBadge).toHaveCount(0);
  await expect.poll(() => gizmoAttached(page)).toBe(true);
  await addNode(page, "Block", "Arm");
});
