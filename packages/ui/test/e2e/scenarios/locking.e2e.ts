// Import Third-party Dependencies
import {
  expect,
  test,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../support/gallery.ts";

const kWidth = "#field-map-width";
const kHeight = "#field-map-height";

async function openAs(
  page: Page,
  room: string,
  as: string
): Promise<void> {
  await gotoGallery(page, {
    example: "scenarios/locking",
    chrome: "off",
    room,
    as
  });
  /**
   * Only the local peer is guaranteed before later membership events arrive.
   */
  await expect(page.locator("jolly-presence [part=peer]").filter({ hasText: "(you)" }))
    .toHaveText(`${as} (you)`);
}

test.describe("Locking", () => {
  test("two browsers in one room see each other's avatars and field locks", async({ browser }, testInfo) => {
    const room = `locking-${testInfo.testId}`;
    const first = await browser.newContext();
    const second = await browser.newContext();
    const ada = await first.newPage();
    const lin = await second.newPage();

    await openAs(ada, room, "Ada");
    await openAs(lin, room, "Lin");

    await expect(ada.locator("jolly-presence [part=summary]"))
      .toHaveText("2 people connected");
    await expect(lin.locator("jolly-presence [part=peer]"))
      .toHaveText(["Lin (you)", "Ada"]);

    await ada.locator(`${kWidth} input`).focus();
    await expect(lin.locator(kWidth)).toHaveAttribute("locked", "");
    await expect(lin.locator(`${kWidth} input`)).toHaveAttribute("readonly", "");
    await expect(lin.locator(`${kWidth} input`)).toHaveAttribute("aria-disabled", "true");

    await expect(ada.locator(kWidth)).not.toHaveAttribute("locked", "");
    await expect(ada.locator(`${kWidth} input`)).not.toHaveAttribute("readonly", "");

    await expect(lin.locator(kHeight)).not.toHaveAttribute("locked", "");

    await first.close();
    await second.close();
  });

  test("blurring the field releases it for the other browser", async({ browser }, testInfo) => {
    const room = `locking-blur-${testInfo.testId}`;
    const first = await browser.newContext();
    const second = await browser.newContext();
    const ada = await first.newPage();
    const lin = await second.newPage();

    await openAs(ada, room, "Ada");
    await openAs(lin, room, "Lin");

    await ada.locator(`${kWidth} input`).focus();
    await expect(lin.locator(kWidth)).toHaveAttribute("locked", "");

    await ada.locator(`${kHeight} input`).focus();
    await expect(lin.locator(kWidth)).not.toHaveAttribute("locked", "");
    await expect(lin.locator(kHeight)).toHaveAttribute("locked", "");

    await first.close();
    await second.close();
  });

  test("closing the holder releases its lock", async({ browser }, testInfo) => {
    const room = `locking-close-${testInfo.testId}`;
    const first = await browser.newContext();
    const second = await browser.newContext();
    const ada = await first.newPage();
    const lin = await second.newPage();

    await openAs(ada, room, "Ada");
    await openAs(lin, room, "Lin");

    await ada.locator(`${kWidth} input`).focus();
    await expect(lin.locator(kWidth)).toHaveAttribute("locked", "");

    await first.close();

    await expect(lin.locator(kWidth)).not.toHaveAttribute("locked", "");
    await expect(lin.locator("jolly-presence [part=summary]"))
      .toHaveText("1 person connected");

    await second.close();
  });

  test("renders against a null source with no room", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/locking",
      chrome: "off"
    });

    await expect(page.locator(kWidth)).toBeVisible();
    await expect(page.locator(kWidth)).not.toHaveAttribute("locked", "");
    await expect(page.locator("jolly-presence [part=summary]"))
      .toHaveText("0 people connected");
  });
});
