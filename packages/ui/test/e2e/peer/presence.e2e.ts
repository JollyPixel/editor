// Import Third-party Dependencies
import {
  expect,
  test
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

test.describe("Presence", () => {
  test("renders a capped snapshot while keeping the local peer visible", async({ page }) => {
    await gotoGallery(page, {
      example: "peer/presence",
      chrome: "off"
    });

    const presence = page.locator("jolly-presence");

    await expect(presence.locator("[part=summary]"))
      .toHaveText("3 people connected");
    await expect(presence.locator("[part=peer]"))
      .toHaveText(["Ada", "Sam (you)"]);
    await expect(presence.locator("[part=overflow]"))
      .toHaveText("+1 more");
    await expect(presence.locator("[part=swatch]").first())
      .toHaveAttribute("aria-label", "Ada's color");
  });

  test("raises a selection for a remote peer, never for the local one", async({ page }) => {
    await gotoGallery(page, {
      example: "peer/presence",
      chrome: "off"
    });

    const presence = page.locator("jolly-presence");

    await expect(presence.locator("[part=peer-button]"))
      .toHaveText(["Ada"]);

    await presence.locator("[part=peer-button]").click();
    await expect(page.locator("jolly-monitor"))
      .toContainText("ada");
  });

  test("keeps the local peer text readable in the dark theme", async({ page }) => {
    await gotoGallery(page, {
      example: "peer/presence",
      chrome: "off",
      theme: "dark"
    });

    const peers = page.locator("jolly-presence [part=peer]");
    const localColor = await peers.nth(1).locator(".self")
      .evaluate((element) => getComputedStyle(element).color);
    const remoteColor = await peers.first()
      .evaluate((element) => getComputedStyle(element).color);

    expect(localColor).toBe(remoteColor);
  });
});
