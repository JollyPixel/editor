// Import Third-party Dependencies
import {
  expect,
  test,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import { openExample } from "../support/gallery.ts";

// CONSTANTS
const kWidth = "#field-map-width";
const kHeight = "#field-map-height";
const kSummary = "jolly-presence [part=summary]";

async function openAs(
  page: Page,
  room: string,
  as: string
): Promise<void> {
  await openExample(page, "scenarios/locking", {
    room,
    as
  });
  await expect(
    page.locator("jolly-presence [part=peer]").filter({ hasText: "(you)" })
  ).toHaveText(`${as} (you)`);
}

test.describe("Locking", () => {
  test("a field lock follows its holder's focus and ends when they leave", async({ browser }, testInfo) => {
    const room = `locking-${testInfo.testId}`;
    const [first, second] = await Promise.all([
      browser.newContext(),
      browser.newContext()
    ]);

    try {
      const ada = await first.newPage();
      const lin = await second.newPage();
      await openAs(ada, room, "Ada");
      await openAs(lin, room, "Lin");

      await test.step("both peers see each other", async() => {
        await expect(ada.locator(kSummary)).toHaveText("2 people connected");
        await expect(lin.locator("jolly-presence [part=peer]"))
          .toHaveText(["Lin (you)", "Ada"]);
      });

      await test.step("focus locks the field for the other peer only", async() => {
        await ada.locator(`${kWidth} input`).focus();
        await expect(lin.locator(kWidth)).toHaveAttribute("locked", "");
        await expect(lin.locator(`${kWidth} input`)).toHaveAttribute("readonly", "");
        await expect(lin.locator(`${kWidth} input`))
          .toHaveAttribute("aria-disabled", "true");
        await expect(lin.locator(kHeight)).not.toHaveAttribute("locked", "");
        await expect(ada.locator(kWidth)).not.toHaveAttribute("locked", "");
        await expect(ada.locator(`${kWidth} input`)).not.toHaveAttribute("readonly", "");
      });

      await test.step("moving focus moves the lock", async() => {
        await ada.locator(`${kHeight} input`).focus();
        await expect(lin.locator(kWidth)).not.toHaveAttribute("locked", "");
        await expect(lin.locator(kHeight)).toHaveAttribute("locked", "");
      });

      await test.step("closing the holder releases its lock", async() => {
        await first.close();
        await expect(lin.locator(kHeight)).not.toHaveAttribute("locked", "");
        await expect(lin.locator(kSummary)).toHaveText("1 person connected");
      });
    }
    finally {
      await Promise.all([first.close(), second.close()]);
    }
  });

  test("renders against a null source with no room", async({ page }) => {
    await openExample(page, "scenarios/locking");

    await expect(page.locator(kWidth)).toBeVisible();
    await expect(page.locator(kWidth)).not.toHaveAttribute("locked", "");
    await expect(page.locator(kSummary)).toHaveText("0 people connected");
  });
});
