// Import Internal Dependencies
import type {
  AnimationChannel,
  AnimationClipJSON,
  AnimationCommand,
  AnimationKeyJSON,
  AnimationSetSnapshot,
  AnimationTrackJSON
} from "../network/types.ts";
import { AnimationClip } from "./AnimationClip.ts";
import { InvalidAnimationSetError } from "./errors/InvalidAnimationSetError.ts";
import { FrameRate } from "./values/FrameRate.ts";
import { NameSet } from "./values/NameSet.ts";
import { TrackPath } from "./values/TrackPath.ts";

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
  | "track"
  | "keyAt"
  | "accepts"
  | "placeable"
  | "toJSON"
>;

export class AnimationSet {
  #rig = "";
  #clips = new Map<string, AnimationClip>();

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
    return this.#clips.get(clipId)?.toJSON();
  }

  * clips(): IterableIterator<AnimationClipJSON> {
    for (const clip of this.#clips.values()) {
      yield clip.toJSON();
    }
  }

  trackPaths(): string[] {
    const paths = new Map<string, string>();
    for (const clip of this.#clips.values()) {
      for (const path of clip.trackPaths()) {
        const { key } = new TrackPath(path);
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
    return this.#clipNames(exceptId).has(name);
  }

  freeClipName(
    name: string
  ): string {
    return this.#clipNames().free(name);
  }

  track(
    clipId: string,
    path: string
  ): AnimationTrackJSON | undefined {
    return this.#clips.get(clipId)?.track(path);
  }

  keyAt(
    clipId: string,
    path: string,
    channel: AnimationChannel,
    tick: number
  ): AnimationKeyJSON | undefined {
    return this.#clips.get(clipId)?.keyAt(path, channel, tick);
  }

  accepts(
    command: AnimationCommand
  ): boolean {
    switch (command.action) {
      case "rig-renamed":
        return true;
      case "clip-added":
        return !this.#clips.has(command.clip.id) &&
          AnimationClip.problemOf(command.clip) === null &&
          this.#isSlot(command.beforeId, command.clip.id);
      case "clip-removed":
        return this.#clips.has(command.id);
      case "clip-changed":
        return this.#clips.has(command.id) &&
          Object.keys(command.patch).length > 0 &&
          (command.patch.fps === undefined || FrameRate.isValid(command.patch.fps));
      case "clip-moved":
        return this.#clips.has(command.id) &&
          this.#isSlot(command.beforeId, command.id);
      case "key-set":
        return this.#clips.has(command.clipId);
      case "key-removed":
        return this.keyAt(command.clipId, command.path, command.channel, command.tick) !== undefined;
      case "track-removed":
        return this.track(command.clipId, command.path) !== undefined;
      case "track-renamed":
        return this.#clips.get(command.clipId)?.canRenameTrack(command.path, command.to) ?? false;
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
        this.#place(new AnimationClip(command.clip), command.beforeId);
        break;

      case "clip-removed":
        this.#clips.delete(command.id);
        break;

      case "clip-changed":
        this.#update(command.id, (clip) => clip.withPatch(command.patch));
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
        this.#update(command.clipId, (clip) => clip.withKey(command.path, command.channel, command.key));
        break;

      case "key-removed":
        this.#update(command.clipId, (clip) => clip.withoutKey(command.path, command.channel, command.tick));
        break;

      case "track-removed":
        this.#update(command.clipId, (clip) => clip.withoutTrack(command.path));
        break;

      case "track-renamed":
        this.#update(command.clipId, (clip) => clip.withTrackPath(command.path, command.to));
        break;
    }
  }

  load(
    snapshot: AnimationSetSnapshot
  ): void {
    const clips = new Map<string, AnimationClip>();
    for (const clip of snapshot.clips) {
      if (clips.has(clip.id)) {
        throw new InvalidAnimationSetError(clip.id, "is repeated");
      }
      clips.set(clip.id, new AnimationClip(clip));
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
    clip: AnimationClip,
    beforeId: string | undefined
  ): void {
    if (beforeId === undefined || !this.#clips.has(beforeId)) {
      this.#clips.set(clip.id, clip);

      return;
    }

    const clips = new Map<string, AnimationClip>();
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
    change: (clip: AnimationClip) => AnimationClip
  ): void {
    const clip = this.#clips.get(clipId);
    if (clip !== undefined) {
      this.#clips.set(clipId, change(clip));
    }
  }

  #clipNames(
    exceptId?: string
  ): NameSet {
    const names: string[] = [];
    for (const clip of this.#clips.values()) {
      if (clip.id !== exceptId) {
        names.push(clip.name);
      }
    }

    return new NameSet(names);
  }
}
