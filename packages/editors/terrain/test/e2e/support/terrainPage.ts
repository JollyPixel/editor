// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import {
  measureBox,
  pressAt,
  type Point
} from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  captureCanvas,
  type CanvasPixels
} from "./canvasPixels.ts";
import { Viewport } from "./viewport.ts";

export class TerrainPage {
  readonly page: Page;
  readonly viewport: Viewport;

  constructor(
    page: Page
  ) {
    this.page = page;
    this.viewport = new Viewport(page);
  }

  heightAt(
    sampleX: number,
    sampleZ: number
  ): Promise<number> {
    return this.page.evaluate(
      ([x, z]) => window.terrainEditor!.scene.terrain.sampleAt(x, z),
      [sampleX, sampleZ]
    );
  }

  confirmedHeightAt(
    sampleX: number,
    sampleZ: number
  ): Promise<number> {
    return this.page.evaluate(
      ([x, z]) => window.terrainEditor!.document.terrain.sampleAt(x, z),
      [sampleX, sampleZ]
    );
  }

  async pressBrush(
    sampleX: number,
    sampleZ: number
  ): Promise<() => Promise<void>> {
    const point = await this.#clientPoint(sampleX, sampleZ);
    const { canvas } = this.viewport;
    const box = await measureBox(canvas);
    await canvas.hover({
      position: {
        x: point.x - box.x,
        y: point.y - box.y
      }
    });
    await this.page.mouse.down();
    await nextFrames(this.page, 3);

    return async() => {
      await this.page.mouse.up();
      await nextFrames(this.page, 2);
    };
  }

  async sculptAt(
    sampleX: number,
    sampleZ: number
  ): Promise<void> {
    await pressAt(this.page, [await this.#clientPoint(sampleX, sampleZ)], {
      target: this.viewport.canvas,
      settle: (page) => nextFrames(page, 3)
    });
  }

  async undo(): Promise<void> {
    await this.page.locator("terrain-sculpt-toolbar jolly-tool-button[data-tool=undo]").click();
    await nextFrames(this.page);
  }

  selectedLodLevels(): Promise<number[]> {
    return this.page.evaluate(() => {
      const { view, scene } = window.terrainEditor!;
      const levels = new Set(view.update(scene.camera.camera).map((node) => node.level));

      return [...levels].sort();
    });
  }

  async capture(): Promise<CanvasPixels> {
    await nextFrames(this.page, 2);

    return captureCanvas(this.viewport.canvas);
  }

  async #clientPoint(
    sampleX: number,
    sampleZ: number
  ): Promise<Point> {
    const y = await this.heightAt(sampleX, sampleZ);

    return this.viewport.screenPoint({
      x: sampleX,
      y,
      z: sampleZ
    });
  }
}
