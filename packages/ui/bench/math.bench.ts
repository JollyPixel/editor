// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  quatHasChanged,
  vectorValueHasChanged
} from "../src/math/equals.ts";
import {
  eulerRoundTrips,
  quaternionToEuler
} from "../src/math/euler.ts";
import { isTransformLike } from "../src/math/guards.ts";
import {
  copyComponents,
  snapshotComponents
} from "../src/math/components.ts";
import { formatVector } from "../src/monitors/format.ts";
import {
  BATCH,
  batchOf,
  type Rng
} from "./_fixtures.ts";

const suite = defineSuite("math", (bench) => {
  const vectors = batchOf(vector3);
  const copies = vectors.map((vector) => {
    return {
      ...vector
    };
  });
  const quaternions = batchOf(quaternion);
  const quaternionCopies = quaternions.map((value) => {
    return {
      ...value
    };
  });
  const transforms = batchOf((rng) => {
    return {
      position: vector3(rng),
      rotation: quaternion(rng),
      scale: vector3(rng)
    };
  });
  const targets = batchOf((rng) => {
    return {
      position: vector3(rng),
      rotation: quaternion(rng),
      scale: vector3(rng)
    };
  });

  bench
    .add("vectorValueHasChanged equal", () => countOf(
      vectors,
      (vector, index) => vectorValueHasChanged(vector, copies[index])
    ))
    .add("quatHasChanged equal", () => countOf(
      quaternions,
      (value, index) => quatHasChanged(value, quaternionCopies[index])
    ))
    .add("isTransformLike", () => countOf(transforms, isTransformLike))
    .add("snapshotComponents transform", () => countOf(
      transforms,
      (transform) => snapshotComponents(transform) !== null
    ))
    .add("copyComponents transform", () => countOf(
      transforms,
      (transform, index) => {
        copyComponents(targets[index], transform);

        return true;
      }
    ))
    .add("quaternionToEuler round trip", () => countOf(
      quaternions,
      (value) => eulerRoundTrips(quaternionToEuler(value), value)
    ))
    .add("formatVector", () => countOf(
      vectors,
      (vector) => formatVector(vector).length > 0
    ));
}, { opsPerIteration: BATCH });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}

function vector3(
  rng: Rng
): { x: number; y: number; z: number; } {
  return {
    x: rng() * 200 - 100,
    y: rng() * 200 - 100,
    z: rng() * 200 - 100
  };
}

function quaternion(
  rng: Rng
): { x: number; y: number; z: number; w: number; } {
  const x = rng() - 0.5;
  const y = rng() - 0.5;
  const z = rng() - 0.5;
  const w = rng() - 0.5;
  const length = Math.hypot(x, y, z, w) || 1;

  return {
    x: x / length,
    y: y / length,
    z: z / length,
    w: w / length
  };
}

function countOf<T>(
  items: T[],
  predicate: (item: T, index: number) => boolean
): number {
  let count = 0;
  for (let index = 0; index < items.length; index++) {
    if (predicate(items[index], index)) {
      count++;
    }
  }

  return count;
}
