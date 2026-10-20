// Import Internal Dependencies
import {
  parsePeerSignalMessage,
  type OutgoingPeerSignal,
  type PeerSignalListener,
  type PeerSignaling
} from "./PeerSignaling.ts";

// CONSTANTS
const kChannelName = "jolly-peer-signaling";

export class BroadcastSignaling implements PeerSignaling {
  readonly id = crypto.randomUUID();

  readonly #channel = new BroadcastChannel(kChannelName);
  readonly #listeners = new Set<PeerSignalListener>();

  constructor() {
    this.#channel.addEventListener("message", (event) => {
      const message = parsePeerSignalMessage(event.data);
      if (message?.to !== this.id) {
        return;
      }
      for (const listener of [...this.#listeners]) {
        listener(message);
      }
    });
  }

  send(
    message: OutgoingPeerSignal
  ): void {
    this.#channel.postMessage({
      ...message,
      from: this.id
    });
  }

  subscribe(
    listener: PeerSignalListener
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  close(): void {
    this.#listeners.clear();
    this.#channel.close();
  }
}
