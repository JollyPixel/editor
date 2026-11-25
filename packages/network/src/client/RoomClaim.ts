// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import * as z from "zod/mini";

// Import Internal Dependencies
import { PresenceChannel } from "./PresenceChannel.ts";
import type { Room } from "./Room.ts";

// CONSTANTS
const kClaimSince = z.nullable(z.number());

export interface RoomClaimOptions {
  key: string;
}

export type RoomClaimEventMap = {
  change: () => void;
};

interface Claim {
  clientId: string;
  since: number;
}

export class RoomClaim extends Emitter<RoomClaimEventMap> {
  #room: Room;
  #channel: PresenceChannel<number | null>;
  #holderId: string | null = null;

  #onChange = (): void => {
    this.#elect();
  };

  constructor(
    room: Room,
    options: RoomClaimOptions
  ) {
    super();
    this.#room = room;
    this.#channel = new PresenceChannel<number | null>(room, {
      key: options.key,
      decode: kClaimSince
    });
    this.#channel.on("change", this.#onChange);
    this.#elect();
  }

  get holderId(): string | null {
    return this.#holderId;
  }

  get heldBySelf(): boolean {
    return this.#room.clientId !== null && this.heldBy(this.#room.clientId);
  }

  heldBy(
    clientId: string
  ): boolean {
    return this.#holderId === clientId;
  }

  claim(): void {
    if (this.#holderId === null && this.#room.clientId !== null) {
      this.#channel.publish(Date.now());
      this.#elect();
    }
  }

  release(): void {
    if (this.#channel.publish(null)) {
      this.#elect();
    }
  }

  destroy(): void {
    this.#channel.publish(null);
    this.#channel.off("change", this.#onChange);
    this.#channel.destroy();
    this.removeAllListeners();
  }

  #elect(): void {
    const selfId = this.#room.clientId;
    const own = this.#channel.published ?? null;
    const claims = new Map(this.#channel.values);
    if (own !== null && selfId !== null) {
      claims.set(selfId, own);
    }

    let earliest: Claim | null = null;
    for (const [clientId, since] of claims) {
      if (since === null) {
        continue;
      }

      const claim = {
        clientId,
        since
      };
      if (earliest === null || precedes(claim, earliest)) {
        earliest = claim;
      }
    }

    const holderId = earliest?.clientId ?? null;
    if (own !== null && holderId !== selfId) {
      this.#channel.publish(null);
    }
    if (holderId !== this.#holderId) {
      this.#holderId = holderId;
      this.emit("change");
    }
  }
}

function precedes(
  claim: Claim,
  other: Claim
): boolean {
  return claim.since === other.since ?
    claim.clientId < other.clientId :
    claim.since < other.since;
}
