// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export interface AnimationFocus {
  setId: string | null;
  /**
   * Never set without `setId`.
   */
  clipId: string | null;
}

export type AnimationFocusEvents = {
  change: (focus: AnimationFocus) => void;
};

export class AnimationFocusStore extends Emitter<AnimationFocusEvents> {
  #focus: AnimationFocus = {
    setId: null,
    clipId: null
  };

  get focus(): AnimationFocus {
    return { ...this.#focus };
  }

  focusSet(
    setId: string | null
  ): void {
    this.#set({ setId, clipId: null });
  }

  focusClip(
    setId: string,
    clipId: string
  ): void {
    this.#set({ setId, clipId });
  }

  #set(
    focus: AnimationFocus
  ): void {
    if (focus.setId === this.#focus.setId && focus.clipId === this.#focus.clipId) {
      return;
    }
    this.#focus = focus;
    this.emit("change", { ...focus });
  }
}
