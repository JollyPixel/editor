// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  activeMode,
  setMode
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test("the rail, toolbars and dialogs keep working after a DOM move", async({ panel, page }) => {
  await panel.evaluate((element: PixelDrawPanel) => {
    const parent = element.parentNode!;
    const next = element.nextSibling;
    parent.removeChild(element);
    parent.insertBefore(element, next);

    return element.updateComplete;
  });

  await setMode(panel, "uv");
  await expect.poll(() => activeMode(panel)).toBe("uv");

  const showAll = panel.getByRole("button", { name: "Show all" });
  const shown = await showAll.getAttribute("aria-pressed");
  await showAll.click();
  await expect(showAll).not.toHaveAttribute("aria-pressed", shown!);

  await panel.getByRole("button", { name: "Clear texture" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
