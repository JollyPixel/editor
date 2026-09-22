// Import Third-party Dependencies
import type {
  PixelDocument,
  UVMapListener,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  PixelCanvasTexture,
  UVGeometryBinding
} from "@jolly-pixel/editor.pixel-art/mesh-texturing/index.ts";
import type { UVGhostPayload } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type {
  ModelChange,
  ModelDocument
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import type { BlockRegions } from "../../model/index.ts";
import type {
  ModelBlock,
  ModelBlocks
} from "../blocks/index.ts";
import { BoxUvLayout } from "./BoxUvLayout.ts";
import {
  blockRegionId,
  blockUuidFromRegion
} from "./blockRegionId.ts";

// CONSTANTS
const kBlockUvSize = { width: 16, height: 16 };
const kBlockUvColor = "#4488ff";

export interface BlockTexturesOptions {
  pixels: PixelDocument;
  document: ModelDocument;
  blocks: ModelBlocks;
  pixelsReady: Promise<void>;
}

export class BlockTextures implements BlockRegions {
  #pixels: PixelDocument;
  #document: ModelDocument;
  #blocks: ModelBlocks;
  #texture: PixelCanvasTexture;
  #bindings = new Map<string, UVGeometryBinding>();
  #pixelsLoaded = false;
  #disposed = false;

  #onChange = (
    change: ModelChange
  ): void => {
    const { command } = change;
    switch (command.action) {
      case "node-added":
        this.#bindByUuid(command.node.id);
        break;
      case "node-removed":
        for (const node of change.removed) {
          if (node.kind === "block") {
            this.#unbind(node.id);
            this.#pixels.uv.delete(
              blockRegionId(node.id)
            );
          }
        }
        break;
      case "node-renamed":
        if (
          change.origin === "local" &&
          this.#blocks.get(command.id) !== undefined
        ) {
          this.#pixels.uv.rename(
            blockRegionId(command.id),
            command.name
          );
        }
        break;
      case "node-transformed":
        if (command.flipAxes) {
          this.#bindByUuid(command.id);
        }
        break;
      default:
        break;
    }
  };

  #rebindAll = (): void => {
    for (const uuid of [...this.#bindings.keys()]) {
      this.#unbind(uuid);
    }
    for (const block of this.#blocks.values()) {
      this.#bind(block);
    }
    if (this.#pixelsLoaded) {
      this.#createMissingRegions();
    }
  };

  #createMissingRegions = (): void => {
    if (this.#disposed) {
      return;
    }
    for (const block of this.#blocks.values()) {
      if (this.#pixels.uv.get(blockRegionId(block.uuid)) === undefined) {
        this.create(block.uuid, block.name);
      }
    }
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

  #onRegionSelected: UVMapListener<"selection-changed"> = ({ selectedRegionId }) => {
    const blocks = this.#blocks;
    const uuid = selectedRegionId === null
      ? null
      : blockUuidFromRegion(selectedRegionId);
    const block = uuid === null ? null : blocks.get(uuid) ?? null;

    if (blocks.selected !== block) {
      blocks.select(block);
    }
  };

  #onBlockSelected = (
    block: ModelBlock | null
  ): void => {
    const regionId = block ? blockRegionId(block.uuid) : null;
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
    this.#texture = new PixelCanvasTexture({
      document: pixels,
      get textureSize() {
        return pixels.size();
      },
      textureCanvas: () => pixels.buffer.canvas()
    });
    this.#blocks.texture = this.#texture.texture;

    this.#texture.on("resized", this.#onResized);
    pixels.on("reset", this.#rebindAll);
    pixels.uv.on("region-created", this.#onRegionCreated);
    pixels.uv.on("region-deleted", this.#onRegionDeleted);
    pixels.uv.on("selection-changed", this.#onRegionSelected);
    this.#document.on("change", this.#onChange);
    this.#document.on("reset", this.#rebindAll);
    this.#blocks.on("select", this.#onBlockSelected);

    this.#rebindAll();
    void options.pixelsReady.then(() => {
      this.#pixelsLoaded = true;
      this.#createMissingRegions();
    });
  }

  create(
    uuid: string,
    name: string
  ): void {
    this.#pixels.uv.create({
      id: blockRegionId(uuid),
      name,
      color: kBlockUvColor,
      ...kBlockUvSize,
      state: "unfolded"
    });
  }

  copy(
    sourceUuid: string,
    uuid: string,
    name: string
  ): void {
    const source = this.#pixels.uv.get(
      blockRegionId(sourceUuid)
    );
    if (!source) {
      this.create(uuid, name);

      return;
    }

    this.#pixels.uv.restore({
      ...source.toJSON(),
      id: blockRegionId(uuid),
      name
    });
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
    this.#disposed = true;
    for (const uuid of [...this.#bindings.keys()]) {
      this.#unbind(uuid);
    }

    const { uv } = this.#pixels;
    this.#pixels.off("reset", this.#rebindAll);
    uv.off("region-created", this.#onRegionCreated);
    uv.off("region-deleted", this.#onRegionDeleted);
    uv.off("selection-changed", this.#onRegionSelected);
    this.#document.off("change", this.#onChange);
    this.#document.off("reset", this.#rebindAll);
    this.#blocks.off("select", this.#onBlockSelected);
    this.#blocks.texture = null;
    this.#texture.off("resized", this.#onResized);
    this.#texture.dispose();
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
