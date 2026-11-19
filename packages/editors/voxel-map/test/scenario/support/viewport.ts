// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import type { Vector3Like } from "three";
import type { MouseButton } from "@jolly-pixel/e2e";
import {
  hoverAt,
  nextFrames,
  pressAt,
  type PressModifier
} from "@jolly-pixel/e2e/editor";

// Import Internal Dependencies
import {
  toClientPoint,
  type ScreenPoint,
  type ViewSnapshot
} from "./projection.ts";

// CONSTANTS
export const AUTO_ROTATION = 2;

export interface CameraPose {
  position: Vector3Like;
  pitch: number;
}

export interface Cell {
  x: number;
  y: number;
  z: number;
}

export interface ViewportPress {
  button?: MouseButton;
  modifiers?: readonly PressModifier[];
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

  async pinCamera(
    pose: CameraPose
  ): Promise<void> {
    await this.#page.evaluate((pose) => {
      const orbit = window.voxelMapEditor!.scene.camera!;
      const { camera } = orbit;
      const rotation = camera.rotation.clone().set(pose.pitch, 0, 0, "YXZ");
      orbit.teleport({
        position: pose.position,
        quaternion: camera.quaternion.clone().setFromEuler(rotation)
      });
    }, pose);
    await nextFrames(this.#page);
  }

  async cellTop(
    cell: Cell
  ): Promise<ScreenPoint> {
    return toClientPoint(await this.#view(), floorCenter(cell));
  }

  async hover(
    cell: Cell
  ): Promise<void> {
    await hoverAt(this.#page, await this.cellTop(cell), this.#canvas);
    await nextFrames(this.#page);
  }

  async click(
    cell: Cell,
    options: ViewportPress = {}
  ): Promise<void> {
    await this.drag([cell], options);
  }

  async drag(
    cells: Cell[],
    options: ViewportPress = {}
  ): Promise<void> {
    await this.press(cells.map(floorCenter), options);
  }

  async press(
    points: Vector3Like[],
    options: ViewportPress = {}
  ): Promise<void> {
    const view = await this.#view();
    await pressAt(
      this.#page,
      points.map((point) => toClientPoint(view, point)),
      {
        ...options,
        target: this.#canvas
      }
    );
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

export function cameraAbove(
  target: Vector3Like,
  height: number,
  distance: number
): CameraPose {
  return {
    position: {
      x: target.x,
      y: target.y + height,
      z: target.z + distance
    },
    pitch: -Math.atan2(height, distance)
  };
}

export function frontFace(
  cell: Cell
): Vector3Like {
  return {
    x: cell.x + 0.5,
    y: cell.y + 0.5,
    z: cell.z + 1
  };
}

function floorCenter(
  cell: Cell
): Vector3Like {
  return {
    x: cell.x + 0.5,
    y: cell.y,
    z: cell.z + 0.5
  };
}
