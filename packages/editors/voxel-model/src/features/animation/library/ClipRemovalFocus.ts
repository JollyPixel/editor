// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { AnimationChange } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import {
  clipTargetOf,
  type AnimationLibrary
} from "./AnimationLibrary.ts";
import type {
  AnimationFocusStore,
  PresenceStore
} from "../../../state/index.ts";
import { combineReleases } from "../../../shared/combineReleases.ts";

export type ClipRemovalFocusEvents = {
  change: () => void;
};

export interface ClipRemovalFocusOptions {
  animations: Pick<AnimationLibrary, "set" | "subscribe">;
  animationFocus: Pick<AnimationFocusStore, "focus" | "focusSet" | "subscribe">;
  presence: Pick<PresenceStore, "peers" | "subscribe">;
}

export class ClipRemovalFocus extends Emitter<ClipRemovalFocusEvents> {
  #options: ClipRemovalFocusOptions;
  #removedBy: string | null = null;
  #release: () => void;

  constructor(
    options: ClipRemovalFocusOptions
  ) {
    super();
    this.#options = options;
    const { animations, animationFocus, presence } = options;
    this.#release = combineReleases([
      animations.subscribe("setChange", this.#onSetChange),
      animationFocus.subscribe("change", this.dismiss),
      presence.subscribe("peersChange", this.#onPeers)
    ]);
  }

  get notice(): string | null {
    const removedBy = this.#removedBy;
    if (removedBy === null) {
      return null;
    }

    const peer = this.#options.presence.peers
      .find(({ clientId }) => clientId === removedBy);

    return `${peer?.displayName ?? "A peer"} deleted the clip you had open.`;
  }

  readonly dismiss = (): void => {
    this.#show(null);
  };

  dispose(): void {
    this.#release();
    this.removeAllListeners();
  }

  readonly #onSetChange = (
    setId: string,
    { command, clientId }: Pick<AnimationChange, "command" | "clientId">
  ): void => {
    const { animations, animationFocus } = this.#options;
    const { focus } = animationFocus;
    const set = animations.set(setId);
    if (
      command.action !== "clip-removed" ||
      set === undefined ||
      focus.setId !== setId ||
      focus.clipId !== command.id
    ) {
      return;
    }

    animationFocus.focusSet(clipTargetOf(set));
    this.#show(clientId);
  };

  readonly #onPeers = (): void => {
    if (this.#removedBy !== null) {
      this.emit("change");
    }
  };

  #show(
    removedBy: string | null
  ): void {
    if (removedBy !== this.#removedBy) {
      this.#removedBy = removedBy;
      this.emit("change");
    }
  }
}
