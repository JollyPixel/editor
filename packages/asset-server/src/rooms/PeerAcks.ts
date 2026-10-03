// Import Third-party Dependencies
import type { NetworkAcks } from "@jolly-pixel/network";

// CONSTANTS
const kMaxDeparted = 256;

export interface AcksField {
  acks?: NetworkAcks;
}

export class PeerAcks {
  #processed = new Map<string, number>();
  #departed = new Map<string, number>();

  record(
    clientId: string,
    seq: number | undefined
  ): void {
    if (seq !== undefined) {
      this.#processed.set(clientId, seq);
    }
  }

  depart(
    clientId: string
  ): void {
    const seq = this.#processed.get(clientId);
    if (seq === undefined) {
      return;
    }

    this.#processed.delete(clientId);
    this.#departed.set(clientId, seq);
    if (this.#departed.size > kMaxDeparted) {
      const [oldest] = this.#departed.keys();
      this.#departed.delete(oldest);
    }
  }

  resumedBy(
    clientId: string
  ): AcksField {
    const seq = this.#processed.get(clientId) ??
      this.#departed.get(clientId);

    return seq === undefined ?
      {} :
      { acks: { [clientId]: seq } };
  }

  of(
    clientIds: Iterable<string>
  ): AcksField {
    const acks: NetworkAcks = {};
    for (const clientId of clientIds) {
      const seq = this.#processed.get(clientId);
      if (seq !== undefined) {
        acks[clientId] = seq;
      }
    }

    return Object.keys(acks).length === 0 ? {} : { acks };
  }

  ofEveryone(): AcksField {
    return this.of(this.#processed.keys());
  }
}
