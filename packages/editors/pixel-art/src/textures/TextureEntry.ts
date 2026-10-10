// Import Third-party Dependencies
import type {
  PixelArtCanvas,
  PixelArtCanvasOptions
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelArtAccess } from "../access/PixelArtAccess.ts";

export interface PixelDrawTextureOptions extends PixelArtCanvasOptions {
  /**
   * Unique key of the texture inside the panel, reported by every texture event.
   */
  id: string;
  /**
   * Label of the texture tab.
   */
  name: string;
  /**
   * Native tooltip of the texture tab.
   * @default ""
   */
  tooltip?: string;
  /**
   * Short chip rendered after the tab label, such as a usage count.
   * The panel gives it no meaning.
   * @default ""
   */
  badge?: string;
  /**
   * A disabled texture keeps its tab but can never become the active one.
   * Its edit button stays usable.
   * @default false
   */
  disabled?: boolean;
  /**
   * What the user may change in this texture.
   * @default PIXEL_ART_CAPABILITIES.full
   */
  access?: PixelArtAccess;
}

export interface TextureUpdate {
  /**
   * New tab label. Left unchanged when omitted.
   */
  name?: string;
  /**
   * New tab tooltip. Left unchanged when omitted.
   */
  tooltip?: string;
  /**
   * New tab badge, an empty string removes it. Left unchanged when omitted.
   */
  badge?: string;
  /**
   * New access, applied to the canvas at once. Left unchanged when omitted.
   */
  access?: PixelArtAccess;
}

export interface TextureEntryInit {
  id: string;
  name: string;
  tooltip: string;
  badge: string;
  disabled: boolean;
  access: PixelArtAccess;
  host: HTMLDivElement;
  canvas: PixelArtCanvas;
}

export class TextureEntry {
  readonly id: string;
  readonly disabled: boolean;
  readonly host: HTMLDivElement;
  readonly canvas: PixelArtCanvas;
  name: string;
  tooltip: string;
  badge: string;
  access: PixelArtAccess;

  constructor(
    init: TextureEntryInit
  ) {
    this.id = init.id;
    this.name = init.name;
    this.tooltip = init.tooltip;
    this.badge = init.badge;
    this.disabled = init.disabled;
    this.access = init.access;
    this.host = init.host;
    this.canvas = init.canvas;
  }

  update(
    changes: TextureUpdate
  ): void {
    this.name = changes.name ?? this.name;
    this.tooltip = changes.tooltip ?? this.tooltip;
    this.badge = changes.badge ?? this.badge;
    this.access = changes.access ?? this.access;
  }

  destroy(): void {
    this.canvas.destroy();
    this.host.remove();
  }
}
