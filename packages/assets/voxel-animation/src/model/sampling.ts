// Import Internal Dependencies
import type {
  AnimationClipJSON,
  AnimationKeyJSON,
  Vector3JSON
} from "../network/types.ts";
import { ANIMATION_CHANNELS } from "../network/AnimationCommand.schema.ts";

export interface AnimationSample {
  /** Added to the rest position. */
  position?: Vector3JSON;
  /** In degrees, added per axis to the rest rotation. */
  rotation?: Vector3JSON;
  /** Multiplies the rest scale. */
  scale?: Vector3JSON;
}

export function sampleChannel(
  keys: readonly AnimationKeyJSON[],
  tick: number
): Vector3JSON | undefined {
  const next = keys.findIndex((key) => key.tick > tick);
  if (next === 0) {
    return { ...keys[0].value };
  }
  if (next === -1) {
    const last = keys.at(-1);

    return last === undefined ? undefined : { ...last.value };
  }

  const from = keys[next - 1];
  const to = keys[next];
  const progress = (tick - from.tick) / (to.tick - from.tick);

  switch (from.interpolation) {
    case "step":
      return { ...from.value };
    case "linear":
      return lerp(from.value, to.value, progress);
    case "smooth":
      return lerp(from.value, to.value, progress * progress * (3 - (2 * progress)));
  }
}

export function sampleClip(
  clip: AnimationClipJSON,
  tick: number
): Map<string, AnimationSample> {
  const samples = new Map<string, AnimationSample>();
  for (const track of clip.tracks) {
    const sample: AnimationSample = {};
    for (const channel of ANIMATION_CHANNELS) {
      const value = sampleChannel(track[channel] ?? [], tick);
      if (value !== undefined) {
        sample[channel] = value;
      }
    }
    samples.set(track.path, sample);
  }

  return samples;
}

export function clipTick(
  clip: Pick<AnimationClipJSON, "length" | "loop">,
  elapsed: number
): number {
  return clip.loop ?
    ((elapsed % clip.length) + clip.length) % clip.length :
    Math.min(Math.max(elapsed, 0), clip.length);
}

function lerp(
  from: Vector3JSON,
  to: Vector3JSON,
  progress: number
): Vector3JSON {
  return {
    x: from.x + ((to.x - from.x) * progress),
    y: from.y + ((to.y - from.y) * progress),
    z: from.z + ((to.z - from.z) * progress)
  };
}
