// Import Internal Dependencies
import type {
  AnimationClipJSON,
  Vector3JSON
} from "../../network/types.ts";
import { AnimationTrack } from "../AnimationTrack.ts";
import { TrackMap } from "../values/TrackMap.ts";

export interface AnimationSample {
  /**
   * Added to the rest position.
   */
  position?: Vector3JSON;
  /**
   * In degrees, added per axis to the rest rotation.
   */
  rotation?: Vector3JSON;
  /**
   * Multiplies the rest scale.
   */
  scale?: Vector3JSON;
}

export interface TrackSample extends AnimationSample {
  path: string;
}

export class ClipSampler {
  readonly #tracks: TrackMap<AnimationTrack>;

  constructor(
    clip: Pick<AnimationClipJSON, "tracks">
  ) {
    this.#tracks = new TrackMap(clip.tracks.map(AnimationTrack.parse));
  }

  sample(
    tick: number
  ): TrackMap<TrackSample> {
    return this.#tracks.map((track) => track.sample(tick));
  }
}
