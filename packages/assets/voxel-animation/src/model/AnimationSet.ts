// Import Internal Dependencies
import type {
  AnimationChannel,
  AnimationClipJSON,
  AnimationCommand,
  AnimationKeyJSON,
  AnimationSetSnapshot
} from "../network/types.ts";
import {
  clipProblem,
  keyAt,
  trackOf,
  withKey,
  withoutKey,
  withoutTrack,
  withTrackPath
} from "./clipTracks.ts";
import { InvalidAnimationSetError } from "./InvalidAnimationSetError.ts";
import {
  freeName,
  nameKey,
  trackPathKey
} from "./names.ts";
import { isFrameRate } from "./ticks.ts";

export type AnimationSetReader = Pick<
  AnimationSet,
  | "rig"
  | "size"
  | "has"
  | "clip"
  | "clips"
  | "trackPaths"
  | "nextClipOf"
  | "clipNameTaken"
  | "freeClipName"
  | "keyAt"
  | "accepts"
  | "placeable"
  | "toJSON"
>;

export class AnimationSet {
  #rig = "";
  #clips = new Map<string, AnimationClipJSON>();

  get rig(): string {
    return this.#rig;
  }

  get size(): number {
    return this.#clips.size;
  }

  has(
    clipId: string
  ): boolean {
    return this.#clips.has(clipId);
  }

  clip(
    clipId: string
  ): AnimationClipJSON | undefined {
    const clip = this.#clips.get(clipId);

    return clip === undefined ? undefined : structuredClone(clip);
  }

  * clips(): IterableIterator<AnimationClipJSON> {
    for (const clip of this.#clips.values()) {
      yield structuredClone(clip);
    }
  }

  trackPaths(): string[] {
    const paths = new Map<string, string>();
    for (const clip of this.#clips.values()) {
      for (const { path } of clip.tracks) {
        const key = trackPathKey(path);
        if (!paths.has(key)) {
          paths.set(key, path);
        }
      }
    }

    return [...paths.values()];
  }

  nextClipOf(
    clipId: string
  ): string | undefined {
    const order = [...this.#clips.keys()];
    const index = order.indexOf(clipId);

    return index === -1 ? undefined : order[index + 1];
  }

  clipNameTaken(
    name: string,
    exceptId?: string
  ): boolean {
    return this.#clipNameKeys(exceptId).has(nameKey(name));
  }

  freeClipName(
    name: string
  ): string {
    const taken = this.#clipNameKeys();

    return freeName(name, (candidate) => taken.has(nameKey(candidate)));
  }

  keyAt(
    clipId: string,
    path: string,
    channel: AnimationChannel,
    tick: number
  ): AnimationKeyJSON | undefined {
    const clip = this.#clips.get(clipId);
    const key = clip === undefined ? undefined : keyAt(clip, path, channel, tick);

    return key === undefined ? undefined : structuredClone(key);
  }

  accepts(
    command: AnimationCommand
  ): boolean {
    switch (command.action) {
      case "rig-renamed":
        return true;
      case "clip-added":
        return !this.#clips.has(command.clip.id) &&
          clipProblem(command.clip) === null &&
          this.#isSlot(command.beforeId, command.clip.id);
      case "clip-removed":
        return this.#clips.has(command.id);
      case "clip-changed":
        return this.#clips.has(command.id) &&
          Object.keys(command.patch).length > 0 &&
          (command.patch.fps === undefined || isFrameRate(command.patch.fps));
      case "clip-moved":
        return this.#clips.has(command.id) &&
          this.#isSlot(command.beforeId, command.id);
      case "key-set":
        return this.#clips.has(command.clipId);
      case "key-removed":
        return this.keyAt(command.clipId, command.path, command.channel, command.tick) !== undefined;
      case "track-removed": {
        const clip = this.#clips.get(command.clipId);

        return clip !== undefined && trackOf(clip, command.path) !== undefined;
      }
      case "track-renamed": {
        const clip = this.#clips.get(command.clipId);
        const track = clip === undefined ? undefined : trackOf(clip, command.path);
        const holder = clip === undefined ? undefined : trackOf(clip, command.to);

        return track !== undefined &&
          track.path !== command.to &&
          (holder === undefined || holder === track);
      }
    }
  }

  apply(
    command: AnimationCommand
  ): void {
    switch (command.action) {
      case "rig-renamed":
        this.#rig = command.rig;
        break;

      case "clip-added":
        this.#place(structuredClone(command.clip), command.beforeId);
        break;

      case "clip-removed":
        this.#clips.delete(command.id);
        break;

      case "clip-changed":
        this.#update(command.id, (clip) => {
          return {
            ...clip,
            ...command.patch
          };
        });
        break;

      case "clip-moved": {
        const clip = this.#clips.get(command.id);
        if (clip !== undefined) {
          this.#clips.delete(command.id);
          this.#place(clip, command.beforeId);
        }
        break;
      }

      case "key-set":
        this.#update(command.clipId, (clip) => withKey(clip, command.path, command.channel, command.key));
        break;

      case "key-removed":
        this.#update(command.clipId, (clip) => withoutKey(clip, command.path, command.channel, command.tick));
        break;

      case "track-removed":
        this.#update(command.clipId, (clip) => withoutTrack(clip, command.path));
        break;

      case "track-renamed":
        this.#update(command.clipId, (clip) => withTrackPath(clip, command.path, command.to));
        break;
    }
  }

  load(
    snapshot: AnimationSetSnapshot
  ): void {
    const clips = new Map<string, AnimationClipJSON>();
    for (const clip of snapshot.clips) {
      if (clips.has(clip.id)) {
        throw new InvalidAnimationSetError(clip.id, "is repeated");
      }
      const problem = clipProblem(clip);
      if (problem !== null) {
        throw new InvalidAnimationSetError(clip.id, problem);
      }
      clips.set(clip.id, structuredClone(clip));
    }

    this.#rig = snapshot.rig;
    this.#clips = clips;
  }

  clear(): void {
    this.#rig = "";
    this.#clips.clear();
  }

  toJSON(): AnimationSetSnapshot {
    return {
      rig: this.#rig,
      clips: [...this.clips()]
    };
  }

  placeable(
    command: AnimationCommand
  ): AnimationCommand {
    if (command.action !== "clip-added" && command.action !== "clip-moved") {
      return command;
    }

    const clipId = command.action === "clip-added" ? command.clip.id : command.id;
    if (this.#isSlot(command.beforeId, clipId)) {
      return command;
    }
    const { beforeId: _beforeId, ...placed } = command;

    return placed;
  }

  #isSlot(
    beforeId: string | undefined,
    clipId: string
  ): boolean {
    return beforeId === undefined || (beforeId !== clipId && this.#clips.has(beforeId));
  }

  #place(
    clip: AnimationClipJSON,
    beforeId: string | undefined
  ): void {
    if (beforeId === undefined || !this.#clips.has(beforeId)) {
      this.#clips.set(clip.id, clip);

      return;
    }

    const clips = new Map<string, AnimationClipJSON>();
    for (const [id, entry] of this.#clips) {
      if (id === beforeId) {
        clips.set(clip.id, clip);
      }
      clips.set(id, entry);
    }
    this.#clips = clips;
  }

  #update(
    clipId: string,
    change: (clip: AnimationClipJSON) => AnimationClipJSON
  ): void {
    const clip = this.#clips.get(clipId);
    if (clip !== undefined) {
      this.#clips.set(clipId, change(clip));
    }
  }

  #clipNameKeys(
    exceptId?: string
  ): Set<string> {
    const keys = new Set<string>();
    for (const clip of this.#clips.values()) {
      if (clip.id !== exceptId) {
        keys.add(nameKey(clip.name));
      }
    }

    return keys;
  }
}
