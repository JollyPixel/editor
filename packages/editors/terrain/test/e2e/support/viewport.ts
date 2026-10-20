// Import Third-party Dependencies
import type {
  Locator,
  Page
} from "@playwright/test";
import type { Vector3Like } from "three";
import type { Point } from "@jolly-pixel/e2e";
import { nextFrames } from "@jolly-pixel/e2e/editor";

export interface CameraPose {
  position: Vector3Like;
  pitch: number;
  yaw?: number;
}

export class Viewport {
  readonly canvas: Locator;
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
    this.canvas = page.locator("#game-container > canvas");
  }

  async pinCamera(
    pose: CameraPose
  ): Promise<void> {
    await this.#page.evaluate(({ position, pitch, yaw = 0 }) => {
      const orbit = window.terrainEditor!.scene.camera;
      const { camera } = orbit;
      const rotation = camera.rotation.clone().set(pitch, yaw, 0, "YXZ");
      orbit.teleport({
        position,
        quaternion: camera.quaternion.clone().setFromEuler(rotation)
      });
    }, pose);
    await nextFrames(this.#page);
  }

  async screenPoint(
    point: Vector3Like
  ): Promise<Point> {
    const client = await this.#page.evaluate((target) => {
      const { scene } = window.terrainEditor!;
      const { camera } = scene.camera;
      const bounds = scene.world.renderer.canvas.getBoundingClientRect();
      camera.updateMatrixWorld(true);
      const ndc = camera.position.clone().copy(target).project(camera);
      if (ndc.z < -1 || ndc.z > 1) {
        return null;
      }

      return {
        x: bounds.left + (ndc.x + 1) / 2 * bounds.width,
        y: bounds.top + (1 - ndc.y) / 2 * bounds.height
      };
    }, point);
    if (client === null) {
      throw new Error("The point is outside the camera depth range.");
    }

    return client;
  }
}
