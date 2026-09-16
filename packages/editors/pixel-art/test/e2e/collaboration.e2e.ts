// Import Internal Dependencies
import {
  test,
  expect,
  openDemo
} from "./fixtures.ts";
import {
  BLACK,
  CLEAR,
  clickTexturePixel,
  readPixels,
  setMode
} from "./utils.ts";

test("strokes and undos reach a peer and survive a reload", async({ panel, page, browser }) => {
  const peerContext = await browser.newContext();
  const peer = await openDemo(await peerContext.newPage());
  const pixel = [{ x: 10, y: 10 }];

  try {
    await setMode(panel, "paint");
    await clickTexturePixel(panel, pixel[0]);
    await expect.poll(() => readPixels(peer, pixel)).toEqual([BLACK]);
    await expect(peer.getByRole("button", { name: "Undo" })).toBeDisabled();

    await clickTexturePixel(panel, { x: 12, y: 10 });
    await panel.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => readPixels(peer, [
      { x: 10, y: 10 },
      { x: 12, y: 10 }
    ])).toEqual([BLACK, CLEAR]);

    await page.reload();
    await page.waitForFunction(() => window.__pixelSyncReady === true);
    await expect.poll(() => readPixels(panel, pixel)).toEqual([BLACK]);
  }
  finally {
    await peerContext.close();
  }
});
