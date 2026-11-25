// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type {
  Right,
  RoomRejectionEvent,
  RoomRights
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  CatalogCommand,
  CatalogMessage,
  CatalogRoom
} from "#src/client/index.ts";

type FakeCatalogRoomEvents = {
  message: (message: CatalogMessage) => void;
  rights: () => void;
  denied: (denial: RoomRejectionEvent) => void;
};

export class FakeCatalogRoom extends Emitter<FakeCatalogRoomEvents>
  implements CatalogRoom {
  readonly sent: CatalogCommand[] = [];
  joined = false;
  left = false;
  #rights: RoomRights | null = null;

  can(
    event: string
  ): Right {
    if (this.#rights === null) {
      return "write";
    }

    return this.#rights[event] ?? "void";
  }

  join(): void {
    this.joined = true;
  }

  leave(): void {
    this.left = true;
  }

  send(
    command: CatalogCommand
  ): void {
    this.sent.push(command);
  }

  receive(
    message: CatalogMessage
  ): void {
    this.emit("message", message);
  }

  admit(
    rights: RoomRights
  ): void {
    this.#rights = rights;
    this.emit("rights");
  }

  deny(
    event: string,
    requestId: string
  ): void {
    this.emit("denied", {
      event,
      reason: `role "viewer" cannot write "${event}"`,
      requestId
    });
  }

  requestId(
    index: number
  ): string {
    return this.sent[index].requestId;
  }
}
