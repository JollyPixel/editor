// Import Internal Dependencies
import { PeerLayer } from "./PeerLayer.ts";
import type {
  UVPeerPreview,
  UVRegionLayer
} from "../overlays/UVRegions.ts";

export type PeerUVPreviewState = UVPeerPreview;

export class PeerUVPreview extends PeerLayer<PeerUVPreviewState> {
  #uvOverlay: UVRegionLayer;

  constructor(
    uvOverlay: UVRegionLayer
  ) {
    super();
    this.#uvOverlay = uvOverlay;
  }

  removeByRegion(
    id: string
  ): void {
    this.removeWhere((state) => state.region.id === id);
  }

  protected override stateChanged(): void {
    this.#sync();
  }

  protected override stateRemoved(): void {
    this.#sync();
  }

  #sync(): void {
    this.#uvOverlay.setPeerPreviews(new Map(this.states()));
  }
}
