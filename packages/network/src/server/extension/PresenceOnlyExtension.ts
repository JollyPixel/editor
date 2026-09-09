// Import Internal Dependencies
import {
  Extension,
  type RoomContext
} from "./Extension.ts";
import {
  NO_MESSAGE_PROTOCOLS,
  OPAQUE_PROTOCOLS,
  type MessageProtocols
} from "../../protocol/MessageProtocol.ts";
import type {
  ClientHandle,
  PeerMetadata
} from "../../protocol/types.ts";

// CONSTANTS
const kDefaultExtensionName = "presence-only";

export interface PresenceOnlyExtensionOptions {
  broadcast: boolean;
  protocols?: MessageProtocols;
}

/**
 * Provides presence-only rooms with the required extension lifecycle.
 */
export class PresenceOnlyExtension extends Extension {
  readonly id: string;
  readonly name: string;
  readonly protocols: MessageProtocols;

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
    this.protocols = options?.protocols ??
      (this.#broadcast ? OPAQUE_PROTOCOLS : NO_MESSAGE_PROTOCOLS);
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
