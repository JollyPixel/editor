// Import Third-party Dependencies
import type { VoxelLayer } from "@jolly-pixel/voxel.renderer";

export class TemplateDraftId {
  static readonly PREFIX = "template-draft:";

  static parse(
    layerId: string
  ): TemplateDraftId | null {
    return layerId.startsWith(TemplateDraftId.PREFIX) ?
      new TemplateDraftId(layerId.slice(TemplateDraftId.PREFIX.length)) :
      null;
  }

  static isDraft(
    layer: Pick<VoxelLayer, "id">
  ): boolean {
    return TemplateDraftId.parse(layer.id) !== null;
  }

  readonly templateId: string;

  constructor(
    templateId: string
  ) {
    this.templateId = templateId;
  }

  get layerId(): string {
    return `${TemplateDraftId.PREFIX}${this.templateId}`;
  }
}
