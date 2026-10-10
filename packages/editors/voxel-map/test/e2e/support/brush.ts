// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export interface BrushPatch {
  blockId?: number;
  size?: number;
}

export class Brush {
  readonly #page: Page;

  constructor(
    page: Page
  ) {
    this.#page = page;
  }

  state() {
    return this.#page.evaluate(() => {
      const { brush, state } = window.voxelMapEditor!.workspace;

      return {
        blockId: state.block.id,
        size: brush.size,
        mode: brush.mode,
        axis: brush.axis,
        pattern: brush.pattern
      };
    });
  }

  ghost() {
    return this.#page.evaluate(() => {
      const { localBrush } = window.voxelMapEditor!.workspace;
      const ghost = localBrush.actor.object3D.getObjectByName("ghost-block");

      return {
        visible: ghost?.visible ?? false,
        position: ghost?.position.toArray() ?? null
      };
    });
  }

  async change(
    patch: BrushPatch
  ): Promise<void> {
    await this.#page.evaluate((values) => {
      const { brush, state } = window.voxelMapEditor!.workspace;
      if (values.blockId !== undefined) {
        state.block.id = values.blockId;
      }
      if (values.size !== undefined) {
        brush.size = values.size;
      }
    }, patch);
  }
}
