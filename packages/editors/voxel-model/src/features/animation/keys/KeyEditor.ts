// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  FrameRate,
  TrackPath,
  type AnimationClipJSON,
  type AnimationDocument,
  type AnimationInterpolation
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { AnimationSession } from "../session/AnimationSession.ts";
import type { ScopeRecorder } from "../../history/index.ts";
import {
  copyKeys,
  interpolationOf,
  keyId,
  moveKeys,
  pasteKeys,
  removeKeys,
  setInterpolation,
  type CopiedKey
} from "../timeline/timelineKeys.ts";
import type {
  ClipKey,
  KeyRef
} from "../../../state/index.ts";

export type KeyEditorEvents = {
  change: () => void;
};

export interface KeyEditorOptions {
  session: Pick<AnimationSession, "focused" | "playback" | "seek">;
  history: ScopeRecorder<ClipKey>;
}

type KeyEdit = (document: AnimationDocument, clip: AnimationClipJSON) => readonly KeyRef[];

export class KeyEditor extends Emitter<KeyEditorEvents> {
  #session: KeyEditorOptions["session"];
  #history: KeyEditorOptions["history"];
  #clipId: string | null = null;
  #refs: readonly KeyRef[] = [];
  #copied: CopiedKey[] = [];

  constructor(
    options: KeyEditorOptions
  ) {
    super();
    this.#session = options.session;
    this.#history = options.history;
  }

  get selected(): readonly KeyRef[] {
    return this.#clipId === this.#session.focused?.clip.id ? this.#refs : [];
  }

  get interpolation(): AnimationInterpolation | "mixed" | null {
    const clip = this.#session.focused?.clip;

    return clip === undefined ? null : interpolationOf(clip, this.selected);
  }

  select(
    ref: KeyRef,
    additive: boolean
  ): boolean {
    const clip = this.#session.focused?.clip;
    if (clip === undefined) {
      return false;
    }

    const refs = this.selected;
    const others = refs.filter((each) => keyId(each) !== keyId(ref));
    const pressed = others.length < refs.length;
    let next = pressed ? refs : [ref];
    if (additive) {
      next = pressed ? others : [...refs, ref];
    }
    this.#set(clip.id, next);
    if (!additive && next.length === 1) {
      this.#session.seek(ref.tick);
    }

    return !(additive && pressed);
  }

  clear(): void {
    this.#set(null, []);
  }

  move(
    frames: number
  ): void {
    const refs = this.selected;
    this.#edit("Move keys", (document, clip) => moveKeys(
      document,
      clip,
      refs,
      frames * new FrameRate(clip.fps).ticksPerFrame
    ));
  }

  remove(): void {
    const refs = this.selected;
    this.#edit("Delete keys", (document, clip) => {
      removeKeys(document, clip, refs);

      return [];
    });
  }

  copy(): void {
    const clip = this.#session.focused?.clip;
    const refs = this.selected;
    if (clip !== undefined && refs.length > 0) {
      this.#copied = copyKeys(clip, refs);
    }
  }

  paste(): void {
    const copied = this.#copied;
    const { tick } = this.#session.playback;
    if (copied.length > 0) {
      this.#edit("Paste keys", (document, clip) => pasteKeys(
        document,
        clip,
        copied,
        new FrameRate(clip.fps).snap(tick)
      ));
    }
  }

  setInterpolation(
    interpolation: AnimationInterpolation
  ): void {
    const refs = this.selected;
    if (refs.length === 0) {
      return;
    }

    const label = refs.length === 1 ?
      `Set interpolation of ${new TrackPath(refs[0].path).blockName}` :
      `Set interpolation of ${refs.length} keys`;
    this.#edit(label, (document, clip) => {
      setInterpolation(document, clip, refs, interpolation);

      return refs;
    });
  }

  #edit(
    label: string,
    edit: KeyEdit
  ): void {
    const focused = this.#session.focused;
    if (focused !== null) {
      const refs = this.#history.record(focused.key, label, () => edit(focused.set.document, focused.clip));
      this.#set(focused.clip.id, refs);
    }
  }

  #set(
    clipId: string | null,
    refs: readonly KeyRef[]
  ): void {
    this.#clipId = clipId;
    this.#refs = refs;
    this.emit("change");
  }
}
