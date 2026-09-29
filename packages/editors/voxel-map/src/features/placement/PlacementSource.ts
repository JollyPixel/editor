// Import Third-party Dependencies
import {
  VoxelTemplate,
  type VoxelCoord,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";

export class TemplateSource {
  readonly kind = "template";
  readonly templateId: string;

  constructor(
    templateId: string
  ) {
    this.templateId = templateId;

    Object.freeze(this);
  }

  resolve(
    world: VoxelWorld
  ): VoxelTemplate | undefined {
    return world.templates.get(this.templateId);
  }
}

export class LayerSource {
  static capture(
    world: VoxelWorld,
    layerName: string
  ): LayerSource | null {
    const layer = world.getLayer(layerName);
    const bounds = layer?.worldBounds() ?? null;
    if (layer === undefined || bounds === null) {
      return null;
    }

    const snapshot = VoxelTemplate.fromLayer(layer, {
      id: `layer:${layerName}`,
      name: layerName
    });

    return new LayerSource(layerName, snapshot, {
      x: bounds.min.x + snapshot.pivot.x,
      y: bounds.min.y + snapshot.pivot.y,
      z: bounds.min.z + snapshot.pivot.z
    });
  }

  readonly kind = "layer";
  readonly layerName: string;
  readonly snapshot: VoxelTemplate;
  readonly pivot: Readonly<VoxelCoord>;

  constructor(
    layerName: string,
    snapshot: VoxelTemplate,
    pivot: VoxelCoord
  ) {
    this.layerName = layerName;
    this.snapshot = snapshot;
    this.pivot = Object.freeze({ ...pivot });

    Object.freeze(this);
  }

  resolve(
    world: VoxelWorld
  ): VoxelTemplate | undefined {
    return world.getLayer(this.layerName) === undefined ?
      undefined :
      this.snapshot;
  }
}

export type PlacementSource = TemplateSource | LayerSource;
