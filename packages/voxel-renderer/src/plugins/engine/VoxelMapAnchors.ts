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
    key: `layer:${layer.id}`,
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
    key: `object:${object.id}`,
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
