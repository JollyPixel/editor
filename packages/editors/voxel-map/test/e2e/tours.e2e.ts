// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// Import Internal Dependencies
import {
  test,
  expect,
  EDITOR_OPTIONS
} from "./fixtures.ts";

// CONSTANTS
const kTours = ["voxel-map.basics", "voxel-map.textures"];

function nextFrame(
  page: Page
): Promise<void> {
  return page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
}

test.use({
  editor: {
    ...EDITOR_OPTIONS,
    debug: "host.lantern"
  }
});

for (const id of kTours) {
  test(`every step of ${id} finds its target`, async({ page, commands }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes("host.lantern")) {
        warnings.push(message.text());
      }
    });
    const card = page.locator("jolly-lantern .card");
    const counter = card.locator(".counter");

    await commands.open();
    await commands.prompt.fill(`/tour.start ${id}`);
    await commands.prompt.press("Enter");
    await expect(counter).toHaveText(/^1 \/ \d+$/);
    const count = Number((await counter.textContent())?.split("/")[1]);
    for (let index = 1; index <= count; index++) {
      await expect(counter).toHaveText(`${index} / ${count}`);
      await nextFrame(page);
      await expect(card).not.toHaveAttribute("data-seeking");
      await card.locator(".next").click();
    }

    await expect(card).toHaveCount(0);
    expect(warnings).toEqual([]);
  });
}
