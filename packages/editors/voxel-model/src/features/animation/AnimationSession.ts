// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  frameAt,
  frameToTick,
  type AnimationClipJSON
} from "@jolly-pixel/asset.voxel-animation/client";
import type {
  AnimationSetLinkJSON,
  ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  AnimationLibrary,
  LinkedAnimationSet
} from "./AnimationLibrary.ts";
import type {
  AnimationFocus,
  AnimationFocusStore,
  AnimationPlayback,
  AnimationPlaybackStore,
  TabStore
} from "../../state/index.ts";

export interface FocusedAnimation {
  set: LinkedAnimationSet;
  link: AnimationSetLinkJSON;
  clip: AnimationClipJSON;
}

export type AnimationSessionEvents = {
  /**
   * The focused clip, its contents, or the model it binds to changed.
   */
  clip: () => void;
  /**
   * The playhead moved, playback started or stopped, or Animate opened or closed.
   */
  playhead: () => void;
  active: (active: boolean) => void;
};

export interface AnimationSessionOptions {
  document: ModelDocument;
  animations: AnimationLibrary;
  animationFocus: AnimationFocusStore;
  animationPlayback: AnimationPlaybackStore;
  tab: Pick<TabStore, "active" | "subscribe">;
}

export class AnimationSession extends Emitter<AnimationSessionEvents> {
  #options: AnimationSessionOptions;
  #focused: FocusedAnimation | null = null;
  #active: boolean;
  #unsubscribe: Array<() => void>;

  constructor(
    options: AnimationSessionOptions
  ) {
    super();
    this.#options = options;
    const { document, animations, animationFocus, animationPlayback, tab } = options;
    this.#unsubscribe = [
      document.subscribe("change", this.#resolve),
      document.subscribe("reset", this.#resolve),
      animations.subscribe("change", this.#resolve),
      animationFocus.subscribe("change", this.#onFocus),
      animationPlayback.subscribe("change", this.#onPlayhead),
      tab.subscribe("change", this.#onTab)
    ];
    this.#focused = this.#lookup();
    this.#active = this.active;
  }

  get focused(): FocusedAnimation | null {
    return this.#focused;
  }

  get active(): boolean {
    return this.#options.tab.active === "animate";
  }

  get playback(): AnimationPlayback {
    return this.#options.animationPlayback.playback;
  }

  seek(
    tick: number
  ): void {
    this.#options.animationPlayback.seek(tick);
  }

  pause(): void {
    this.#options.animationPlayback.pause();
  }

  togglePlay(): void {
    const store = this.#options.animationPlayback;
    const clip = this.#focused?.clip;
    const { playing, tick, loop } = store.playback;
    if (playing) {
      store.pause();
    }
    else if (clip !== undefined) {
      if (!loop && tick >= clip.length) {
        store.seek(0);
      }
      store.play();
    }
  }

  toggleLoop(): void {
    this.#options.animationPlayback.toggleLoop();
  }

  stepFrames(
    frames: number
  ): void {
    const clip = this.#focused?.clip;
    if (clip !== undefined) {
      const last = frameAt(clip.length, clip.fps);
      const frame = frameAt(this.playback.tick, clip.fps) + frames;
      this.#pauseAt(frameToTick(Math.min(Math.max(frame, 0), last), clip.fps));
    }
  }

  seekEdge(
    edge: "start" | "end"
  ): void {
    const clip = this.#focused?.clip;
    if (clip !== undefined) {
      this.#pauseAt(edge === "start" ? 0 : clip.length);
    }
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe.splice(0)) {
      unsubscribe();
    }
    this.removeAllListeners();
  }

  readonly #resolve = (): void => {
    this.#focused = this.#lookup();
    this.emit("clip");
  };

  readonly #onFocus = (
    focus: AnimationFocus
  ): void => {
    if (focus.clipId !== null) {
      this.seek(0);
    }
    this.#resolve();
  };

  readonly #onPlayhead = (): void => {
    this.emit("playhead");
  };

  readonly #onTab = (): void => {
    const { active } = this;
    if (active === this.#active) {
      return;
    }

    this.#active = active;
    this.emit("active", active);
    if (!active && this.playback.playing) {
      this.pause();
    }
    else {
      this.emit("playhead");
    }
  };

  #pauseAt(
    tick: number
  ): void {
    this.pause();
    this.seek(tick);
  }

  #lookup(): FocusedAnimation | null {
    const { document, animations, animationFocus } = this.#options;
    const { setId, clipId } = animationFocus.focus;
    if (setId === null || clipId === null) {
      return null;
    }

    const set = animations.set(setId);
    const link = document.tree.animationSets.get(setId);
    const clip = set?.document.set.clip(clipId);
    if (set === undefined || link === undefined || clip === undefined) {
      return null;
    }

    return { set, link, clip };
  }
}
