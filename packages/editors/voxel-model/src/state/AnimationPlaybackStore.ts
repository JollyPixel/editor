// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export interface AnimationPlayback {
  /** The playhead, in ticks from the start of the focused clip. */
  tick: number;
  playing: boolean;
}

export type AnimationPlaybackEvents = {
  change: (playback: AnimationPlayback) => void;
};

export class AnimationPlaybackStore extends Emitter<AnimationPlaybackEvents> {
  #playback: AnimationPlayback = {
    tick: 0,
    playing: false
  };

  get playback(): AnimationPlayback {
    return { ...this.#playback };
  }

  seek(
    tick: number
  ): void {
    this.#set({ tick: Math.max(0, Math.round(tick)) });
  }

  play(): void {
    this.#set({ playing: true });
  }

  pause(): void {
    this.#set({ playing: false });
  }

  #set(
    patch: Partial<AnimationPlayback>
  ): void {
    const next = { ...this.#playback, ...patch };
    if (next.tick === this.#playback.tick && next.playing === this.#playback.playing) {
      return;
    }
    this.#playback = next;
    this.emit("change", { ...next });
  }
}
