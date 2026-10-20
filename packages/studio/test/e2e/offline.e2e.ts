// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import { MAP } from "./support/assets.ts";
import { registerAccount } from "./support/account.ts";

test("offers a shared offline catalog when the socket closes", async({ studio, page }) => {
  await page.routeWebSocket("**/ws-sync", (socket) => {
    socket.close();
  });
  await registerAccount(page.request);
  await studio.goto();
  await studio.offlineFallback.click();

  await studio.assets.expectSeeded();
  await studio.assets.open(MAP);

  await expect(studio.frames.all).toHaveCount(1);
  await expect(studio.frames.all).toHaveAttribute(
    "src",
    /offline=studio.*target=map-overworld/
  );
});
