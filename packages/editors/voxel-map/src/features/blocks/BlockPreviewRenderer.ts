// Import Third-party Dependencies
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockTurntable } from "./BlockTurntable.ts";

export class BlockPreviewRenderer extends BlockTurntable {
  #size = 0;
  #sizeDirty = true;

  set block(
    block: ResolvedBlockDefinition | null
  ) {
    this.meshes.sync(block === null ? [] : [block]);
  }

  protected override resized(): void {
    this.#sizeDirty = true;
  }

  protected override draw(): void {
    if (this.#sizeDirty) {
      this.#syncSize();
    }

    const [entry] = this.meshes.entries;
    if (this.#size !== 0 && entry !== undefined) {
      this.renderMesh(entry.mesh);
    }
  }

  #syncSize(): void {
    this.#sizeDirty = false;

    const size = Math.floor(
      Math.min(this.container.clientWidth, this.container.clientHeight)
    );
    if (size === this.#size) {
      return;
    }

    this.#size = size;
    this.renderer.setSize(size, size, false);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
  }
}
