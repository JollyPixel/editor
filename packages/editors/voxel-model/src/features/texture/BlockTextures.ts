// Import Third-party Dependencies
import {
  UVRegion,
  type PixelDocument,
  type UVMapListener,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  PixelCanvasTexture,
  UVGeometryBinding
} from "@jolly-pixel/editor.pixel-art/mesh-texturing";
import type { UVGhostPayload } from "@jolly-pixel/asset.pixel-art/client";
import type {
  BlockNodeJSON,
  ModelChange,
  ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { BlockSelectionStore } from "../../state/index.ts";
import type {
  ModelBlock,
  ModelBlocks
} from "../../scene/blocks/index.ts";
import { BoxUvLayout } from "./BoxUvLayout.ts";
import {
  blockRegionId,
  blockUuidFromRegion
} from "./blockRegionId.ts";

// CONSTANTS
const kBlockUvColor = "#4488ff";

export interface BlockTexturesOptions {
  pixels: PixelDocument;
  document: ModelDocument;
  blocks: ModelBlocks;
  selection: BlockSelectionStore;
}

/**
 * Projects the UV layouts stored on model blocks onto the texture UV map,
 * and writes UV edits made on the texture back to the model.
 */
export class BlockTextures {
  #pixels: PixelDocument;
  #document: ModelDocument;
  #blocks: ModelBlocks;
  #selection: BlockSelectionStore;
  #texture: PixelCanvasTexture;
  #bindings = new Map<string, UVGeometryBinding>();
  #restoring = false;
  #releaseBlockRegions: () => void;

  #onChange = (
    change: ModelChange
  ): void => {
    const { command } = change;
    switch (command.action) {
      case "node-added":
        if (command.node.kind === "block") {
          this.#project(command.node);
        }
        break;
      case "node-removed":
        this.#restore(() => {
          for (const node of change.removed) {
            if (node.kind === "block") {
              this.#pixels.uv.delete(blockRegionId(node.id));
            }
          }
        });
        break;
      case "node-renamed":
      case "node-uv-changed": {
        const block = this.#document.tree.block(command.id);
        if (block) {
          this.#project(block);
        }
        break;
      }
      case "node-transformed":
        if (command.flipAxes) {
          this.#bindByUuid(command.id);
        }
        break;
      default:
        break;
    }
  };

  #rebuild = (): void => {
    this.#restore(() => {
      for (const region of [...this.#pixels.uv.regions]) {
        const uuid = blockUuidFromRegion(region.id);
        if (uuid !== null && !this.#document.tree.has(uuid)) {
          this.#pixels.uv.delete(region.id);
        }
      }
      for (const block of this.#document.tree.blocks()) {
        this.#pixels.uv.restore(regionOf(block));
      }
    });
  };

  #onResized = (
    event: { size: Vec2; }
  ): void => {
    for (const binding of this.#bindings.values()) {
      binding.setTextureSize(event.size);
    }
  };

  #onRegionCreated: UVMapListener<"region-created"> = ({ region }) => {
    const uuid = blockUuidFromRegion(region.id);
    if (uuid !== null) {
      this.#bindByUuid(uuid);
    }
  };

  #onRegionDeleted: UVMapListener<"region-deleted"> = ({ region }) => {
    const uuid = blockUuidFromRegion(region.id);
    if (uuid !== null) {
      this.#unbind(uuid);
    }
  };

  #onRegionEdited = (
    event: { region: UVRegion; }
  ): void => {
    const uuid = blockUuidFromRegion(event.region.id);
    if (!this.#restoring && uuid !== null) {
      this.#document.setUv(uuid, event.region.toLayout());
    }
  };

  #onRegionSelected: UVMapListener<"selection-changed"> = ({ selectedRegionId }) => {
    const uuid = selectedRegionId === null
      ? null
      : blockUuidFromRegion(selectedRegionId);
    const next = uuid === null ? null : this.#blocks.get(uuid)?.uuid ?? null;

    if (this.#selection.selected !== next) {
      this.#selection.select(next);
    }
  };

  #onBlockSelected = (
    uuid: string | null
  ): void => {
    const regionId = uuid === null ? null : blockRegionId(uuid);
    if (this.#pixels.uv.selectedRegionId !== regionId) {
      this.#pixels.uv.select(regionId);
    }
  };

  constructor(
    options: BlockTexturesOptions
  ) {
    const pixels = options.pixels;
    this.#pixels = pixels;
    this.#document = options.document;
    this.#blocks = options.blocks;
    this.#selection = options.selection;
    this.#texture = new PixelCanvasTexture({
      document: pixels,
      get textureSize() {
        return pixels.size();
      },
      textureCanvas: () => pixels.buffer.canvas()
    });
    this.#blocks.texture = this.#texture.texture;
    this.#releaseBlockRegions = pixels.disownUvRegions(
      (id) => blockUuidFromRegion(id) !== null
    );

    const { uv } = pixels;
    this.#texture.on("resized", this.#onResized);
    uv.on("region-created", this.#onRegionCreated);
    uv.on("region-deleted", this.#onRegionDeleted);
    uv.on("region-moved", this.#onRegionEdited);
    uv.on("region-rotated", this.#onRegionEdited);
    uv.on("region-state-changed", this.#onRegionEdited);
    uv.on("selection-changed", this.#onRegionSelected);
    this.#document.on("change", this.#onChange);
    this.#document.on("reset", this.#rebuild);
    this.#selection.on("select", this.#onBlockSelected);

    this.#rebuild();
  }

  previewPeerDrag(
    payload: UVGhostPayload
  ): void {
    const uuid = blockUuidFromRegion(payload.id);
    if (uuid !== null) {
      this.#bindings.get(uuid)?.preview(
        payload.face,
        payload.geometry
      );
    }
  }

  dispose(): void {
    for (const uuid of [...this.#bindings.keys()]) {
      this.#unbind(uuid);
    }

    const { uv } = this.#pixels;
    uv.off("region-created", this.#onRegionCreated);
    uv.off("region-deleted", this.#onRegionDeleted);
    uv.off("region-moved", this.#onRegionEdited);
    uv.off("region-rotated", this.#onRegionEdited);
    uv.off("region-state-changed", this.#onRegionEdited);
    uv.off("selection-changed", this.#onRegionSelected);
    this.#document.off("change", this.#onChange);
    this.#document.off("reset", this.#rebuild);
    this.#selection.off("select", this.#onBlockSelected);
    this.#releaseBlockRegions();
    this.#blocks.texture = null;
    this.#texture.off("resized", this.#onResized);
    this.#texture.dispose();
  }

  #restore(
    fn: () => void
  ): void {
    this.#restoring = true;
    try {
      fn();
    }
    finally {
      this.#restoring = false;
    }
  }

  #project(
    block: BlockNodeJSON
  ): void {
    this.#restore(() => this.#pixels.uv.restore(regionOf(block)));
  }

  #bindByUuid(
    uuid: string
  ): void {
    const block = this.#blocks.get(uuid);
    if (block) {
      this.#bind(block);
    }
  }

  #bind(
    block: ModelBlock
  ): void {
    const region = this.#pixels.uv.get(
      blockRegionId(block.uuid)
    );
    if (!region) {
      return;
    }

    this.#unbind(block.uuid);

    const layout = new BoxUvLayout(
      this.#document.tree.block(block.uuid)?.flipAxes
    );
    layout.applyDefaults(block.mesh.geometry);

    const binding = new UVGeometryBinding({
      geometry: block.mesh.geometry,
      region,
      textureSize: this.#pixels.size(),
      faceRanges: layout.faceRanges
    });
    binding.follow(this.#pixels.uv);
    this.#bindings.set(block.uuid, binding);
  }

  #unbind(
    uuid: string
  ): void {
    this.#bindings.get(uuid)?.unfollow();
    this.#bindings.delete(uuid);
  }
}

function regionOf(
  block: BlockNodeJSON
): UVRegion {
  return UVRegion.fromLayout(block.uv, {
    id: blockRegionId(block.id),
    name: block.name,
    color: kBlockUvColor
  });
}
