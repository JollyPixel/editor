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
  UVRegion
} from "../../uv/region/UVRegion.ts";

// CONSTANTS
const kStrokeWidth = 2;

export interface PeerUVPreviewState {
  region: UVRegion;
  /** `null` draws every face. */
  face: UVSlot | null;
  color: string;
}

/**
 * Renders non-authoritative peer UV drag borders.
 */
export class PeerUVPreview extends PeerRegistry<
  PeerUVPreviewState,
  UVRegionBorder[]
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
      if (state.region.id === id) {
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
      [...this.values()].map(({ region, face }) => {
        return {
          id: region.id,
          face
        };
      })
    );
  }

  protected render(
    clientId: string,
    state: PeerUVPreviewState
  ): void {
    const { region, face } = state;
    const geometries = face === null ?
      region.slotsOf().map(({ geometry }) => geometry) :
      [region.geometryFor(face)];
    const borders = this.view(clientId) ?? [];
    this.setView(clientId, borders);
    while (borders.length > geometries.length) {
      borders.pop()!.remove();
    }

    const style: UVRegionBorderStyle = {
      color: state.color,
      strokeWidth: kStrokeWidth,
      selected: false,
      dimmed: false,
      dashed: true,
      casing: false
    };
    geometries.forEach((geometry, index) => {
      borders[index] ??= new UVRegionBorder(geometry);
      const border = borders[index];
      border.place(
        geometry,
        this.#viewport.zoom.value,
        this.#viewport.camera
      );
      border.paint(style);
      border.appendTo(this.#svg);
    });
  }

  protected disposeView(
    view: UVRegionBorder[]
  ): void {
    for (const border of view) {
      border.remove();
    }
  }
}
