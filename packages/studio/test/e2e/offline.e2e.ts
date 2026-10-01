// Import Third-party Dependencies
import { expect, test } from "@playwright/test";
import { treeRow } from "@jolly-pixel/e2e";

test("offers a shared offline catalog when the socket closes", async({ page }) => {
  await page.routeWebSocket("**/ws-sync", (socket) => {
    socket.close();
  });
  await page.goto("/?username=Guest");
  await page.getByRole("button", {
    name: "Open offline workspace"
  }).click();

  const rows = page.locator("asset-browser jolly-tree").getByRole("treeitem");
  await expect(rows).toHaveCount(4);
  await treeRow(page, "overworld.voxelmap.json").dblclick();

  await expect(page.locator("#editor-frames iframe")).toHaveCount(1);
  await expect(page.locator("#editor-frames iframe")).toHaveAttribute(
    "src",
    /offline=.*workspace=studio.*target=map-overworld/
  );
});
