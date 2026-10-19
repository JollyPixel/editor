// Import Third-party Dependencies
import {
  UVNet,
  type PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

export interface CanvasDefaultsInit {
  uvResizable: boolean;
  uvOverflow: number;
  uvNet: UVNet;
  backgroundColor: string | null;
}

export class CanvasDefaults implements CanvasDefaultsInit {
  readonly uvResizable: boolean;
  readonly uvOverflow: number;
  readonly uvNet: UVNet;
  readonly backgroundColor: string | null;

  constructor(
    init: Partial<CanvasDefaultsInit> = {}
  ) {
    this.uvResizable = init.uvResizable ?? false;
    this.uvOverflow = init.uvOverflow ?? 0;
    this.uvNet = init.uvNet ?? UVNet.packed;
    this.backgroundColor = init.backgroundColor ?? null;

    Object.freeze(this);
  }

  with(
    changes: Partial<CanvasDefaultsInit>
  ): CanvasDefaults {
    return new CanvasDefaults({
      ...this,
      ...changes
    });
  }

  applyTo(
    canvas: PixelArtCanvas
  ): void {
    canvas.tools.uv.resizable = this.uvResizable;
    canvas.uv.overflow = this.uvOverflow;
    canvas.uv.net = this.uvNet;
    if (this.backgroundColor !== null) {
      canvas.backgroundColor = this.backgroundColor;
    }
  }
}
