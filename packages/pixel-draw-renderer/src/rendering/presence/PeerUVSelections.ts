// Import Internal Dependencies
import { PeerLayer } from "./PeerLayer.ts";
import type { UVRegionLayer } from "../overlays/UVRegions.ts";

export interface PeerUVSelectionState {
  regionId: string;
  color: string;
}

export class PeerUVSelections extends PeerLayer<PeerUVSelectionState> {
  #uvOverlay: UVRegionLayer;

  constructor(
    uvOverlay: UVRegionLayer
  ) {
    super();
    this.#uvOverlay = uvOverlay;
  }

  override set(
    clientId: string,
    state: PeerUVSelectionState
  ): void {
    super.set(clientId, { ...state });
  }

  protected override stateChanged(): void {
    this.#sync();
  }

  protected override stateRemoved(): void {
    this.#sync();
  }

  #sync(): void {
    const colorByRegion = new Map<string, string>();
    for (const [, { regionId, color }] of this.states()) {
      if (!colorByRegion.has(regionId)) {
        colorByRegion.set(regionId, color);
      }
    }
    this.#uvOverlay.setPeerSelections(colorByRegion);
  }
}
