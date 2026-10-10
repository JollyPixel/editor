// Import Internal Dependencies
import type { UVLivePreview } from "#src/rendering/overlays/UVRegions.ts";
import type {
  UVRegion,
  UVSlot
} from "#src/uv/region/UVRegion.ts";

export class FakeOverlay {
  previews: (UVLivePreview | null)[] = [];
  editing = false;
  resizable = false;

  isPeerDragging(): boolean {
    return false;
  }

  setLivePreview(
    preview: UVLivePreview | null
  ): void {
    this.previews.push(preview);
  }
}

export function livePreview(
  region: UVRegion | null,
  slot: UVSlot | null = null
): UVLivePreview | null {
  return region === null ? null : { regions: [region], slot };
}
