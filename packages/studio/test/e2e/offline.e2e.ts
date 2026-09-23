// Import Third-party Dependencies
import { expect, test } from "@playwright/test";

test("offers a shared offline catalog when the socket closes", async({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("jolly-pixel:username", "Guest");
  });
  await page.routeWebSocket("**/ws-sync", (socket) => {
    socket.close();
  });
  await page.goto("/");
  await page.getByRole("button", {
    name: "Open offline workspace"
  }).click();
  await expect.poll(() => page.locator("#asset-tree")
    .evaluate((tree) => {
      const catalogTree = tree as HTMLElement & { nodes: unknown[]; };

      return catalogTree.nodes.length;
    })).toBe(3);

  await page.locator("#asset-tree").evaluate((tree) => {
    tree.dispatchEvent(new CustomEvent("jolly-activate", {
      detail: { id: "asset:map-overworld" },
      bubbles: true,
      composed: true
    }));
  });
  await expect(page.locator("#editor-frames iframe")).toHaveCount(1);
  await expect(page.locator("#editor-frames iframe")).toHaveAttribute(
    "src",
    /offline=.*workspace=studio.*target=map-overworld/
  );
});
