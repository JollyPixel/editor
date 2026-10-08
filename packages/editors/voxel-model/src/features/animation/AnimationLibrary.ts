// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { AnimationDocument } from "@jolly-pixel/asset.voxel-animation/client";
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  registerAnimationSet,
  type EditorHistory
} from "../history/index.ts";

// CONSTANTS
const kUnnamed = "Animation set";
const kOwnClips = "this model";

export interface AnimationSetLease {
  readonly document: AnimationDocument;
  release(): void;
}

export interface AnimationSetRecord {
  id: string;
  kind: string;
  /**
   * The asset's file name without its extension.
   */
  name: string;
}

export interface AnimationSetSource {
  open(id: string): AnimationSetLease;
  create(name: string): Promise<AssetReferenceData>;
  /**
   * Named after the model.
   */
  createOwn(): Promise<AssetReferenceData>;
  rename(id: string, name: string): Promise<void>;
  records(): AnimationSetRecord[];
  /**
   * How many assets reference the set.
   */
  usersOf(id: string): number;
  /**
   * Calls `listener` when records or their users change.
   */
  subscribe(listener: () => void): () => void;
}

export interface LinkedAnimationSet {
  id: string;
  name: string;
  users: number;
  /**
   * Holds this model's own clips rather than shared ones.
   */
  own: boolean;
  document: AnimationDocument;
}

export interface ClipRef {
  setId: string;
  clipId: string;
}

/**
 * `null` stands for the model's own clips; the own set's id never does.
 */
export type ClipTarget = string | null;

export interface ClipPlacement {
  name: string;
  beforeId?: string;
}

export type AnimationLibraryEvents = {
  change: () => void;
};

export interface AnimationLibraryOptions {
  document: ModelDocument;
  source: AnimationSetSource;
  history: Pick<EditorHistory, "register">;
}

interface OpenSet {
  lease: AnimationSetLease;
  unsubscribe: () => void;
}

export class AnimationLibrary extends Emitter<AnimationLibraryEvents> {
  #document: ModelDocument;
  #source: AnimationSetSource;
  #history: Pick<EditorHistory, "register">;
  #open = new Map<string, OpenSet>();
  #creatingOwn: Promise<string> | null = null;
  #unsubscribe: Array<() => void>;

  constructor(
    options: AnimationLibraryOptions
  ) {
    super();
    this.#document = options.document;
    this.#source = options.source;
    this.#history = options.history;
    this.#unsubscribe = [
      this.#document.subscribe("change", this.#sync),
      this.#document.subscribe("reset", this.#sync),
      this.#source.subscribe(this.#notify)
    ];
    this.#sync();
  }

  sets(): LinkedAnimationSet[] {
    return [...this.#document.tree.animationSets.values()].flatMap(({ id }) => {
      const set = this.set(id);

      return set === undefined ? [] : [set];
    });
  }

  set(
    id: string
  ): LinkedAnimationSet | undefined {
    const open = this.#open.get(id);
    if (open === undefined) {
      return undefined;
    }

    return {
      id,
      name: this.#nameOf(id),
      users: this.#source.usersOf(id),
      own: this.#document.tree.animationSets.owned?.id === id,
      document: open.lease.document
    };
  }

  ownSet(): LinkedAnimationSet | undefined {
    const owned = this.#document.tree.animationSets.owned;

    return owned === undefined ? undefined : this.set(owned.id);
  }

  async ensureOwnSet(): Promise<string> {
    const owned = this.#document.tree.animationSets.owned;
    if (owned !== undefined) {
      return owned.id;
    }

    this.#creatingOwn ??= this.#source.createOwn()
      .then((reference) => {
        this.#document.linkAnimationSet(reference, { own: true });
        const linked = this.#document.tree.animationSets.owned;
        if (linked === undefined) {
          throw new Error("the model refused its own animation set");
        }

        return linked.id;
      })
      .finally(() => {
        this.#creatingOwn = null;
      });

    return this.#creatingOwn;
  }

  clipNameTaken(
    target: ClipTarget,
    name: string,
    exceptClipId?: string
  ): boolean {
    return this.#targetSet(target)?.document.set.clipNameTaken(name, exceptClipId) ?? false;
  }

  freeClipName(
    target: ClipTarget,
    name: string
  ): string {
    return this.#targetSet(target)?.document.set.freeClipName(name) ?? name.trim();
  }

  targetName(
    target: ClipTarget
  ): string {
    return target === null ? kOwnClips : this.#nameOf(target);
  }

  async addClip(
    target: ClipTarget,
    name: string
  ): Promise<ClipRef | null> {
    const setId = await this.#resolve(target);
    const clipId = this.set(setId)?.document.addClip({ name }) ?? null;

    return clipId === null ? null : { setId, clipId };
  }

  async copyClip(
    from: ClipRef,
    target: ClipTarget,
    placement: ClipPlacement
  ): Promise<ClipRef | null> {
    const clip = this.set(from.setId)?.document.set.clip(from.clipId);
    if (clip === undefined) {
      return null;
    }

    const setId = await this.#resolve(target);
    const clipId = this.set(setId)?.document.addClip({
      length: clip.length,
      fps: clip.fps,
      loop: clip.loop,
      tracks: clip.tracks,
      ...placement
    }) ?? null;

    return clipId === null ? null : { setId, clipId };
  }

  async share(
    id: string,
    name: string
  ): Promise<string> {
    await this.#source.rename(id, name);
    this.#document.shareAnimationSet(id);

    return id;
  }

  renameSet(
    id: string,
    name: string
  ): Promise<void> {
    return this.#source.rename(id, name);
  }

  linkable(): AnimationSetRecord[] {
    return this.#source.records()
      .filter(({ id }) => !this.#document.tree.animationSets.has(id));
  }

  async create(
    name: string
  ): Promise<string> {
    const reference = await this.#source.create(name);
    this.#document.linkAnimationSet(reference);

    return reference.id;
  }

  link(
    id: string
  ): boolean {
    const record = this.#source.records().find((candidate) => candidate.id === id);

    return record !== undefined && this.#document.linkAnimationSet(record);
  }

  unlink(
    id: string
  ): boolean {
    return this.#document.unlinkAnimationSet(id);
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe.splice(0)) {
      unsubscribe();
    }
    for (const id of [...this.#open.keys()]) {
      this.#close(id);
    }
    this.removeAllListeners();
  }

  readonly #sync = (): void => {
    const linked = new Set(
      [...this.#document.tree.animationSets.values()].map(({ id }) => id)
    );
    let changed = false;
    for (const id of [...this.#open.keys()]) {
      if (!linked.has(id)) {
        this.#close(id);
        changed = true;
      }
    }
    for (const id of linked) {
      if (!this.#open.has(id)) {
        this.#openSet(id);
        changed = true;
      }
    }
    if (changed) {
      this.#notify();
    }
  };

  readonly #notify = (): void => {
    this.emit("change");
  };

  #openSet(
    id: string
  ): void {
    const lease = this.#source.open(id);
    const { document } = lease;
    const unsubscribe = [
      document.subscribe("change", this.#notify),
      document.subscribe("reset", this.#notify),
      registerAnimationSet(this.#history, id, document)
    ];
    this.#open.set(id, {
      lease,
      unsubscribe: () => {
        for (const each of unsubscribe) {
          each();
        }
      }
    });
  }

  #close(
    id: string
  ): void {
    const open = this.#open.get(id);
    if (open !== undefined) {
      open.unsubscribe();
      open.lease.release();
      this.#open.delete(id);
    }
  }

  #nameOf(
    id: string
  ): string {
    return this.#source.records().find((record) => record.id === id)?.name ?? kUnnamed;
  }

  #targetSet(
    target: ClipTarget
  ): LinkedAnimationSet | undefined {
    return target === null ? this.ownSet() : this.set(target);
  }

  async #resolve(
    target: ClipTarget
  ): Promise<string> {
    return target ?? this.ensureOwnSet();
  }
}
