// Import Third-party Dependencies
import {
  PresenceChannel,
  type Room
} from "@jolly-pixel/network/client";
import { Emitter } from "@openally/emitt";
import * as z from "zod/mini";

// Import Internal Dependencies
import { Claim } from "./Claim.ts";

// CONSTANTS
const kDriveKey = "drive";
const kClaimSince = z.nullable(z.number());

export type DriveClaimEvents = {
  change: () => void;
};

export class DriveClaim {
  #room: Room;
  #channel: PresenceChannel<number | null>;
  #events = new Emitter<DriveClaimEvents>();
  #driverId: string | null = null;

  #onChange = (): void => {
    this.#elect();
  };

  constructor(
    room: Room
  ) {
    this.#room = room;
    this.#channel = new PresenceChannel<number | null>(room, {
      key: kDriveKey,
      decode: kClaimSince
    });
    this.#channel.on("change", this.#onChange);
    this.#elect();
  }

  get driverId(): string | null {
    return this.#driverId;
  }

  get driving(): boolean {
    return this.#room.clientId !== null && this.heldBy(this.#room.clientId);
  }

  heldBy(
    clientId: string
  ): boolean {
    return this.#driverId === clientId;
  }

  subscribe(
    listener: () => void
  ): () => void {
    return this.#events.subscribe("change", listener);
  }

  claim(): void {
    if (this.#driverId === null && this.#room.clientId !== null) {
      this.#channel.publish(Date.now());
      this.#elect();
    }
  }

  release(): void {
    if (this.#channel.publish(null)) {
      this.#elect();
    }
  }

  dispose(): void {
    this.#channel.publish(null);
    this.#channel.off("change", this.#onChange);
    this.#channel.destroy();
    this.#events.removeAllListeners();
  }

  #elect(): void {
    const selfId = this.#room.clientId;
    const own = this.#channel.published ?? null;
    const claims = new Map(this.#channel.values);
    if (own !== null && selfId !== null) {
      claims.set(selfId, own);
    }

    const driverId = Claim.earliest(
      [...claims].flatMap(([clientId, since]) => (
        since === null ? [] : [new Claim(clientId, since)]
      ))
    )?.clientId ?? null;
    if (own !== null && driverId !== selfId) {
      this.#channel.publish(null);
    }
    if (driverId !== this.#driverId) {
      this.#driverId = driverId;
      this.#events.emit("change");
    }
  }
}
