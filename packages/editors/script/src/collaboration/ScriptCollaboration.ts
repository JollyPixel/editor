// Import Third-party Dependencies
import type { ScriptDocument } from "@jolly-pixel/asset.script/client";
import {
  PresenceChannel,
  type Room
} from "@jolly-pixel/network/client";
import type { PresencePeer } from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { ScriptCaret } from "../text/ScriptCaret.ts";

export interface PeerCaret {
  readonly peer: PresencePeer;
  readonly caret: ScriptCaret;
}

export type ScriptCollaborationEvents = {
  caretsChange: (carets: readonly PeerCaret[]) => void;
  peersChange: (peers: readonly PresencePeer[]) => void;
};

export interface ScriptCollaborationOptions {
  room: Room;
  document: ScriptDocument;
}

// CONSTANTS
const kCaretKey = "caret";

export class ScriptCollaboration {
  #events = new Emitter<ScriptCollaborationEvents>();
  #document: ScriptDocument;
  #roster: PeerRoster;
  #channel: PresenceChannel<ScriptCaret | null>;
  #carets = new Map<string, ScriptCaret>();
  #peers: readonly PresencePeer[] = [];
  #release: () => void;

  constructor(
    options: ScriptCollaborationOptions
  ) {
    const { room, document } = options;
    this.#document = document;
    this.#channel = new PresenceChannel<ScriptCaret | null>(room, {
      key: kCaretKey,
      decode: (value) => ScriptCaret.parse(value),
      equals: (left, right) => (
        left === right ||
        (left !== null && right !== null && left.equals(right))
      )
    });
    this.#channel.on("change", ({ clientId, value }) => {
      if (value === undefined || value === null) {
        this.#carets.delete(clientId);
      }
      else {
        this.#carets.set(clientId, value);
      }
      this.#emitCarets();
    });
    for (const [clientId, value] of this.#channel.values) {
      if (value !== null) {
        this.#carets.set(clientId, value);
      }
    }
    this.#roster = new PeerRoster({
      room,
      publish: (peers) => {
        this.#peers = peers;
        this.#events.emit("peersChange", peers);
        this.#emitCarets();
      }
    });
    this.#release = document.subscribe("change", ({ edit, origin, author }) => {
      if (this.#carets.size === 0) {
        return;
      }
      if (origin !== "load") {
        for (const [clientId, caret] of this.#carets) {
          if (clientId !== author) {
            this.#carets.set(clientId, caret.follow(edit));
          }
        }
      }
      this.#emitCarets();
    });
  }

  get peers(): readonly PresencePeer[] {
    return this.#peers;
  }

  get carets(): readonly PeerCaret[] {
    const carets: PeerCaret[] = [];
    for (const peer of this.#peers) {
      const caret = this.#carets.get(peer.clientId);
      if (caret !== undefined && peer.self !== true) {
        carets.push({
          peer,
          caret: caret.clamp(this.#document.text.length)
        });
      }
    }

    return carets;
  }

  publish(
    caret: ScriptCaret | null
  ): void {
    this.#channel.publish(caret);
  }

  subscribe<TEvent extends keyof ScriptCollaborationEvents>(
    event: TEvent,
    listener: ScriptCollaborationEvents[TEvent]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  dispose(): void {
    this.#release();
    this.#roster.dispose();
    this.#channel.destroy();
    this.#events.removeAllListeners();
  }

  #emitCarets(): void {
    this.#events.emit("caretsChange", this.carets);
  }
}
