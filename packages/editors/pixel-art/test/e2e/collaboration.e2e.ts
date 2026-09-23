// Import Third-party Dependencies
import { waitForEditor } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  test,
  expect,
  demoPanel
} from "./fixtures.ts";
import {
  BLACK,
  CLEAR,
  clickTexturePixel,
  readPixels,
  setMode
} from "./utils.ts";

test("strokes and undos reach a peer and survive a reload", async({ panel, page, peer }) => {
  const peerPanel = demoPanel(peer);
  const pixel = [{ x: 10, y: 10 }];

  await setMode(panel, "paint");
  await clickTexturePixel(panel, pixel[0]);
  await expect.poll(() => readPixels(peerPanel, pixel)).toEqual([BLACK]);
  await expect(peerPanel.getByRole("button", { name: "Undo" })).toBeDisabled();

  await clickTexturePixel(panel, { x: 12, y: 10 });
  await panel.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => readPixels(peerPanel, [
    { x: 10, y: 10 },
    { x: 12, y: 10 }
  ])).toEqual([BLACK, CLEAR]);

  await page.reload();
  await waitForEditor(page);
  await expect.poll(() => readPixels(panel, pixel)).toEqual([BLACK]);
});
