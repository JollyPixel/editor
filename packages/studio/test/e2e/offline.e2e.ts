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

test("opens Settings from the studio tools without an account", async({ studio }) => {
  await studio.openOffline();

  await expect(studio.home.users).toHaveCount(0);
  await expect(studio.home.tool("Export project")).toBeDisabled();
  await studio.home.tool("Settings").click();

  await expect(studio.settings.section("Appearance")).toBeVisible();
  await expect(studio.settings.section("Profile")).toHaveCount(0);
});
