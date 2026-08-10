// Import Internal Dependencies
import {
  Extension,
  type RoomContext
} from "./Extension.ts";
import type {
  ClientHandle,
  PeerMetadata
} from "../types.ts";

// CONSTANTS
const kDefaultExtensionName = "presence-only";

/**
 * A room needs a registered Extension to exist at all, even when nothing
 * ever rides its message channel
 */
export class PresenceOnlyExtension extends Extension {
  readonly id: string;
  readonly name: string;

  constructor(
    id: string,
    name: string = kDefaultExtensionName
  ) {
    super();
    this.id = id;
    this.name = name;
  }

  onClientConnect(
    _client: ClientHandle,
    _identity: PeerMetadata,
    _context: RoomContext
  ): void {
    // No domain state to initialize — presence alone carries the pose.
  }

  onClientDisconnect(
    _clientId: string,
    _context: RoomContext
  ): void {
    // No domain state to tear down.
  }

  onMessage(
    _clientId: string,
    _payload: unknown,
    _context: RoomContext
  ): void {
    // Never called: a presence-only room never sends a "message" envelope.
  }
}
