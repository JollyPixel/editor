// Import Third-party Dependencies
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

export type ViewCanvas = Pick<PixelArtCanvas, "uv" | "grid">;

export interface ViewSettingsInit {
  showAll: boolean;
  showRegionLabels: boolean;
  showSizeLabels: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
}

export class ViewSettings implements ViewSettingsInit {
  static capture(
    canvas: ViewCanvas
  ): ViewSettings {
    const { uv, grid } = canvas;

    return new ViewSettings({
      showAll: uv.showAll,
      showRegionLabels: uv.showRegionLabels,
      showSizeLabels: uv.showSizeLabels,
      showGrid: grid.visible,
      snapToGrid: grid.snap
    });
  }

  readonly showAll: boolean;
  readonly showRegionLabels: boolean;
  readonly showSizeLabels: boolean;
  readonly showGrid: boolean;
  readonly snapToGrid: boolean;

  constructor(
    init: ViewSettingsInit
  ) {
    this.showAll = init.showAll;
    this.showRegionLabels = init.showRegionLabels;
    this.showSizeLabels = init.showSizeLabels;
    this.showGrid = init.showGrid;
    this.snapToGrid = init.snapToGrid;

    Object.freeze(this);
  }

  applyTo(
    canvas: ViewCanvas
  ): void {
    const { uv, grid } = canvas;

    uv.showAll = this.showAll;
    uv.showRegionLabels = this.showRegionLabels;
    uv.showSizeLabels = this.showSizeLabels;
    grid.visible = this.showGrid;
    grid.snap = this.snapToGrid;
  }
}
