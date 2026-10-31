// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import {
  nextFrames,
  pressAt
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  toClientPoint,
  type ScreenPoint,
  type ViewSnapshot
} from "./projection.ts";

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
  readonly #canvas: Locator;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.#canvas = page.locator("#game-container > canvas");
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

  async cellTop(
    cell: Cell
  ): Promise<ScreenPoint> {
    return projectCellTop(await this.#view(), cell);
  }

  async click(
    cell: Cell
  ): Promise<void> {
    await this.drag([cell]);
  }

  async drag(
    cells: Cell[]
  ): Promise<void> {
    const view = await this.#view();
    await pressAt(this.#page, cells.map((cell) => projectCellTop(view, cell)), {
      target: this.#canvas
    });
  }

  #view(): Promise<ViewSnapshot> {
    return this.#page.evaluate((): ViewSnapshot => {
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
  }
}

function projectCellTop(
  view: ViewSnapshot,
  cell: Cell
): ScreenPoint {
  return toClientPoint(view, {
    x: cell.x + 0.5,
    y: cell.y,
    z: cell.z + 0.5
  });
}
