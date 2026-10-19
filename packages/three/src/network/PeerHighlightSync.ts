// Import Third-party Dependencies
import {
  PresenceChannel,
  type PresenceChange,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { MeshHighlight } from "../mesh-highlight/MeshHighlight.ts";
import type { HighlightIndicatorRole } from "../mesh-highlight/peer/PeerHighlights.ts";

// CONSTANTS
const kRoles: readonly HighlightIndicatorRole[] = ["selection", "hover"];
const kDefaultSelectionKey = "selection";
const kDefaultHoverKey = "hover";
const kDefaultHoverThrottleMs = 80;

export type PeerObjectId = string | null;

type PeerObjectChange = PresenceChange<PeerObjectId>;

export interface PeerHighlightSyncOptions {
  room: Room;
  highlight: MeshHighlight;
  /**
   * @default "selection"
   */
  selectionKey?: string;
  /**
   * @default "hover"
   */
  hoverKey?: string;
  /**
   * Minimum delay between two published hovers. The last hover always lands.
   * @default 80
   */
  hoverThrottleMs?: number;
}

export class PeerHighlightSync {
  #highlight: MeshHighlight;
  #channels: Record<HighlightIndicatorRole, PresenceChannel<PeerObjectId>>;
  #hoverThrottleMs: number;

  #hoverSent = false;
  #hoverSentAt = 0;
  #pendingHover: PeerObjectId = null;
  #hoverTimer: ReturnType<typeof setTimeout> | null = null;

  #onRemoteChange: Record<HighlightIndicatorRole, (change: PeerObjectChange) => void> = {
    selection: (change) => this.#apply("selection", change),
    hover: (change) => this.#apply("hover", change)
  };

  #onLocalSelectionChange = (): void => {
    this.#channels.selection.publish(this.#highlight.selected);
  };

  #onLocalHoverChange = (): void => {
    this.#publishHover(this.#highlight.hovered);
  };

  constructor(
    options: PeerHighlightSyncOptions
  ) {
    const { room } = options;
    this.#highlight = options.highlight;
    this.#hoverThrottleMs = options.hoverThrottleMs ?? kDefaultHoverThrottleMs;
    this.#channels = {
      selection: new PresenceChannel(room, {
        key: options.selectionKey ?? kDefaultSelectionKey,
        decode: decodePeerObjectId
      }),
      hover: new PresenceChannel(room, {
        key: options.hoverKey ?? kDefaultHoverKey,
        decode: decodePeerObjectId
      })
    };

    const { peers } = this.#highlight;
    for (const role of kRoles) {
      const channel = this.#channels[role];
      for (const [clientId, objectId] of channel.values) {
        peers.mark(role, clientId, objectId);
      }
      channel.on("change", this.#onRemoteChange[role]);
    }

    this.#highlight.addEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#highlight.addEventListener("hoverChange", this.#onLocalHoverChange);
    this.#channels.selection.publish(this.#highlight.selected);
    this.#publishHover(this.#highlight.hovered);
  }

  destroy(): void {
    this.#highlight.removeEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#highlight.removeEventListener("hoverChange", this.#onLocalHoverChange);
    if (this.#hoverTimer !== null) {
      clearTimeout(this.#hoverTimer);
      this.#hoverTimer = null;
    }
    for (const role of kRoles) {
      this.#channels[role].destroy();
    }
  }

  #apply(
    role: HighlightIndicatorRole,
    change: PeerObjectChange
  ): void {
    const { peers } = this.#highlight;
    peers.mark(role, change.clientId, change.value ?? null);

    const gone = change.value === undefined &&
      kRoles.every((other) => !this.#channels[other].values.has(change.clientId));
    if (gone) {
      peers.removePeer(change.clientId);
    }
  }

  #publishHover(
    objectId: PeerObjectId
  ): void {
    if (this.#hoverTimer !== null) {
      this.#pendingHover = objectId;

      return;
    }

    const elapsed = Date.now() - this.#hoverSentAt;
    if (!this.#hoverSent || elapsed >= this.#hoverThrottleMs) {
      this.#sendHover(objectId);

      return;
    }

    this.#pendingHover = objectId;
    this.#hoverTimer = setTimeout(() => {
      this.#hoverTimer = null;
      this.#sendHover(this.#pendingHover);
    }, this.#hoverThrottleMs - elapsed);
  }

  #sendHover(
    objectId: PeerObjectId
  ): void {
    this.#hoverSent = true;
    this.#hoverSentAt = Date.now();
    this.#channels.hover.publish(objectId);
  }
}

export function decodePeerObjectId(
  value: unknown
): PeerObjectId | undefined {
  if (value === null || typeof value === "string") {
    return value;
  }

  return undefined;
}
