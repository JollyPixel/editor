// Import Third-party Dependencies
import { waitForEditor } from "@jolly-pixel/e2e/editor";
import {
  CATALOG_ROOM,
  CATALOG_VIEW_ROOM
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { MODEL } from "./support/assets.ts";
import { joinedRooms } from "./support/shares.ts";

test("a share link opens an asset for a guest and closes when revoked", async({
  studio,
  account,
  browser
}) => {
  test.slow();
  const { shareLinks } = studio;
  await studio.open();

  await studio.assets.select(MODEL);
  await studio.assets.action("Share").click();
  const url = await studio.assets.shareDialog.createLink();

  await expect(shareLinks.links).toHaveCount(1);
  await expect(shareLinks.links).toContainText(`models/${MODEL}`);
  await expect(shareLinks.links).toContainText(`By ${account}`);

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  const rooms = joinedRooms(guestPage);
  await guestPage.goto(url);
  await waitForEditor(guestPage);
  expect(rooms).toContain(CATALOG_VIEW_ROOM);
  expect(rooms).not.toContain(CATALOG_ROOM);

  await shareLinks.revoke();
  await expect(shareLinks.links).toHaveCount(0);
  await expect(guestPage.getByText("This share link was revoked or has expired."))
    .toBeVisible();
  await guest.close();
});
