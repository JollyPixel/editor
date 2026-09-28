// Import Internal Dependencies
import {
  ViewDistance,
  type ViewDistanceOptions
} from "../world/ViewDistance.ts";

export type ViewDistancePolicy =
  | "hide"
  | "unload";

export interface VoxelRangeOptions {
  /**
   * Chunk radius around `focus` kept meshed and drawn, as a radius in chunks
   * or a full `ViewDistance` description. Ignored while `focus` is null.
   * @default Infinity
   */
  viewDistance?: number | ViewDistanceOptions | ViewDistance;

  /**
   * What happens to a chunk that leaves the view distance: `"hide"` keeps its
   * geometry ready to show again, `"unload"` frees it and remeshes on return.
   * @default "hide"
   */
  policy?: ViewDistancePolicy;

  /**
   * Distance in chunks from `focus` beyond which chunks draw flat tile
   * colours and blend blocks opaque. Swaps materials without remeshing.
   * @default Infinity
   */
  farDistance?: number;
}

export class VoxelRange {
  viewDistance: ViewDistance;
  policy: ViewDistancePolicy;
  farDistance: number;

  constructor(
    options: VoxelRangeOptions = {}
  ) {
    const {
      viewDistance,
      policy = "hide",
      farDistance = Infinity
    } = options;

    this.viewDistance = viewDistance === undefined ?
      ViewDistance.Unlimited :
      ViewDistance.from(viewDistance);
    this.policy = policy;
    this.farDistance = farDistance;
  }
}
