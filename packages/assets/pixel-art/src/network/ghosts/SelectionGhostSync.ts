// Import Third-party Dependencies
import { PresenceChannel, type PresenceChange } from "@jolly-pixel/network/client";
import type {
  PixelArtCanvas,
  SelectionPresence,
  SelectionPresenceData
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  decodeSelectionPresence,
  encodeSelectionPresence
} from "./SelectionPresenceCodec.ts";
import {
  peerStyle,
  type PeerColor,
  type PeerStyle
} from "../peerAppearance.ts";
import type {
  PixelArtRoom,
  PixelServerMessage
} from "../types.ts";

export interface SelectionGhostSyncOptions {
  room: PixelArtRoom;
  canvas: PixelArtCanvas;
  color: PeerColor;
}

export class SelectionGhostSync {
  #canvas: PixelArtCanvas;
  #room: PixelArtRoom;
  #colorOf: PeerStyle;
  #channel: PresenceChannel<SelectionPresenceData>;
  #pending: SelectionPresenceData | undefined;
  #frame: number | undefined;
  #destroyed = false;

  #onSelectionChanged = (
    presence: SelectionPresence | null
  ): void => {
    const state = presence?.toJSON() ?? null;
    this.#cancelPending();
    if (state !== null && (state.phase === "creating" ||
      state.phase === "resizing" || state.phase === "moving")) {
      this.#pending = state;
      this.#frame = requestAnimationFrame(() => {
        const pending = this.#pending;
        this.#frame = undefined;
        this.#pending = undefined;
        if (pending !== undefined) {
          this.#publish(pending);
        }
      });
    }
    else {
      this.#publish(state);
    }
  };

  #onPeerChange = (
    change: PresenceChange<SelectionPresenceData>
  ): void => {
    const { selectionOutlines, floatingSelections } = this.#canvas.peerPresence;
    const state = change.value;
    if (state === undefined) {
      selectionOutlines.remove(change.clientId);
      floatingSelections.remove(change.clientId);

      return;
    }
    const preview = "sourceRect" in state;
    selectionOutlines.set(change.clientId, {
      rect: preview ? state.liveRect : state.rect,
      mask: "mask" in state ? state.mask : null,
      color: this.#colorOf(change.clientId)
    });
    if (preview) {
      floatingSelections.set(change.clientId, {
        sourceRect: state.sourceRect,
        liveRect: state.liveRect,
        mask: state.mask,
        pixels: state.pixels,
        eraseColor: state.eraseColor,
        blankSource: state.blankSource
      });
    }
    else {
      floatingSelections.remove(change.clientId);
    }
  };

  #onMessage = (
    message: PixelServerMessage
  ): void => {
    if (message.type === "snapshot") {
      for (const [clientId, value] of this.#channel.values) {
        this.#onPeerChange({ clientId, value });
      }
    }
  };

  constructor(
    options: SelectionGhostSyncOptions
  ) {
    this.#canvas = options.canvas;
    this.#room = options.room;
    this.#colorOf = peerStyle(options.room, options.color);
    this.#channel = new PresenceChannel(options.room, {
      key: "selectionGhost",
      decode: (value) => decodeSelectionPresence(
        value,
        options.canvas.document.buffer.maxSize ** 2
      ),
      equals: () => false
    });
    for (const [clientId, value] of this.#channel.values) {
      this.#onPeerChange({ clientId, value });
    }
    this.#channel.on("change", this.#onPeerChange);
    this.#room.on("message", this.#onMessage);
    this.#canvas.selectionEvents.on(
      "selection-presence-changed",
      this.#onSelectionChanged
    );
    this.#publish(this.#canvas.selectionPresence?.toJSON() ?? null);
  }

  destroy(): void {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#cancelPending();
    this.#publish(null);
    this.#canvas.selectionEvents.off(
      "selection-presence-changed",
      this.#onSelectionChanged
    );
    this.#room.off("message", this.#onMessage);
    this.#channel.destroy();
  }

  #publish(
    state: SelectionPresenceData | null
  ): void {
    this.#room.updatePresence({
      selectionGhost: encodeSelectionPresence(state)
    });
  }

  #cancelPending(): void {
    if (this.#frame !== undefined) {
      cancelAnimationFrame(this.#frame);
      this.#frame = undefined;
    }
    this.#pending = undefined;
  }
}
