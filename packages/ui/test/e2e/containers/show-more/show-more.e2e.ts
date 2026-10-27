// Import Internal Dependencies
import {
  test,
  expect
} from "../../fixtures.ts";
import { reloadGallery } from "../../support/gallery.ts";

test.describe("Show more", () => {
  test.use({
    example: "containers/show-more"
  });

  test("hides the rows past the limit behind a toggle that remembers its state", async({ page }) => {
    const mesh = page.locator("[data-folder='Mesh renderer']");
    const toggle = mesh.locator("jolly-show-more").getByRole("button", { name: "Show 7 more" });

    await expect(mesh.locator("[data-field=Color]")).toBeVisible();
    await expect(mesh.locator("[data-field=Roughness]")).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();
    await expect(mesh.locator("[data-field='Receive shadow']")).toBeVisible();
    await expect(mesh.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");

    await reloadGallery(page);
    await expect(mesh.locator("[data-field='Receive shadow']")).toBeVisible();

    await mesh.getByRole("button", { name: "Show less" }).click();
    await expect(mesh.locator("[data-field=Roughness]")).toBeHidden();
  });

  test("collapsing moves focus from a hidden row to the toggle", async({ page }) => {
    const mesh = page.locator("[data-folder='Mesh renderer']");
    const showMore = mesh.locator("jolly-show-more");

    await mesh.getByRole("button", { name: "Show 7 more" }).click();
    await mesh.locator("[data-field='Receive shadow'] input").focus();
    await showMore.evaluate((element: HTMLElementTagNameMap["jolly-show-more"]) => {
      element.expanded = false;
    });

    await expect(mesh.locator("[data-field='Receive shadow']")).toBeHidden();
    await expect(showMore.getByRole("button", { name: "Show 7 more" })).toBeFocused();
  });

  test("never hides a single row and recounts when rows are added", async({ page }) => {
    const light = page.locator("[data-folder=Light]");
    const mesh = page.locator("[data-folder='Mesh renderer']");

    await expect(light.locator("[data-field='Cast shadow']")).toBeVisible();
    await expect(light.locator("jolly-show-more").getByRole("button")).toHaveCount(0);

    await mesh.getByRole("button", { name: "Add row" }).click();
    await expect(mesh.getByRole("button", { name: "Show 8 more" })).toBeVisible();
  });

  test("a search reveals hidden matches and restores the limit once cleared", async({ page }) => {
    const pane = page.locator("jolly-pane");
    const mesh = page.locator("[data-folder='Mesh renderer']");

    await pane.getByRole("button", { name: "Search Inspector" }).click();
    const input = pane.getByRole("searchbox");

    await input.fill("shadow");
    await expect(mesh.locator("[data-field='Receive shadow']")).toBeVisible();
    await expect(mesh.locator("[data-field=Width]")).toBeHidden();
    await expect(mesh.locator("jolly-show-more").getByRole("button")).toHaveCount(0);

    await input.fill("");
    await expect(mesh.locator("[data-field=Width]")).toBeVisible();
    await expect(mesh.locator("[data-field='Receive shadow']")).toBeHidden();
    await expect(mesh.getByRole("button", { name: "Show 7 more" })).toBeVisible();
  });
});
