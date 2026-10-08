// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export interface AnimationPlayback {
  /**
   * The playhead, in ticks from the start of the focused clip.
   */
  tick: number;
  playing: boolean;
  loop: boolean;
}

export type AnimationPlaybackEvents = {
  change: (playback: AnimationPlayback) => void;
};

export class AnimationPlaybackStore extends Emitter<AnimationPlaybackEvents> {
  #playback: AnimationPlayback = {
    tick: 0,
    playing: false,
    loop: true
  };

  get playback(): AnimationPlayback {
    return { ...this.#playback };
  }

  seek(
    tick: number
  ): void {
    this.#set("tick", Math.max(0, Math.round(tick)));
  }

  play(): void {
    this.#set("playing", true);
  }

  pause(): void {
    this.#set("playing", false);
  }

  toggleLoop(): void {
    this.#set("loop", !this.#playback.loop);
  }

  #set<TField extends keyof AnimationPlayback>(
    field: TField,
    value: AnimationPlayback[TField]
  ): void {
    if (this.#playback[field] === value) {
      return;
    }
    this.#playback = {
      ...this.#playback,
      [field]: value
    };
    this.emit("change", { ...this.#playback });
  }
}
