// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test("the rail, toolbars and dialogs keep working after a DOM move", async({ panel, page }) => {
  await panel.root.evaluate((element: PixelDrawPanel) => {
    const parent = element.parentNode!;
    const next = element.nextSibling;
    parent.removeChild(element);
    parent.insertBefore(element, next);

    return element.updateComplete;
  });

  await panel.modes.select("uv");
  await expect.poll(() => panel.modes.active()).toBe("uv");

  const { showAll } = panel.visibility;
  await panel.visibility.open();
  const shown = await showAll.isChecked();
  await showAll.setChecked(!shown);
  await expect(showAll).toBeChecked({ checked: !shown });
  await showAll.press("Escape");

  await panel.clearButton.click();
  await expect(
    page.getByRole("alertdialog", { name: "Clear texture" })
  ).toBeVisible();
});
