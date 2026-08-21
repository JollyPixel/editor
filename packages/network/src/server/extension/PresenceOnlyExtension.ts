// Import Internal Dependencies
import {
  Extension,
  type RoomContext
} from "./Extension.ts";
import type {
  ClientHandle,
  PeerMetadata
} from "../../protocol/types.ts";

// CONSTANTS
const kDefaultExtensionName = "presence-only";

export interface PresenceOnlyExtensionOptions {
  broadcast: boolean;
}

/**
 * Provides presence-only rooms with the required extension lifecycle.
 */
export class PresenceOnlyExtension extends Extension {
  readonly id: string;
  readonly name: string;

  #broadcast: boolean;

  constructor(
    id: string,
    name: string = kDefaultExtensionName,
    options?: PresenceOnlyExtensionOptions
  ) {
    super();
    this.id = id;
    this.name = name;
    this.#broadcast = options?.broadcast ?? false;
  }

  onClientConnect(
    _client: ClientHandle,
    _identity: PeerMetadata,
    _context: RoomContext
  ): void {
    // Do nothing
  }

  onClientDisconnect(
    _clientId: string,
    _context: RoomContext
  ): void {
    // Do nothing
  }

  onMessage(
    _clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    if (this.#broadcast) {
      context.room.broadcast(payload);
    }
  }
}
