// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR
} from "./support/canvas.ts";
import type { PixelArtPanel } from "./support/panel.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test("strokes and undos reach a peer and survive a reload", async({ panel, peerPanel }) => {
  const pixel = [{ x: 10, y: 10 }];

  await panel.modes.select("paint");
  await panel.canvas.click(pixel[0]);
  await expect.poll(() => peerPanel.canvas.pixels(pixel)).toEqual([BLACK]);
  await expect(peerPanel.undoButton).toBeDisabled();

  await panel.canvas.click({ x: 12, y: 10 });
  await panel.undoButton.click();
  await expect.poll(() => peerPanel.canvas.pixels([
    { x: 10, y: 10 },
    { x: 12, y: 10 }
  ])).toEqual([BLACK, CLEAR]);

  await panel.reload();
  await expect.poll(() => panel.canvas.pixels(pixel)).toEqual([BLACK]);
});

test("UV regions made and rotated from the toolbar converge on a peer", async({
  panel,
  peerPanel
}) => {
  function regions(
    target: PixelArtPanel
  ) {
    return target.root.evaluate((element: PixelDrawPanel) => Array.from(
      element.canvasManager!.uv.regions,
      (region) => region.toJSON()
    ));
  }

  await panel.modes.select("uv");
  await panel.visibility.apply({ all: true });
  await panel.uv.createCube.click();
  await panel.canvas.click({ x: 8, y: 8 });
  await panel.uv.rotateClockwise.click();
  await panel.uv.createRamp.click();

  const local = await regions(panel);
  expect(local).toMatchObject([
    { rect: { rotation: 1 } },
    { faces: { left: { shape: "triangle" } } }
  ]);
  await expect.poll(() => regions(peerPanel)).toEqual(local);
});
