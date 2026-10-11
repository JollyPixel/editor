// Import Third-party Dependencies
import {
  expect,
  test,
  type Page
} from "@playwright/test";
import { treeRow } from "@jolly-pixel/e2e";
import {
  CATALOG_ROOM,
  CATALOG_VIEW_ROOM
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  assetAction,
  assetRows,
  expandSeedFolders,
  MODEL,
  SEED_ROW_COUNT
} from "./support/shell.ts";
import { registerAccount } from "./support/account.ts";

// CONSTANTS
const kEditorBootTimeout = 30_000;

function joinedRooms(
  page: Page
): string[] {
  const rooms: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      const envelope = typeof payload === "string" ? JSON.parse(payload) : null;
      if (envelope?.kind === "join") {
        rooms.push(envelope.room);
      }
    });
  });

  return rooms;
}

test("a share link opens an asset for a guest and closes when revoked", async({ page, browser }) => {
  test.slow();
  await expandSeedFolders(page);
  const username = await registerAccount(page.request);
  await page.goto("/");
  await expect(assetRows(page)).toHaveCount(SEED_ROW_COUNT);

  await treeRow(page, MODEL).click();
  await assetAction(page, "Share").click();
  const dialog = page.locator("asset-share-dialog");
  await dialog.getByRole("button", { name: "Create link" }).click();
  const copy = dialog.locator("share-link-list jolly-button[data-action=copy]");
  await expect(copy).toHaveAttribute("title", new RegExp("/view/"));
  const url = await copy.getAttribute("title") ?? "";
  await dialog.getByRole("button", { name: "Close" }).click();

  const pane = page.locator("studio-share-links share-link-list");
  await expect(pane.getByRole("listitem")).toHaveCount(1);
  await expect(pane.getByRole("listitem")).toContainText(`models/${MODEL}`);
  await expect(pane.getByRole("listitem")).toContainText(`By ${username}`);

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  const rooms = joinedRooms(guestPage);
  await guestPage.goto(url);
  await expect(guestPage.locator("html"))
    .toHaveAttribute("data-editor-state", "ready", { timeout: kEditorBootTimeout });
  expect(rooms).toContain(CATALOG_VIEW_ROOM);
  expect(rooms).not.toContain(CATALOG_ROOM);

  await pane.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByRole("alertdialog", { name: "Revoke link?" })).toBeVisible();
  await page.locator("body > jolly-dialog jolly-button[data-action=confirm]").click();
  await expect(pane.getByRole("listitem")).toHaveCount(0);
  await expect(guestPage.getByText("This share link was revoked or has expired."))
    .toBeVisible();
  await guest.close();
});
