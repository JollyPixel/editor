// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import {
  measureBox,
  type Point
} from "@jolly-pixel/e2e";
import {
  nextFrames,
  pressAt
} from "@jolly-pixel/e2e/editor";
import {
  CHUNK_SAMPLES,
  SPLAT_TEXELS,
  type TerrainOverlay
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { BrushTool } from "#src/features/sculpt/model/SculptSettings.ts";
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

  materialAt(
    sampleX: number,
    sampleZ: number,
    options: { confirmed?: boolean; } = {}
  ): Promise<number | null> {
    return this.page.evaluate(([x, z, confirmed, chunkSamples, splatTexels]) => {
      const editor = window.terrainEditor!;
      const terrain = confirmed ? editor.document.terrain : editor.scene.terrain;
      const chunkX = Math.floor(x / chunkSamples);
      const chunkZ = Math.floor(z / chunkSamples);
      const chunk = [...terrain.chunks()].find(({ coord }) => coord.x === chunkX && coord.z === chunkZ);
      const texelsPerSample = splatTexels / chunkSamples;

      return chunk === undefined ? null : chunk.splat.dominantSlot(
        (x - chunkX * chunkSamples) * texelsPerSample,
        (z - chunkZ * chunkSamples) * texelsPerSample
      );
    }, [sampleX, sampleZ, options.confirmed ?? false, CHUNK_SAMPLES, SPLAT_TEXELS] as const);
  }

  holeAt(
    sampleX: number,
    sampleZ: number
  ): Promise<boolean | null> {
    return this.page.evaluate(([x, z, chunkSamples]) => {
      const { terrain } = window.terrainEditor!.document;
      const chunkX = Math.floor(x / chunkSamples);
      const chunkZ = Math.floor(z / chunkSamples);
      const chunk = [...terrain.chunks()].find(({ coord }) => coord.x === chunkX && coord.z === chunkZ);

      return chunk === undefined ? null : chunk.holes.isHole(
        Math.floor(x) - chunkX * chunkSamples,
        Math.floor(z) - chunkZ * chunkSamples
      );
    }, [sampleX, sampleZ, CHUNK_SAMPLES] as const);
  }

  async selectTool(
    tool: BrushTool
  ): Promise<void> {
    await this.page.locator(`terrain-sculpt-toolbar jolly-tool-button[data-tool=${tool}]`).click();
  }

  async selectMaterial(
    materialName: string
  ): Promise<void> {
    await this.page.locator(`terrain-material-palette .swatch[title="${materialName}"]`).click();
  }

  async paintWith(
    materialName: string
  ): Promise<void> {
    await this.selectTool("paint");
    await this.selectMaterial(materialName);
  }

  async dropImage(
    name: string,
    color: string
  ): Promise<void> {
    const dataTransfer = await this.page.evaluateHandle(async([fileName, fill]) => {
      const canvas = new OffscreenCanvas(4, 4);
      const context = canvas.getContext("2d")!;
      context.fillStyle = fill;
      context.fillRect(0, 0, 4, 4);
      const transfer = new DataTransfer();
      transfer.items.add(new File([await canvas.convertToBlob()], fileName, { type: "image/png" }));

      return transfer;
    }, [name, color]);
    await this.page.locator("terrain-material-palette").dispatchEvent("drop", { dataTransfer });
  }

  async showOverlay(
    overlay: TerrainOverlay
  ): Promise<void> {
    await this.page.locator(`terrain-overlay-toolbar jolly-tool-button[data-overlay=${overlay}]`).click();
    await nextFrames(this.page);
  }

  chunkLoaded(
    chunkX: number,
    chunkZ: number
  ): Promise<boolean | null> {
    return this.page.evaluate(([x, z]) => {
      const { terrain } = window.terrainEditor!.document;
      const coord = [...terrain.overview.coords()].find((known) => known.x === x && known.z === z);

      return coord === undefined ? null : terrain.has(coord);
    }, [chunkX, chunkZ]);
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

  async clickAt(
    sampleX: number,
    sampleZ: number
  ): Promise<void> {
    await pressAt(this.page, [await this.#clientPoint(sampleX, sampleZ)], {
      target: this.viewport.canvas,
      frames: 3
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
