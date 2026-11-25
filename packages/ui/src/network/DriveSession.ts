// Import Third-party Dependencies
import {
  RoomClaim,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PresencePeer } from "../peer/PresencePeer.ts";
import { PeerRoster } from "./PeerRoster.ts";

// CONSTANTS
const kDefaultKey = "drive";
const kDrivingBadge = "driving";

export type DriveStance =
  | {
    readonly kind: "alone";
  }
  | {
    readonly kind: "open";
  }
  | {
    readonly kind: "driving";
  }
  | {
    readonly kind: "following";
    readonly driver: PresencePeer;
    readonly joined: boolean;
  };

export interface DriveSessionOptions {
  room: Room;
  key?: string;
  publish: (
    peers: readonly PresencePeer[]
  ) => void;
  onJoinChange: (
    driverId: string | null
  ) => void;
  onDriverChange?: () => void;
}

export class DriveSession {
  #claim: RoomClaim;
  #roster: PeerRoster;
  #publish: DriveSessionOptions["publish"];
  #onJoinChange: DriveSessionOptions["onJoinChange"];
  #onDriverChange: DriveSessionOptions["onDriverChange"];
  #rosterPeers: readonly PresencePeer[] = [];
  #peers: readonly PresencePeer[] = [];
  #joinedId: string | null = null;

  #onClaim = (): void => {
    this.leave();
    this.#onDriverChange?.();
    this.#refreshPeers();
  };

  constructor(
    options: DriveSessionOptions
  ) {
    const { room, key = kDefaultKey } = options;
    this.#publish = options.publish;
    this.#onJoinChange = options.onJoinChange;
    this.#onDriverChange = options.onDriverChange;
    this.#claim = new RoomClaim(room, {
      key
    });
    this.#claim.on("change", this.#onClaim);
    this.#roster = new PeerRoster({
      room,
      publish: (peers) => {
        this.#rosterPeers = peers;
        this.#refreshPeers();
      }
    });
  }

  get peers(): readonly PresencePeer[] {
    return this.#peers;
  }

  get driverId(): string | null {
    return this.#claim.holderId;
  }

  get driving(): boolean {
    return this.#claim.heldBySelf;
  }

  get joinedId(): string | null {
    return this.#joinedId;
  }

  get stance(): DriveStance {
    if (this.#peers.every((peer) => peer.self === true)) {
      return {
        kind: "alone"
      };
    }
    if (this.#claim.heldBySelf) {
      return {
        kind: "driving"
      };
    }

    const driver = this.#peers.find(
      (peer) => this.#claim.heldBy(peer.clientId)
    );

    return driver === undefined ?
      {
        kind: "open"
      } :
      {
        kind: "following",
        driver,
        joined: this.#joinedId !== null
      };
  }

  drive(): void {
    this.#claim.claim();
  }

  release(): void {
    this.#claim.release();
  }

  join(): void {
    const { stance } = this;
    if (stance.kind === "following") {
      this.#joinedId = stance.driver.clientId;
      this.#onJoinChange(this.#joinedId);
    }
  }

  leave(): void {
    if (this.#joinedId !== null) {
      this.#joinedId = null;
      this.#onJoinChange(null);
    }
  }

  dispose(): void {
    this.#claim.off("change", this.#onClaim);
    this.#claim.destroy();
    this.#roster.dispose();
  }

  #refreshPeers(): void {
    this.#peers = this.#rosterPeers.map(
      (peer) => (this.#claim.heldBy(peer.clientId) ? withDrivingBadge(peer) : peer)
    );
    this.#publish(this.#peers);
  }
}

function withDrivingBadge(
  peer: PresencePeer
): PresencePeer {
  return {
    ...peer,
    badge: peer.badge === undefined ?
      kDrivingBadge :
      `${peer.badge}, ${kDrivingBadge}`
  };
}
