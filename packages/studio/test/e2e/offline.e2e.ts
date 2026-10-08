// Import Third-party Dependencies
import { expect, test } from "@playwright/test";
import { treeRow } from "@jolly-pixel/e2e";

// Import Internal Dependencies
import {
  assetRows,
  editorFrames,
  expandSeedFolders,
  MAP,
  SEED_ROW_COUNT
} from "./support/shell.ts";
import { registerAccount } from "./support/account.ts";

test("offers a shared offline catalog when the socket closes", async({ page }) => {
  await page.routeWebSocket("**/ws-sync", (socket) => {
    socket.close();
  });
  await expandSeedFolders(page);
  await registerAccount(page.request);
  await page.goto("/");
  await page.getByRole("button", {
    name: "Open offline workspace"
  }).click();

  await expect(assetRows(page)).toHaveCount(SEED_ROW_COUNT);
  await treeRow(page, MAP).dblclick();

  await expect(editorFrames(page)).toHaveCount(1);
  await expect(editorFrames(page)).toHaveAttribute(
    "src",
    /offline=.*workspace=studio.*target=map-overworld/
  );
});
