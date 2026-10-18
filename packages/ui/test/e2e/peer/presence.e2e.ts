// Import Internal Dependencies
import {
  expect,
  test
} from "../fixtures.ts";
import { openExample } from "../support/gallery.ts";
import { readStyle } from "../support/styles.ts";

test.describe("Presence", () => {
  test("caps the snapshot, keeps the local peer, and selects only remote peers", async({ page }) => {
    await openExample(page, "peer/presence");

    const presence = page.locator("jolly-presence");
    await expect(presence.locator("[part=summary]")).toHaveText("3 people connected");
    await expect(presence.locator("[part=peer]")).toHaveText(["Ada", "Sam (you)"]);
    await expect(presence.locator("[part=overflow]")).toHaveText("+1 more");
    await expect(presence.locator("[part=avatar]")).toHaveCount(2);
    await expect(presence.locator("[part=avatar]").first().locator("[part=portrait]"))
      .toBeVisible();

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
      await readStyle(peers.first(), "color")
    );
  });
});

test.describe("Presence stack", () => {
  test("overlaps the capped peers, names them on hover, and selects only remote peers", async({ page }) => {
    await openExample(page, "peer/presence-stack");

    const stack = page.locator("jolly-presence-stack");
    const peers = stack.locator("[part=peer]");
    await expect(peers).toHaveCount(4);
    await expect(stack.getByRole("img", { name: "Sam (you)" })).toBeVisible();
    await expect(stack.locator("[part=overflow]")).toHaveText(/\+1/);

    const first = await peers.nth(0).boundingBox();
    const second = await peers.nth(1).boundingBox();
    expect(second!.x).toBeLessThan(first!.x + first!.width);

    const lin = stack.getByRole("button", { name: "Select Lin" });
    const tooltip = peers.nth(2).locator("[part=tooltip]");
    await expect(tooltip).toBeHidden();
    await lin.hover();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(/Lin\s+via link/);

    await expect(stack.getByRole("button")).toHaveCount(3);
    await lin.click();
    await expect(page.locator("output")).toHaveText("Selected: lin");
  });

  test("selects a peer on click without taking focus", async({ page }) => {
    await openExample(page, "peer/presence-stack");

    const lin = page.locator("jolly-presence-stack")
      .getByRole("button", { name: "Select Lin" });
    await lin.click();
    await expect(page.locator("output")).toHaveText("Selected: lin");
    await expect(lin).not.toBeFocused();
  });
});
