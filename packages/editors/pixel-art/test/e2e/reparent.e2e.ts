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

  await panel.getByRole("button", { name: "Region visibility" }).click();
  const showAll = panel.getByRole("checkbox", { name: "Show all regions" });
  const shown = await showAll.isChecked();
  await showAll.setChecked(!shown);
  await expect(showAll).toBeChecked({ checked: !shown });
  await showAll.press("Escape");

  await panel.getByRole("button", { name: "Clear texture" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Clear texture" })
  ).toBeVisible();
});
