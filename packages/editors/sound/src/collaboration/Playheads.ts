// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

export interface PlayheadTag {
  readonly key: string;
  readonly name: string;
  readonly color: string | null;
}

export interface PeerPlayhead {
  readonly clientId: string;
  readonly color: string | null;
  readonly position: number;
  readonly tags: readonly PlayheadTag[];
}

export interface PlacedPeer {
  readonly peer: PresencePeer;
  readonly position: number;
  readonly listening: boolean;
}

export class Playheads {
  static #tag(
    peer: PresencePeer
  ): PlayheadTag {
    return {
      key: peer.clientId,
      name: peer.displayName,
      color: peer.color
    };
  }

  static #selfLast(
    left: PlacedPeer,
    right: PlacedPeer
  ): number {
    return Number(left.peer.self === true) - Number(right.peer.self === true);
  }

  #placed: readonly PlacedPeer[];
  #driverId: string | null;

  constructor(
    placed: readonly PlacedPeer[],
    driverId: string | null
  ) {
    this.#placed = placed;
    this.#driverId = driverId;
  }

  named(): PeerPlayhead[] {
    const riders = this.#riders();

    return this.#placed
      .filter((placed) => !riders.includes(placed))
      .sort(Playheads.#selfLast)
      .map(({ peer, position }) => {
        const carried = peer.clientId === this.#driverId ?
          riders.map((rider) => rider.peer) :
          [];

        return {
          clientId: peer.clientId,
          color: peer.color,
          position,
          tags: [peer, ...carried].map(Playheads.#tag)
        };
      });
  }

  anonymous(): PeerPlayhead[] {
    return this.#placed.map(({ peer, position }) => {
      return {
        clientId: peer.clientId,
        color: null,
        position,
        tags: []
      };
    });
  }

  #riders(): PlacedPeer[] {
    const driverId = this.#driverId;
    const driverPlaced = this.#placed.some(
      ({ peer }) => peer.clientId === driverId
    );

    return driverPlaced ?
      this.#placed.filter(
        ({ peer, listening }) => listening && peer.clientId !== driverId
      ) :
      [];
  }
}
