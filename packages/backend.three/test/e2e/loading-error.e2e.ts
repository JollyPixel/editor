// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  bootRuntime,
  isRunning
} from "./support/runtime.ts";

test.describe("Runtime loading errors", () => {
  test("a failed startup asset stops load and shows the error", async({ page }) => {
    await expect(bootRuntime(page, {
      load: {
        loadingDelay: 0,
        textures: ["missing.png"]
      }
    })).rejects.toThrow("Failed to load 1 asset(s).");

    const loading = page.locator("jolly-loading");
    await expect(loading.getByRole("alert")).toHaveText(
      "Failed to load 1 asset(s)."
    );
    expect(await isRunning(page)).toBe(false);

    await loading.getByRole("button", { name: "Dismiss" }).click();
    await expect(loading).toHaveCount(0);
  });
});
