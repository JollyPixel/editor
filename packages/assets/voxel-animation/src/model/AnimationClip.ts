// Import Internal Dependencies
import type {
  AnimationChannel,
  AnimationClipJSON,
  AnimationClipPatchJSON,
  AnimationKeyJSON,
  AnimationTrackJSON
} from "../network/types.ts";
import { ANIMATION_CHANNELS } from "../network/AnimationCommand.schema.ts";
import { InvalidAnimationSetError } from "./errors/InvalidAnimationSetError.ts";
import { KeyCurve } from "./sampling/KeyCurve.ts";
import { FrameRate } from "./values/FrameRate.ts";
import { TrackPath } from "./values/TrackPath.ts";

export class AnimationClip {
  static problemOf(
    clip: AnimationClipJSON
  ): string | null {
    if (!FrameRate.isValid(clip.fps)) {
      return `has an fps of ${clip.fps} that does not divide the tick rate`;
    }

    const paths = new Set<string>();
    for (const track of clip.tracks) {
      const { key } = new TrackPath(track.path);
      if (paths.has(key)) {
        return `repeats the track ${track.path}`;
      }
      paths.add(key);
      for (const channel of ANIMATION_CHANNELS) {
        if (!KeyCurve.isOrdered(track[channel] ?? [])) {
          return `has ${channel} keys of ${track.path} out of order`;
        }
      }
    }

    return null;
  }

  readonly #json: AnimationClipJSON;

  constructor(
    clip: AnimationClipJSON
  ) {
    const problem = AnimationClip.problemOf(clip);
    if (problem !== null) {
      throw new InvalidAnimationSetError(clip.id, problem);
    }

    this.#json = structuredClone(clip);
  }

  get id(): string {
    return this.#json.id;
  }

  get name(): string {
    return this.#json.name;
  }

  * trackPaths(): IterableIterator<string> {
    for (const { path } of this.#json.tracks) {
      yield path;
    }
  }

  track(
    path: string
  ): AnimationTrackJSON | undefined {
    const track = this.#trackOf(path);

    return track === undefined ? undefined : structuredClone(track);
  }

  keyAt(
    path: string,
    channel: AnimationChannel,
    tick: number
  ): AnimationKeyJSON | undefined {
    const key = this.#trackOf(path)?.[channel]?.find((candidate) => candidate.tick === tick);

    return key === undefined ? undefined : structuredClone(key);
  }

  canRenameTrack(
    path: string,
    to: string
  ): boolean {
    const track = this.#trackOf(path);

    return track !== undefined &&
      track.path !== to &&
      (this.#trackOf(to) === undefined || new TrackPath(path).equals(to));
  }

  withPatch(
    patch: AnimationClipPatchJSON
  ): AnimationClip {
    return new AnimationClip({
      ...this.#json,
      ...patch
    });
  }

  withKey(
    path: string,
    channel: AnimationChannel,
    key: AnimationKeyJSON
  ): AnimationClip {
    const track = this.#trackOf(path) ?? { path };
    const keys = [
      ...(track[channel] ?? []).filter(({ tick }) => tick !== key.tick),
      key
    ].sort((left, right) => left.tick - right.tick);

    return this.#withTrack(path, {
      ...track,
      [channel]: keys
    });
  }

  withoutKey(
    path: string,
    channel: AnimationChannel,
    tick: number
  ): AnimationClip {
    const track = this.#trackOf(path);
    if (track === undefined) {
      return this;
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
      this.#withTrack(path, next) :
      this.withoutTrack(path);
  }

  withoutTrack(
    path: string
  ): AnimationClip {
    const removed = new TrackPath(path);

    return this.#withTracks(this.#json.tracks.filter((track) => !removed.equals(track.path)));
  }

  withTrackPath(
    path: string,
    to: string
  ): AnimationClip {
    const renamed = new TrackPath(path);

    return this.#withTracks(this.#json.tracks.map((track) => (renamed.equals(track.path) ?
      {
        ...track,
        path: to
      } :
      track)));
  }

  toJSON(): AnimationClipJSON {
    return structuredClone(this.#json);
  }

  #trackOf(
    path: string
  ): AnimationTrackJSON | undefined {
    const wanted = new TrackPath(path);

    return this.#json.tracks.find((track) => wanted.equals(track.path));
  }

  #withTrack(
    path: string,
    track: AnimationTrackJSON
  ): AnimationClip {
    const wanted = new TrackPath(path);
    const exists = this.#trackOf(path) !== undefined;

    return this.#withTracks(exists ?
      this.#json.tracks.map((candidate) => (wanted.equals(candidate.path) ? track : candidate)) :
      [...this.#json.tracks, track]);
  }

  #withTracks(
    tracks: AnimationTrackJSON[]
  ): AnimationClip {
    return new AnimationClip({
      ...this.#json,
      tracks
    });
  }
}
