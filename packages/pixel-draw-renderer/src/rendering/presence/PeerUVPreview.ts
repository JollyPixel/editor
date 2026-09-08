// Import Internal Dependencies
import {
  UVRegionBorder,
  type UVRegionBorderStyle
} from "../overlays/UVRegionBorder.ts";
import { PeerRegistry } from "./PeerRegistry.ts";
import type {
  UVRegionLayer
} from "../overlays/UVRegions.ts";
import type { DefaultViewport } from "../Viewport.ts";
import type {
  UVSlot,
  UVGeometry
} from "../../uv/UVRegion.ts";

// CONSTANTS
const kStrokeWidth = 2;

export interface PeerUVPreviewState {
  id: string;
  face: UVSlot | null;
  geometry: UVGeometry;
  color: string;
}

/**
 * Renders non-authoritative peer UV drag borders.
 */
export class PeerUVPreview extends PeerRegistry<
  PeerUVPreviewState,
  UVRegionBorder
> {
  #svg: SVGElement;
  #viewport: DefaultViewport;
  #uvOverlay: UVRegionLayer;

  constructor(
    svg: SVGElement,
    viewport: DefaultViewport,
    uvOverlay: UVRegionLayer
  ) {
    super();
    this.#svg = svg;
    this.#viewport = viewport;
    this.#uvOverlay = uvOverlay;
  }

  set(
    clientId: string,
    state: PeerUVPreviewState
  ): void {
    super.set(clientId, state);
    this.#syncSuppression();
  }

  remove(
    clientId: string
  ): void {
    super.remove(clientId);
    this.#syncSuppression();
  }

  /**
   * Matches regions because presence and command peer ids may differ.
   */
  removeByRegion(
    id: string
  ): void {
    for (const [clientId, state] of [...this.entries()]) {
      if (state.id === id) {
        this.remove(clientId);
      }
    }
  }

  destroy(): void {
    super.destroy();
    this.#syncSuppression();
  }

  #syncSuppression(): void {
    this.#uvOverlay.setGhostSuppressed(
      this.values()
    );
  }

  protected render(
    clientId: string,
    state: PeerUVPreviewState
  ): void {
    const border = this.view(
      clientId
    ) ?? this.#createBorder(
      clientId,
      state.geometry
    );
    const style: UVRegionBorderStyle = {
      color: state.color,
      strokeWidth: kStrokeWidth,
      selected: false,
      dimmed: false,
      dashed: true,
      casing: false
    };

    border.place(
      state.geometry,
      this.#viewport.zoom.value,
      this.#viewport.camera
    );
    border.paint(style);
    border.appendTo(this.#svg);
  }

  protected disposeView(
    view: UVRegionBorder
  ): void {
    view.remove();
  }

  #createBorder(
    clientId: string,
    geometry: UVGeometry
  ): UVRegionBorder {
    const border = new UVRegionBorder(
      geometry
    );
    this.setView(clientId, border);

    return border;
  }
}
