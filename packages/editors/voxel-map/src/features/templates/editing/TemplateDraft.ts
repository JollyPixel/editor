// Import Third-party Dependencies
import {
  VoxelPatchBuilder,
  VoxelTemplate,
  type VoxelCoord,
  type VoxelLayer,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TemplateDraftId } from "../../../document/TemplateDraftId.ts";

export type DraftWorld = Pick<
  VoxelWorld,
  | "addLayer"
  | "getLayerById"
  | "patchVoxels"
  | "removeLayer"
  | "unrecorded"
>;

export class TemplateDraft {
  static find(
    world: Pick<VoxelWorld, "getLayerById">,
    templateId: string
  ): TemplateDraft | null {
    const layer = world.getLayerById(new TemplateDraftId(templateId).layerId);

    return layer === undefined ? null : new TemplateDraft(layer);
  }

  static open(
    world: DraftWorld,
    template: VoxelTemplate
  ): TemplateDraft {
    const existing = TemplateDraft.find(world, template.id);
    if (existing !== null) {
      return existing;
    }

    const { layerId } = new TemplateDraftId(template.id);
    const { pivot } = template;
    const layer = world.unrecorded(() => {
      const added = world.addLayer(layerId, {
        id: layerId,
        visible: false
      });
      const patch = new VoxelPatchBuilder();
      for (const [x, y, z, packed, partner] of template.localVoxels()) {
        patch.push({
          x: x - pivot.x,
          y: y - pivot.y,
          z: z - pivot.z
        }, packed, partner);
      }
      if (patch.cellCount > 0) {
        const { cells, partners } = patch.toPatch();
        world.patchVoxels(added.name, cells, partners);
      }

      return added;
    });

    return new TemplateDraft(layer);
  }

  readonly layer: VoxelLayer;

  constructor(
    layer: VoxelLayer
  ) {
    this.layer = layer;
  }

  get layerName(): string {
    return this.layer.name;
  }

  get pivot(): VoxelCoord {
    return { ...this.layer.position };
  }

  get empty(): boolean {
    return this.layer.voxelCount === 0;
  }

  matches(
    template: VoxelTemplate
  ): boolean {
    return template.sameVoxels(VoxelTemplate.fromLayer(this.layer, {
      id: template.id,
      name: template.name,
      pivot: this.pivot
    }));
  }

  removeFrom(
    world: Pick<VoxelWorld, "removeLayer" | "unrecorded">
  ): boolean {
    return world.unrecorded(() => world.removeLayer(this.layerName));
  }
}
