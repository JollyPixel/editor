// Import Third-party Dependencies
import { InvalidEntryError } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  AnimationChannel,
  AnimationClipJSON,
  AnimationClipPatchJSON,
  AnimationKeyJSON
} from "../network/types.ts";
import { AnimationTrack } from "./AnimationTrack.ts";
import { ClipTimeline } from "./values/ClipTimeline.ts";
import { FrameRate } from "./values/FrameRate.ts";
import { TrackMap } from "./values/TrackMap.ts";
import { TrackPath } from "./values/TrackPath.ts";

export type AnimationClipSettings = Required<AnimationClipPatchJSON>;

export class AnimationClip {
  static findProblem(
    clip: AnimationClipJSON
  ): string | null {
    if (!FrameRate.isValid(clip.fps)) {
      return `has an fps of ${clip.fps} that does not divide the tick rate`;
    }

    const repeated = TrackPath.findRepeated(clip.tracks.map(({ path }) => path));
    if (repeated !== undefined) {
      return `repeats the track ${repeated}`;
    }

    for (const track of clip.tracks) {
      const problem = AnimationTrack.findProblem(track);
      if (problem !== null) {
        return problem;
      }
    }

    return null;
  }

  static parse(
    clip: AnimationClipJSON
  ): AnimationClip {
    const problem = AnimationClip.findProblem(clip);
    if (problem !== null) {
      throw new InvalidEntryError("clip", clip.id, problem);
    }

    return new AnimationClip(
      clip.id,
      clip.name,
      new ClipTimeline(clip),
      new TrackMap(clip.tracks.map(AnimationTrack.parse))
    );
  }

  readonly id: string;
  readonly name: string;
  readonly timeline: ClipTimeline;
  readonly #tracks: TrackMap<AnimationTrack>;

  constructor(
    id: string,
    name: string,
    timeline: ClipTimeline,
    tracks: TrackMap<AnimationTrack>
  ) {
    this.id = id;
    this.name = name;
    this.timeline = timeline;
    this.#tracks = tracks;
  }

  settings(): AnimationClipSettings {
    return {
      name: this.name,
      ...this.timeline.toJSON()
    };
  }

  trackPaths(): IterableIterator<string> {
    return this.#tracks.paths();
  }

  hasTrack(
    path: string
  ): boolean {
    return this.#tracks.has(path);
  }

  track(
    path: string
  ): AnimationTrack | undefined {
    return this.#tracks.get(path);
  }

  keyAt(
    path: string,
    channel: AnimationChannel,
    tick: number
  ): AnimationKeyJSON | undefined {
    return this.#tracks.get(path)?.keyAt(channel, tick);
  }

  canRenameTrack(
    path: string,
    to: string
  ): boolean {
    const track = this.#tracks.get(path);

    return track !== undefined &&
      track.path !== to &&
      (!this.#tracks.has(to) || new TrackPath(path).equals(to));
  }

  canPatch(
    patch: AnimationClipPatchJSON
  ): boolean {
    return Object.keys(patch).length > 0 &&
      (patch.fps === undefined || FrameRate.isValid(patch.fps));
  }

  restoringPatch(
    patch: AnimationClipPatchJSON
  ): AnimationClipPatchJSON {
    const { name, length, fps, loop } = this.settings();

    return {
      ...patch.name === undefined ? {} : { name },
      ...patch.length === undefined ? {} : { length },
      ...patch.fps === undefined ? {} : { fps },
      ...patch.loop === undefined ? {} : { loop }
    };
  }

  withPatch(
    patch: AnimationClipPatchJSON
  ): AnimationClip {
    return new AnimationClip(
      this.id,
      patch.name ?? this.name,
      this.timeline.with(patch),
      this.#tracks
    );
  }

  withKey(
    path: string,
    channel: AnimationChannel,
    key: AnimationKeyJSON
  ): AnimationClip {
    const track = this.#tracks.get(path) ?? new AnimationTrack(path);

    return this.#withTracks(this.#tracks.with(track.withKey(channel, key)));
  }

  withoutKey(
    path: string,
    channel: AnimationChannel,
    tick: number
  ): AnimationClip {
    const track = this.#tracks.get(path)?.withoutKey(channel, tick);
    if (track === undefined) {
      return this;
    }

    return track.isEmpty ?
      this.withoutTrack(path) :
      this.#withTracks(this.#tracks.with(track));
  }

  withoutTrack(
    path: string
  ): AnimationClip {
    return this.#withTracks(this.#tracks.without(path));
  }

  withTrackPath(
    path: string,
    to: string
  ): AnimationClip {
    const renamed = this.#tracks.get(path);
    if (renamed === undefined) {
      return this;
    }

    return this.#withTracks(this.#tracks.map(
      (track) => (track === renamed ? track.renamed(to) : track)
    ));
  }

  toJSON(): AnimationClipJSON {
    return {
      id: this.id,
      ...this.settings(),
      tracks: [...this.#tracks].map((track) => track.toJSON())
    };
  }

  #withTracks(
    tracks: TrackMap<AnimationTrack>
  ): AnimationClip {
    return tracks === this.#tracks ?
      this :
      new AnimationClip(this.id, this.name, this.timeline, tracks);
  }
}
