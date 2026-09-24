// Import Third-party Dependencies
import { expect, test } from "@playwright/test";

test("offers a shared offline catalog when the socket closes", async({ page }) => {
  await page.routeWebSocket("**/ws-sync", (socket) => {
    socket.close();
  });
  await page.goto("/?username=Guest");
  await page.getByRole("button", {
    name: "Open offline workspace"
  }).click();

  const rows = page.locator("asset-browser jolly-tree").getByRole("treeitem");
  await expect(rows).toHaveCount(7);
  await page.getByRole("treeitem", {
    name: "overworld.voxelmap.json",
    exact: true
  }).dblclick();

  await expect(page.locator("#editor-frames iframe")).toHaveCount(1);
  await expect(page.locator("#editor-frames iframe")).toHaveAttribute(
    "src",
    /offline=.*workspace=studio.*target=map-overworld/
  );
});
