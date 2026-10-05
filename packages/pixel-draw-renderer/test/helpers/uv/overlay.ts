// Import Internal Dependencies
import type { UVRegion } from "#src/uv/region/UVRegion.ts";

export class FakeOverlay {
  previews: (UVRegion | null)[] = [];
  resizeHandles = false;

  isPeerDragging(): boolean {
    return false;
  }

  setLivePreview(
    region: UVRegion | null
  ): void {
    this.previews.push(region);
  }
}
