// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { RoomMembers } from "./RoomMembers.ts";
import type {
  RoomAppendInput,
  RoomBroadcast,
  RoomContext
} from "../extension/Extension.ts";

export interface RoomContextFactoryOptions {
  roomId: string;
  members: RoomMembers;
  broadcast: RoomBroadcast;
  eventStore?: EventStore.EventStore;
}

/**
 * Builds the `RoomContext` handed to an extension, binding event-store
 * writes to the member identity behind `clientId`.
 */
export class RoomContextFactory {
  #roomId: string;
  #members: RoomMembers;
  #broadcast: RoomBroadcast;
  #eventStore: EventStore.EventStore;

  constructor(
    options: RoomContextFactoryOptions
  ) {
    this.#roomId = options.roomId;
    this.#members = options.members;
    this.#broadcast = options.broadcast;
    this.#eventStore = options.eventStore ?? EventStore.persistence.memory();
  }

  /**
   * Uses stable `userId` when present, otherwise `clientId`.
   */
  resolveActor(
    clientId: string
  ): EventStore.Actor {
    const identity = this.#members.get(clientId)?.identity;
    const userId = typeof identity?.userId === "string" ?
      identity.userId :
      clientId;

    return {
      type: "user",
      id: userId
    };
  }

  /**
   * Pass `actor` explicitly when the member record is already gone.
   */
  create(
    clientId: string,
    actor: EventStore.Actor = this.resolveActor(clientId)
  ): RoomContext {
    return {
      room: this.#broadcast,
      eventStore: {
        append: (input) => this.#append(clientId, input, actor),
        list: (assetId, fromVersion) => Promise.resolve(
          this.#eventStore.reader.list(
            assetId,
            fromVersion
          )
        )
      }
    };
  }

  /**
   * Reports a rejected append back to its author as an "error" envelope.
   */
  async #append(
    clientId: string,
    input: RoomAppendInput,
    actor: EventStore.Actor
  ): Promise<boolean> {
    const result = this.#eventStore.writer.append({
      ...input,
      actor
    });
    if (!result.ok) {
      this.#members.get(clientId)?.handle.send({
        room: this.#roomId,
        kind: "error",
        event: input.eventType,
        reason: result.val.message
      });
    }

    return result.ok;
  }
}
