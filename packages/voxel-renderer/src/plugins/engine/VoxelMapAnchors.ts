// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { VoxelDocument } from "../../document/VoxelDocument.ts";
import type { VoxelCommand } from "../../document/commands/types.ts";
import {
  isVoxelEditCommand,
  isVoxelLayerCommand
} from "../../document/commands/categories.ts";
import { VoxelFootprint } from "../../document/world/objects/VoxelFootprint.ts";
import type { VoxelObjectJSON } from "../../document/world/objects/types.ts";
import type { VoxelLayer } from "../../document/world/VoxelLayer.ts";

export type VoxelMapAnchorKind = "layer" | "object";

export class VoxelMapAnchorKey {
  static layer(
    id: string
  ): VoxelMapAnchorKey {
    return new VoxelMapAnchorKey("layer", id);
  }

  static object(
    id: string
  ): VoxelMapAnchorKey {
    return new VoxelMapAnchorKey("object", id);
  }

  static parse(
    key: string
  ): VoxelMapAnchorKey | null {
    const separator = key.indexOf(":");
    if (separator === -1) {
      return null;
    }

    const kind = key.slice(0, separator);
    const id = key.slice(separator + 1);

    return (kind === "layer" || kind === "object") && id.length > 0 ?
      new VoxelMapAnchorKey(kind, id) :
      null;
  }

  readonly kind: VoxelMapAnchorKind;
  readonly id: string;

  constructor(
    kind: VoxelMapAnchorKind,
    id: string
  ) {
    this.kind = kind;
    this.id = id;
  }

  toString(): string {
    return `${this.kind}:${this.id}`;
  }
}

export class VoxelMapAnchors implements Systems.ComponentAnchors {
  #document: VoxelDocument;

  constructor(
    document: VoxelDocument
  ) {
    this.#document = document;
  }

  * list(): IterableIterator<Systems.ComponentAnchor> {
    const { world } = this.#document;

    for (const layer of world.getLayers()) {
      if (layer.anchor) {
        yield layerAnchor(layer);
      }
    }

    for (const objectLayer of world.objectLayers) {
      for (const object of objectLayer.objects) {
        if (object.anchor) {
          yield objectAnchor(object);
        }
      }
    }
  }

  subscribe(
    listener: () => void
  ): () => void {
    function onCommand(
      command: VoxelCommand
    ): void {
      if (
        isVoxelLayerCommand(command) &&
        !isVoxelEditCommand(command)
      ) {
        listener();
      }
    }
    this.#document.on("command", onCommand);
    this.#document.on("loaded", listener);

    return () => {
      this.#document.off("command", onCommand);
      this.#document.off("loaded", listener);
    };
  }
}

function layerAnchor(
  layer: VoxelLayer
): Systems.ComponentAnchor {
  return {
    key: VoxelMapAnchorKey.layer(layer.id).toString(),
    label: layer.name,
    kind: "layer",
    pose: {
      position: {
        ...layer.position
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0
      }
    }
  };
}

function objectAnchor(
  object: VoxelObjectJSON
): Systems.ComponentAnchor {
  const footprint = VoxelFootprint.fromObject(object);

  return {
    key: VoxelMapAnchorKey.object(object.id).toString(),
    label: object.name,
    kind: "object",
    pose: {
      position: {
        x: object.x + (footprint.width / 2),
        y: object.y,
        z: object.z + (footprint.height / 2)
      },
      rotation: {
        x: 0,
        y: object.rotation ?? 0,
        z: 0
      }
    }
  };
}
