// Import Third-party Dependencies
import {
  expect,
  test
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";
import { styleOf } from "../support/styles.ts";

test.describe("Presence", () => {
  test("caps the snapshot, keeps the local peer, and selects only remote peers", async({ page }) => {
    await openExample(page, "peer/presence");

    const presence = page.locator("jolly-presence");
    await expect(presence.locator("[part=summary]")).toHaveText("3 people connected");
    await expect(presence.locator("[part=peer]")).toHaveText(["Ada", "Sam (you)"]);
    await expect(presence.locator("[part=overflow]")).toHaveText("+1 more");
    await expect(presence.locator("[part=swatch]").first())
      .toHaveAttribute("aria-label", "Ada's color");

    const buttons = presence.locator("[part=peer-button]");
    await expect(buttons).toHaveText(["Ada"]);
    await buttons.click();
    await expect(page.locator("jolly-monitor")).toContainText("ada");
  });

  test("keeps the local peer text readable in the dark theme", async({ page }) => {
    await openExample(page, "peer/presence", { theme: "dark" });

    const peers = page.locator("jolly-presence [part=peer]");
    await expect(peers.nth(1).locator(".self")).toHaveCSS(
      "color",
      await styleOf(peers.first(), "color")
    );
  });
});
