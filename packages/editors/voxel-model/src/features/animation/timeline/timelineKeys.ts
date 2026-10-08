// Import Third-party Dependencies
import {
  ANIMATION_CHANNELS,
  type AnimationChannel,
  type AnimationClipJSON,
  type AnimationDocument,
  type AnimationInterpolation,
  type AnimationKeyJSON
} from "@jolly-pixel/asset.voxel-animation/client";

export interface KeyRef {
  path: string;
  tick: number;
}

export interface CopiedKey {
  path: string;
  channel: AnimationChannel;
  /**
   * `tick` counts from the earliest key copied.
   */
  key: AnimationKeyJSON;
}

interface ChannelKey {
  path: string;
  channel: AnimationChannel;
  key: AnimationKeyJSON;
}

export function keyId(
  ref: KeyRef
): string {
  return `${ref.tick}:${ref.path}`;
}

export function copyKeys(
  clip: AnimationClipJSON,
  refs: readonly KeyRef[]
): CopiedKey[] {
  const keys = channelKeys(clip, refs);
  const start = Math.min(...keys.map(({ key }) => key.tick));

  return keys.map((entry) => {
    return {
      ...entry,
      key: {
        ...entry.key,
        tick: entry.key.tick - start
      }
    };
  });
}

export function pasteKeys(
  document: AnimationDocument,
  clip: AnimationClipJSON,
  copied: readonly CopiedKey[],
  tick: number
): KeyRef[] {
  const placed = copied
    .map((entry) => {
      return {
        ...entry,
        key: {
          ...entry.key,
          tick: entry.key.tick + tick
        }
      };
    })
    .filter(({ key }) => key.tick <= clip.length);

  return setKeys(document, clip.id, placed);
}

export function moveKeys(
  document: AnimationDocument,
  clip: AnimationClipJSON,
  refs: readonly KeyRef[],
  delta: number
): KeyRef[] {
  const keys = channelKeys(clip, refs);
  const ticks = keys.map(({ key }) => key.tick);
  const shift = Math.min(Math.max(delta, -Math.min(...ticks)), clip.length - Math.max(...ticks));
  if (keys.length === 0 || shift === 0) {
    return [...refs];
  }

  removeKeys(document, clip, refs);

  return setKeys(document, clip.id, keys.map((entry) => {
    return {
      ...entry,
      key: {
        ...entry.key,
        tick: entry.key.tick + shift
      }
    };
  }));
}

export function removeKeys(
  document: AnimationDocument,
  clip: AnimationClipJSON,
  refs: readonly KeyRef[]
): void {
  for (const { path, channel, key } of channelKeys(clip, refs)) {
    document.removeKey(clip.id, path, channel, key.tick);
  }
}

export function interpolationOf(
  clip: AnimationClipJSON,
  refs: readonly KeyRef[]
): AnimationInterpolation | "mixed" | null {
  const interpolations = new Set(channelKeys(clip, refs).map(({ key }) => key.interpolation));
  if (interpolations.size === 0) {
    return null;
  }

  return interpolations.size === 1 ? [...interpolations][0] : "mixed";
}

export function setInterpolation(
  document: AnimationDocument,
  clip: AnimationClipJSON,
  refs: readonly KeyRef[],
  interpolation: AnimationInterpolation
): void {
  const keys = channelKeys(clip, refs).filter(({ key }) => key.interpolation !== interpolation);
  setKeys(document, clip.id, keys.map((entry) => {
    return {
      ...entry,
      key: {
        ...entry.key,
        interpolation
      }
    };
  }));
}

function channelKeys(
  clip: AnimationClipJSON,
  refs: readonly KeyRef[]
): ChannelKey[] {
  const wanted = new Set(refs.map(keyId));

  return clip.tracks.flatMap((track) => ANIMATION_CHANNELS.flatMap((channel) => (track[channel] ?? [])
    .filter((key) => wanted.has(keyId({ path: track.path, tick: key.tick })))
    .map((key) => {
      return {
        path: track.path,
        channel,
        key: structuredClone(key)
      };
    })));
}

function setKeys(
  document: AnimationDocument,
  clipId: string,
  keys: readonly ChannelKey[]
): KeyRef[] {
  const placed = new Map<string, KeyRef>();
  for (const { path, channel, key } of keys) {
    if (document.setKey(clipId, path, channel, key)) {
      const ref = { path, tick: key.tick };
      placed.set(keyId(ref), ref);
    }
  }

  return [...placed.values()];
}
