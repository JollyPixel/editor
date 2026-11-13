// Import Third-party Dependencies
import {
  InvalidEntryError,
  NameSet
} from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  AnimationCommand,
  AnimationSetSnapshot
} from "../network/types.ts";
import { AnimationClip } from "./AnimationClip.ts";
import {
  acceptsAnimationCommand,
  placeAnimationCommand
} from "./command/animationCommands.ts";
import { TrackPath } from "./values/TrackPath.ts";

export type AnimationSetReader = Pick<
  AnimationSet,
  | "rig"
  | "size"
  | "has"
  | "clip"
  | "clips"
  | "clipIds"
  | "trackPaths"
  | "nextClipAfter"
  | "clipNameTaken"
  | "freeClipName"
  | "canPlace"
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
  ): AnimationClip | undefined {
    return this.#clips.get(clipId);
  }

  clips(): IterableIterator<AnimationClip> {
    return this.#clips.values();
  }

  clipIds(): IterableIterator<string> {
    return this.#clips.keys();
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

  nextClipAfter(
    clipId: string
  ): string | undefined {
    let found = false;
    for (const id of this.#clips.keys()) {
      if (found) {
        return id;
      }
      found = id === clipId;
    }

    return undefined;
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

  accepts(
    command: AnimationCommand
  ): boolean {
    return acceptsAnimationCommand(this, command);
  }

  canPlace(
    clipId: string,
    beforeId: string | undefined
  ): boolean {
    return beforeId === undefined || (beforeId !== clipId && this.#clips.has(beforeId));
  }

  apply(
    command: AnimationCommand
  ): void {
    switch (command.action) {
      case "rig-renamed":
        this.#rig = command.rig;
        break;

      case "clip-added":
        this.#place(AnimationClip.parse(command.clip), command.beforeId);
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

      default:
        return command satisfies never;
    }
  }

  load(
    snapshot: AnimationSetSnapshot
  ): void {
    const clips = new Map<string, AnimationClip>();
    for (const clip of snapshot.clips) {
      if (clips.has(clip.id)) {
        throw new InvalidEntryError("clip", clip.id, "is repeated");
      }
      clips.set(clip.id, AnimationClip.parse(clip));
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
      clips: [...this.#clips.values()].map((clip) => clip.toJSON())
    };
  }

  placeable(
    command: AnimationCommand
  ): AnimationCommand {
    return placeAnimationCommand(this, command);
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
