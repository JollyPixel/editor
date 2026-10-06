// Import Third-party Dependencies
import type { VoxelTemplate } from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

export type PlacementClipboardEvents = {
  change: (
    content: VoxelTemplate | null
  ) => void;
};

export class PlacementClipboard {
  readonly #events = new Emitter<PlacementClipboardEvents>();

  #content: VoxelTemplate | null = null;

  get content(): VoxelTemplate | null {
    return this.#content;
  }

  set content(
    value: VoxelTemplate | null
  ) {
    if (value !== this.#content) {
      this.#content = value;
      this.#events.emit("change", value);
    }
  }

  subscribe(
    event: "change",
    listener: PlacementClipboardEvents["change"]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }
}
