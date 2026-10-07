// Import Internal Dependencies
import type {
  AnimationChannel,
  AnimationClipJSON,
  AnimationKeyJSON,
  AnimationTrackJSON
} from "../network/types.ts";
import { ANIMATION_CHANNELS } from "../network/AnimationCommand.schema.ts";
import {
  sameTrackPath,
  trackPathKey
} from "./names.ts";
import { isFrameRate } from "./ticks.ts";

export function clipProblem(
  clip: AnimationClipJSON
): string | null {
  if (!isFrameRate(clip.fps)) {
    return `has an fps of ${clip.fps} that does not divide the tick rate`;
  }

  const paths = new Set<string>();
  for (const track of clip.tracks) {
    const key = trackPathKey(track.path);
    if (paths.has(key)) {
      return `repeats the track ${track.path}`;
    }
    paths.add(key);
    for (const channel of ANIMATION_CHANNELS) {
      const keys = track[channel] ?? [];
      if (keys.some((key, index) => index > 0 && key.tick <= keys[index - 1].tick)) {
        return `has ${channel} keys of ${track.path} out of order`;
      }
    }
  }

  return null;
}

export function trackOf(
  clip: AnimationClipJSON,
  path: string
): AnimationTrackJSON | undefined {
  return clip.tracks.find((track) => sameTrackPath(track.path, path));
}

export function keyAt(
  clip: AnimationClipJSON,
  path: string,
  channel: AnimationChannel,
  tick: number
): AnimationKeyJSON | undefined {
  return trackOf(clip, path)?.[channel]?.find((key) => key.tick === tick);
}

export function withKey(
  clip: AnimationClipJSON,
  path: string,
  channel: AnimationChannel,
  key: AnimationKeyJSON
): AnimationClipJSON {
  const track = trackOf(clip, path) ?? { path };
  const keys = [
    ...(track[channel] ?? []).filter(({ tick }) => tick !== key.tick),
    structuredClone(key)
  ].sort((left, right) => left.tick - right.tick);

  return withTrack(clip, path, {
    ...track,
    [channel]: keys
  });
}

export function withoutKey(
  clip: AnimationClipJSON,
  path: string,
  channel: AnimationChannel,
  tick: number
): AnimationClipJSON {
  const track = trackOf(clip, path);
  if (track === undefined) {
    return clip;
  }

  const keys = (track[channel] ?? []).filter((key) => key.tick !== tick);
  const { [channel]: _removed, ...rest } = track;
  const next: AnimationTrackJSON = keys.length === 0 ?
    rest :
    {
      ...rest,
      [channel]: keys
    };

  return ANIMATION_CHANNELS.some((name) => next[name] !== undefined) ?
    withTrack(clip, path, next) :
    withoutTrack(clip, path);
}

export function withoutTrack(
  clip: AnimationClipJSON,
  path: string
): AnimationClipJSON {
  return {
    ...clip,
    tracks: clip.tracks.filter((track) => !sameTrackPath(track.path, path))
  };
}

export function withTrackPath(
  clip: AnimationClipJSON,
  path: string,
  to: string
): AnimationClipJSON {
  return {
    ...clip,
    tracks: clip.tracks.map((track) => (sameTrackPath(track.path, path) ?
      {
        ...track,
        path: to
      } :
      track))
  };
}

function withTrack(
  clip: AnimationClipJSON,
  path: string,
  track: AnimationTrackJSON
): AnimationClipJSON {
  const exists = trackOf(clip, path) !== undefined;

  return {
    ...clip,
    tracks: exists ?
      clip.tracks.map((candidate) => (sameTrackPath(candidate.path, path) ? track : candidate)) :
      [...clip.tracks, track]
  };
}
