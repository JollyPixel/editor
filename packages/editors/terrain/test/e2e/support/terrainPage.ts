// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import { nextFrames } from "@jolly-pixel/e2e/editor";

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  pitch: number;
  yaw?: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export type Rgb = [number, number, number];

// CONSTANTS
const kColorTolerance = 6;

export class TerrainPage {
  readonly page: Page;
  readonly canvas: Locator;

  constructor(
    page: Page
  ) {
    this.page = page;
    this.canvas = page.locator("#game-container > canvas");
  }

  async pinCamera(
    pose: CameraPose
  ): Promise<void> {
    await this.page.evaluate(({ x, y, z, pitch, yaw = 0 }) => {
      const orbit = window.terrainEditor!.scene.camera!;
      const { camera } = orbit;
      const rotation = camera.rotation.clone().set(pitch, yaw, 0, "YXZ");
      orbit.teleport({
        position: { x, y, z },
        quaternion: camera.quaternion.clone().setFromEuler(rotation)
      });
    }, pose);
    await nextFrames(this.page);
  }

  heightAt(
    sampleX: number,
    sampleZ: number
  ): Promise<number> {
    return this.page.evaluate(
      ([x, z]) => window.terrainEditor!.document.terrain.sampleAt(x, z),
      [sampleX, sampleZ]
    );
  }

  async screenPoint(
    sampleX: number,
    sampleZ: number
  ): Promise<ScreenPoint> {
    return this.page.evaluate(([x, z]) => {
      const { scene, document } = window.terrainEditor!;
      const camera = scene.camera!.camera;
      const bounds = scene.world.renderer.canvas.getBoundingClientRect();
      camera.updateMatrixWorld(true);
      const point = camera.position.clone()
        .set(x, document.terrain.sampleAt(x, z), z)
        .project(camera);

      return {
        x: bounds.left + (point.x + 1) / 2 * bounds.width,
        y: bounds.top + (1 - point.y) / 2 * bounds.height
      };
    }, [sampleX, sampleZ]);
  }

  async pressBrush(
    sampleX: number,
    sampleZ: number
  ): Promise<() => Promise<void>> {
    const { x, y } = await this.screenPoint(sampleX, sampleZ);
    await this.canvas.hover({ position: await this.#canvasOffset(x, y) });
    await this.page.mouse.down();
    await nextFrames(this.page, 3);

    return async() => {
      await this.page.mouse.up();
      await nextFrames(this.page, 2);
    };
  }

  async undo(): Promise<void> {
    await this.page.locator("terrain-sculpt-toolbar jolly-tool-button[data-tool=undo]").click();
    await nextFrames(this.page);
  }

  selectedLodLevels(): Promise<number[]> {
    return this.page.evaluate(() => {
      const { view, scene } = window.terrainEditor!;
      const levels = new Set(view!.update(scene.camera!.camera).map((node) => node.level));

      return [...levels].sort();
    });
  }

  async dominantColor(): Promise<Rgb> {
    const { data } = await this.#capture();
    const counts = new Map<number, number>();
    let best: [number, number] = [0, 0];
    for (let index = 0; index < data.length; index += 4) {
      const key = (data[index] << 16) | (data[index + 1] << 8) | data[index + 2];
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      if (count > best[1]) {
        best = [key, count];
      }
    }
    const [key] = best;

    return [(key >> 16) & 255, (key >> 8) & 255, key & 255];
  }

  async pixelsMatching(
    color: Rgb
  ): Promise<number> {
    const { data } = await this.#capture();
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (
        Math.abs(data[index] - color[0]) <= kColorTolerance &&
        Math.abs(data[index + 1] - color[1]) <= kColorTolerance &&
        Math.abs(data[index + 2] - color[2]) <= kColorTolerance
      ) {
        count++;
      }
    }

    return count;
  }

  async #capture(): Promise<{ width: number; height: number; data: number[]; }> {
    await nextFrames(this.page, 2);
    const png = await this.canvas.screenshot({
      style: "#game-container > :not(canvas) { visibility: hidden !important; }"
    });

    return this.page.evaluate(async(base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, image.width, image.height);

      return {
        width: image.width,
        height: image.height,
        data: [...data]
      };
    }, png.toString("base64"));
  }

  async #canvasOffset(
    clientX: number,
    clientY: number
  ): Promise<ScreenPoint> {
    const box = await this.canvas.boundingBox();
    if (box === null) {
      throw new Error("The terrain canvas is not visible.");
    }

    return {
      x: clientX - box.x,
      y: clientY - box.y
    };
  }
}
