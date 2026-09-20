// Import Third-party Dependencies
import {
  DEFAULT_UV_SLOTS,
  type PixelDocument,
  type UVMapListener,
  type UVSlot,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import {
  PixelCanvasTexture,
  UVGeometryBinding,
  type FaceRanges
} from "@jolly-pixel/editor.pixel-art/mesh-texturing/index.ts";
import type { UVGhostPayload } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { MirrorAxes } from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import type {
  BlockRegions,
  ModelBlock,
  ModelChange,
  ModelDocument
} from "../model/index.ts";

// CONSTANTS
const kBlockUvSize = { width: 16, height: 16 };
const kBlockUvColor = "#4488ff";
const kBlockRegionPrefix = "block-";
const kFaceVertexCount = 4;

const kBoxFaceStart: Record<UVSlot, number> = {
  right: 0,
  left: 4,
  top: 8,
  bottom: 12,
  front: 16,
  back: 20
};

const kSlotAxis: Record<UVSlot, keyof MirrorAxes> = {
  right: "x",
  left: "x",
  top: "y",
  bottom: "y",
  front: "z",
  back: "z"
};

const kSlotOpposite: Record<UVSlot, UVSlot> = {
  right: "left",
  left: "right",
  top: "bottom",
  bottom: "top",
  front: "back",
  back: "front"
};

const kDefaultFaceUV: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 1],
  [0, 0],
  [1, 0]
];

export interface BlockTexturesOptions {
  pixels: PixelDocument;
  document: ModelDocument;
  pixelsReady: Promise<void>;
}

export class BlockTextures implements BlockRegions {
  #pixels: PixelDocument;
  #document: ModelDocument;
  #texture: PixelCanvasTexture;
  #bindings = new Map<string, UVGeometryBinding>();
  #pixelsLoaded = false;
  #disposed = false;

  #onChange = (
    change: ModelChange
  ): void => {
    const { command } = change;
    switch (command.action) {
      case "group-added":
        this.#bindByUuid(command.uuid);
        break;
      case "group-removed":
        this.#unbind(command.uuid);
        this.#pixels.uv.delete(
          blockRegionId(command.uuid)
        );
        break;
      case "group-renamed":
        if (change.origin === "local") {
          this.#pixels.uv.rename(
            blockRegionId(command.uuid),
            command.name
          );
        }
        break;
      case "group-transformed":
        if (command.flipAxes) {
          this.#bindByUuid(command.uuid);
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
    for (const block of this.#document.blocks.values()) {
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
    for (const block of this.#document.blocks.values()) {
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
    const { blocks } = this.#document;
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
    this.#texture = new PixelCanvasTexture({
      document: pixels,
      get textureSize() {
        return pixels.size();
      },
      textureCanvas: () => pixels.buffer.canvas()
    });
    this.#document.blocks.texture = this.#texture.texture;

    this.#texture.on("resized", this.#onResized);
    pixels.on("reset", this.#rebindAll);
    pixels.uv.on("region-created", this.#onRegionCreated);
    pixels.uv.on("region-deleted", this.#onRegionDeleted);
    pixels.uv.on("selection-changed", this.#onRegionSelected);
    this.#document.on("change", this.#onChange);
    this.#document.on("reset", this.#rebindAll);
    this.#document.blocks.on("select", this.#onBlockSelected);

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
    this.#document.blocks.off("select", this.#onBlockSelected);
    this.#document.blocks.texture = null;
    this.#texture.off("resized", this.#onResized);
    this.#texture.dispose();
  }

  #bindByUuid(
    uuid: string
  ): void {
    const block = this.#document.blocks.get(uuid);
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

    const axes = this.#document.blocks.flipAxesOf(block.uuid);
    resetBoxUv(block, axes);

    const binding = new UVGeometryBinding({
      geometry: block.mesh.geometry,
      region,
      textureSize: this.#pixels.size(),
      faceRanges: boxFaceRanges(axes)
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

function blockRegionId(
  uuid: string
): string {
  return `${kBlockRegionPrefix}${uuid}`;
}

function blockUuidFromRegion(
  id: string
): string | null {
  return id.startsWith(kBlockRegionPrefix)
    ? id.slice(kBlockRegionPrefix.length)
    : null;
}

function isSwapped(
  slot: UVSlot,
  axes: MirrorAxes | undefined
): boolean {
  return axes?.[kSlotAxis[slot]] ?? false;
}

function isMirroredU(
  slot: UVSlot,
  axes: MirrorAxes | undefined
): boolean {
  const ownAxis = kSlotAxis[slot];

  return (["x", "y", "z"] as const)
    .filter((axis) => axis !== ownAxis)
    .reduce((mirrored, axis) => mirrored !== (axes?.[axis] ?? false), false);
}

function boxFaceRanges(
  axes: MirrorAxes | undefined
): FaceRanges {
  return Object.fromEntries(DEFAULT_UV_SLOTS.map((slot) => {
    const vertexSlot = isSwapped(slot, axes) ? kSlotOpposite[slot] : slot;

    return [
      slot,
      [
        {
          start: kBoxFaceStart[vertexSlot],
          count: kFaceVertexCount
        }
      ]
    ];
  }));
}

function resetBoxUv(
  block: ModelBlock,
  axes: MirrorAxes | undefined
): void {
  const uv = block.mesh.geometry.getAttribute("uv");

  for (const slot of DEFAULT_UV_SLOTS) {
    const mirrored = isMirroredU(slot, axes);
    for (let corner = 0; corner < kFaceVertexCount; corner++) {
      const [u, v] = kDefaultFaceUV[corner];
      uv.setXY(
        kBoxFaceStart[slot] + corner,
        mirrored ? 1 - u : u,
        v
      );
    }
  }
  uv.needsUpdate = true;
}
