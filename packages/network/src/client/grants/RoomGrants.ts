// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  Room,
  RoomRejectionEvent
} from "../Room.ts";
import type {
  CapabilityTable,
  Grants
} from "./Grants.ts";

export type GrantsRoom = Pick<Room, "clientId" | "can" | "on" | "off">;

export type RoomGrantsEventMap<
  TEvent extends string,
  TCapability extends string
> = {
  change: (grants: Grants<TCapability>) => void;
  denied: (event: TEvent) => void;
};

export class RoomGrants<
  TEvent extends string,
  TCapability extends string
> extends Emitter<RoomGrantsEventMap<TEvent, TCapability>> {
  readonly #room: GrantsRoom;
  readonly #table: CapabilityTable<TEvent, TCapability>;
  #current: Grants<TCapability>;

  constructor(
    room: GrantsRoom,
    table: CapabilityTable<TEvent, TCapability>
  ) {
    super();
    this.#room = room;
    this.#table = table;
    this.#current = room.clientId === null ?
      table.full :
      table.grantsFor(room);
    room.on("sync", this.#refresh);
    room.on("denied", this.#onDenied);
  }

  get current(): Grants<TCapability> {
    return this.#current;
  }

  dispose(): void {
    this.#room.off("sync", this.#refresh);
    this.#room.off("denied", this.#onDenied);
  }

  readonly #refresh = (): void => {
    const next = this.#table.grantsFor(this.#room);
    if (!next.equals(this.#current)) {
      this.#current = next;
      this.emit("change", next);
    }
  };

  readonly #onDenied = (
    event: RoomRejectionEvent
  ): void => {
    if (this.#table.governs(event.event)) {
      this.emit("denied", event.event);
    }
  };
}
