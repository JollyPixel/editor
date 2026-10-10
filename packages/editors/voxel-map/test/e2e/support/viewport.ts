// Import Third-party Dependencies
import type { Page } from "@playwright/test";
import type { Vector3Like } from "three";
import {
  pressAt,
  type MouseButton
} from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  clientPointOf,
  type ScreenPoint,
  type ViewSnapshot
} from "./projection.ts";

export type { ScreenPoint } from "./projection.ts";

// CONSTANTS
const kCameraPose = {
  position: {
    x: 0.5,
    y: 14,
    z: 10.5
  },
  pitch: -Math.atan2(14, 10)
};

export interface Cell {
  x: number;
  y: number;
  z: number;
}

export class Viewport {
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
  }

  async pinCamera(): Promise<void> {
    await this.#page.evaluate((pose) => {
      const orbit = window.voxelMapEditor!.scene.camera!;
      const { camera } = orbit;
      const rotation = camera.rotation.clone().set(pose.pitch, 0, 0, "YXZ");
      orbit.teleport({
        position: pose.position,
        quaternion: camera.quaternion.clone().setFromEuler(rotation)
      });
    }, kCameraPose);
    await nextFrames(this.#page);
  }

  async screenPoint(
    point: Vector3Like
  ): Promise<ScreenPoint> {
    const view = await this.#page.evaluate((): ViewSnapshot => {
      const { scene } = window.voxelMapEditor!;
      const camera = scene.camera!.camera;
      const bounds = scene.world.renderer.canvas.getBoundingClientRect();
      camera.updateMatrixWorld(true);

      return {
        projection: camera.projectionMatrix.toArray(),
        world: camera.matrixWorld.toArray(),
        bounds: {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height
        }
      };
    });

    return clientPointOf(view, point);
  }

  cellTop(
    cell: Cell
  ): Promise<ScreenPoint> {
    return this.screenPoint({
      x: cell.x + 0.5,
      y: cell.y,
      z: cell.z + 0.5
    });
  }

  async hover(
    cell: Cell
  ): Promise<void> {
    const point = await this.cellTop(cell);
    await this.#page.mouse.move(point.x, point.y);
  }

  async hoverPoint(
    point: Vector3Like
  ): Promise<void> {
    const screen = await this.screenPoint(point);
    await this.#page.mouse.move(screen.x, screen.y);
  }

  async press(
    points: Vector3Like[],
    button: MouseButton = "left"
  ): Promise<void> {
    const screenPoints: ScreenPoint[] = [];
    for (const point of points) {
      screenPoints.push(await this.screenPoint(point));
    }
    await this.#pressScreen(screenPoints, button);
  }

  async click(
    cell: Cell,
    button: MouseButton = "left"
  ): Promise<void> {
    await this.#pressScreen([await this.cellTop(cell)], button);
  }

  async drag(
    cells: Cell[],
    button: MouseButton = "left"
  ): Promise<void> {
    const points: ScreenPoint[] = [];
    for (const cell of cells) {
      points.push(await this.cellTop(cell));
    }
    await this.#pressScreen(points, button);
  }

  async pick(
    point: Vector3Like
  ): Promise<void> {
    const screen = await this.screenPoint(point);
    await this.#holding("Control", () => this.#pressScreen([screen]));
  }

  async pivot(
    cell: Cell
  ): Promise<void> {
    await this.#holding("Alt", () => this.click(cell));
  }

  async #pressScreen(
    points: ScreenPoint[],
    button: MouseButton = "left"
  ): Promise<void> {
    await pressAt(this.#page, points, {
      button,
      settle: nextFrames
    });
  }

  async #holding(
    key: string,
    action: () => Promise<void>
  ): Promise<void> {
    const { keyboard } = this.#page;
    await keyboard.down(key);
    try {
      await action();
    }
    finally {
      await keyboard.up(key);
    }
  }
}
