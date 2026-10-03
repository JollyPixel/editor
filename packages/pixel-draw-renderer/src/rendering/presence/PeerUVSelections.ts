// Import Internal Dependencies
import type { UVRegionLayer } from "../overlays/UVRegions.ts";

export interface PeerUVSelectionState {
  regionId: string;
  color: string;
}

export class PeerUVSelections {
  #uvOverlay: UVRegionLayer;
  #states = new Map<string, PeerUVSelectionState>();

  constructor(
    uvOverlay: UVRegionLayer
  ) {
    this.#uvOverlay = uvOverlay;
  }

  set(
    clientId: string,
    state: PeerUVSelectionState
  ): void {
    this.#states.set(clientId, { ...state });
    this.#sync();
  }

  remove(
    clientId: string
  ): void {
    if (this.#states.delete(clientId)) {
      this.#sync();
    }
  }

  clearAll(): void {
    this.#states.clear();
    this.#sync();
  }

  destroy(): void {
    this.clearAll();
  }

  #sync(): void {
    const colorByRegion = new Map<string, string>();
    for (const { regionId, color } of this.#states.values()) {
      if (!colorByRegion.has(regionId)) {
        colorByRegion.set(regionId, color);
      }
    }
    this.#uvOverlay.setPeerSelections(colorByRegion);
  }
}
