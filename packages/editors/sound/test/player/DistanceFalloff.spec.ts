// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine/core";

// Import Internal Dependencies
import { DistanceFalloff } from "#src/player/spatial/DistanceFalloff.ts";

function falloff(
  spatial: Partial<Systems.SoundSpatialSettings>
): DistanceFalloff {
  return new DistanceFalloff({
    ...Systems.SOUND_SPATIAL_DEFAULTS,
    ...spatial
  });
}

describe("DistanceFalloff", () => {
  for (const { title, spatial, distance, gain } of [
    {
      title: "keeps full volume inside the ref distance",
      spatial: {},
      distance: 0.5,
      gain: 1
    },
    {
      title: "divides the volume by the distance with the inverse model",
      spatial: {},
      distance: 4,
      gain: 0.25
    },
    {
      title: "silences the inverse model when the ref distance is 0",
      spatial: { refDistance: 0 },
      distance: 4,
      gain: 0
    },
    {
      title: "fades evenly down to the max distance with the linear model",
      spatial: {
        distanceModel: "linear",
        maxDistance: 11
      },
      distance: 6,
      gain: 0.5
    },
    {
      title: "stays silent past the max distance with the linear model",
      spatial: {
        distanceModel: "linear",
        maxDistance: 11
      },
      distance: 50,
      gain: 0
    },
    {
      title: "caps the linear rolloff at 1",
      spatial: {
        distanceModel: "linear",
        maxDistance: 11,
        rolloffFactor: 3
      },
      distance: 6,
      gain: 0.5
    },
    {
      title: "fades by a power of the distance with the exponential model",
      spatial: {
        distanceModel: "exponential",
        refDistance: 2,
        rolloffFactor: 2
      },
      distance: 4,
      gain: 0.25
    }
  ] satisfies {
    title: string;
    spatial: Partial<Systems.SoundSpatialSettings>;
    distance: number;
    gain: number;
  }[]) {
    test(title, () => {
      assert.equal(falloff(spatial).gain(distance), gain);
    });
  }

  for (const { title, spatial, gain, distance } of [
    {
      title: "finds where the inverse model reaches a volume",
      spatial: {},
      gain: 0.25,
      distance: 4
    },
    {
      title: "finds where the linear model reaches a volume",
      spatial: {
        distanceModel: "linear",
        maxDistance: 11
      },
      gain: 0.5,
      distance: 6
    },
    {
      title: "never reaches a volume under the linear floor",
      spatial: {
        distanceModel: "linear",
        maxDistance: 11,
        rolloffFactor: 0.5
      },
      gain: 0.25,
      distance: Number.POSITIVE_INFINITY
    },
    {
      title: "finds where the exponential model reaches a volume",
      spatial: {
        distanceModel: "exponential",
        refDistance: 2,
        rolloffFactor: 2
      },
      gain: 0.25,
      distance: 4
    },
    {
      title: "never fades with a rolloff of 0",
      spatial: { rolloffFactor: 0 },
      gain: 0.5,
      distance: Number.POSITIVE_INFINITY
    }
  ] satisfies {
    title: string;
    spatial: Partial<Systems.SoundSpatialSettings>;
    gain: number;
    distance: number;
  }[]) {
    test(title, () => {
      assert.equal(falloff(spatial).distanceAt(gain), distance);
    });
  }

  test("reaches the max distance of the linear model", () => {
    assert.equal(falloff({
      distanceModel: "linear",
      maxDistance: 30
    }).reach(), 30);
  });

  test("reaches a few ref distances when the sound never fades", () => {
    assert.equal(falloff({
      refDistance: 5,
      rolloffFactor: 0
    }).reach(), 20);
  });
});
