// Import Third-party Dependencies
import { PresenceChannel } from "@jolly-pixel/network/client";
import { markedPeers } from "@jolly-pixel/ui/network";
import type { VoxelModelRoom } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  isClipKey,
  type AnimateCursor,
  type KeyRef,
  type PresenceStore
} from "../../../state/index.ts";
import type { AnimationSession } from "../session/AnimationSession.ts";
import type { KeyEditor } from "../keys/KeyEditor.ts";
import { PRESENCE_KEYS } from "../../../collaboration/presenceKeys.ts";
import { LatestFrameThrottle } from "../../../collaboration/LatestFrameThrottle.ts";
import { combineReleases } from "../../../shared/combineReleases.ts";

// CONSTANTS
const kThrottleMs = 100;

export interface AnimatePresenceOptions {
  room: VoxelModelRoom;
  session: Pick<AnimationSession, "shownKey" | "playback" | "subscribe">;
  keyEditor: Pick<KeyEditor, "selected" | "subscribe">;
  presence: Pick<PresenceStore, "animateCursors">;
}

export class AnimatePresence {
  #options: AnimatePresenceOptions;
  #cursors: PresenceChannel<AnimateCursor | null>;
  #throttle: LatestFrameThrottle<AnimateCursor>;
  #release: () => void;

  constructor(
    options: AnimatePresenceOptions
  ) {
    this.#options = options;
    const { room, session, keyEditor } = options;
    this.#cursors = new PresenceChannel<AnimateCursor | null>(room, {
      key: PRESENCE_KEYS.animateCursor,
      decode: (value) => decodeAnimateCursor(value)
    });
    this.#throttle = new LatestFrameThrottle(
      kThrottleMs,
      (cursor) => this.#cursors.publish(cursor)
    );
    this.#release = combineReleases([
      this.#cursors.subscribe("change", this.#publishCursors),
      session.subscribe("shown", this.#onShown),
      session.subscribe("playhead", this.#onCursor),
      keyEditor.subscribe("change", this.#onCursor)
    ]);
    this.#onCursor();
    this.#publishCursors();
  }

  dispose(): void {
    this.#release();
    this.#throttle.cancel();
    this.#cursors.destroy();
    this.#options.presence.animateCursors = [];
  }

  readonly #onShown = (): void => {
    this.#throttle.cancel();
    this.#onCursor();
  };

  readonly #onCursor = (): void => {
    const cursor = this.#localCursor();
    if (cursor === null) {
      this.#throttle.cancel();
      this.#cursors.publish(null);
    }
    else {
      this.#throttle.push(cursor);
    }
  };

  readonly #publishCursors = (): void => {
    const { room, presence } = this.#options;
    presence.animateCursors = markedPeers(room, this.#cursors.values)
      .map(([peer, cursor]) => {
        return { peer, cursor };
      });
  };

  #localCursor(): AnimateCursor | null {
    const { session, keyEditor } = this.#options;
    const clip = session.shownKey;
    if (clip === null) {
      return null;
    }

    return {
      clip,
      tick: session.playback.tick,
      keys: keyEditor.selected.map(({ path, tick }) => {
        return { path, tick };
      })
    };
  }
}

export function decodeAnimateCursor(
  value: unknown
): AnimateCursor | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== "object") {
    return undefined;
  }

  const clip: unknown = Reflect.get(value, "clip");
  const tick: unknown = Reflect.get(value, "tick");
  const keys: unknown = Reflect.get(value, "keys");
  if (
    !isClipKey(clip) ||
    !isTick(tick) ||
    !Array.isArray(keys) ||
    !keys.every(isKeyRef)
  ) {
    return undefined;
  }

  return { clip, tick, keys };
}

function isKeyRef(
  value: unknown
): value is KeyRef {
  return typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "path") === "string" &&
    isTick(Reflect.get(value, "tick"));
}

function isTick(
  value: unknown
): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
