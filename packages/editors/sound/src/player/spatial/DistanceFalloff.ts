// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/ecs";
import { clamp } from "@jolly-pixel/utils";

type SpatialSettings = Readonly<Systems.SoundSpatialSettings>;

interface FalloffCurve {
  gain(distance: number): number;
  distanceAt(gain: number): number;
  fadeEnd(): number;
}

// CONSTANTS
const kQuietGain = 10 ** (-24 / 20);
const kUnfadingReach = 4;
const kMinReach = 1;
const kMaxReach = 1_000;
const kCurves: Record<
  Systems.SoundDistanceModel,
  (spatial: SpatialSettings) => FalloffCurve
> = {
  linear: linearCurve,
  inverse: (spatial) => {
    const { rolloffFactor: rolloff } = spatial;

    return refCurve(
      spatial,
      (ratio) => 1 / (1 + rolloff * (ratio - 1)),
      (gain) => 1 + (1 / gain - 1) / rolloff
    );
  },
  exponential: (spatial) => {
    const { rolloffFactor: rolloff } = spatial;

    return refCurve(
      spatial,
      (ratio) => ratio ** -rolloff,
      (gain) => gain ** (-1 / rolloff)
    );
  }
};

export class DistanceFalloff {
  #spatial: SpatialSettings;
  #curve: FalloffCurve;

  constructor(
    spatial: SpatialSettings
  ) {
    this.#spatial = spatial;
    this.#curve = kCurves[spatial.distanceModel](spatial);
  }

  gain(
    distance: number
  ): number {
    return this.#curve.gain(distance);
  }

  distanceAt(
    gain: number
  ): number {
    return this.#curve.distanceAt(gain);
  }

  fadeEnd(): number {
    return this.#curve.fadeEnd();
  }

  reach(): number {
    const end = this.fadeEnd();
    const quiet = Number.isFinite(end) ? end : this.distanceAt(kQuietGain);
    const reach = Number.isFinite(quiet) ?
      quiet :
      this.#spatial.refDistance * kUnfadingReach;

    return clamp(reach, kMinReach, kMaxReach);
  }
}

function linearCurve(
  spatial: SpatialSettings
): FalloffCurve {
  const near = Math.min(spatial.refDistance, spatial.maxDistance);
  const far = Math.max(spatial.refDistance, spatial.maxDistance);
  const rolloff = clamp(spatial.rolloffFactor, 0, 1);

  return {
    gain: (distance) => (near === far ?
      1 - rolloff :
      1 - rolloff * (clamp(distance, near, far) - near) / (far - near)),
    distanceAt: (gain) => {
      if (gain >= 1) {
        return near;
      }

      return gain < 1 - rolloff ?
        Number.POSITIVE_INFINITY :
        near + (1 - gain) / rolloff * (far - near);
    },
    fadeEnd: () => far
  };
}

function refCurve(
  spatial: SpatialSettings,
  fade: (ratio: number) => number,
  unfade: (gain: number) => number
): FalloffCurve {
  const { refDistance: ref, rolloffFactor: rolloff } = spatial;

  return {
    gain: (distance) => (ref === 0 ? 0 : fade(Math.max(distance, ref) / ref)),
    distanceAt: (gain) => {
      if (ref === 0 || gain >= 1) {
        return ref;
      }
      if (rolloff === 0 || gain <= 0) {
        return Number.POSITIVE_INFINITY;
      }

      return ref * unfade(gain);
    },
    fadeEnd: () => Number.POSITIVE_INFINITY
  };
}
