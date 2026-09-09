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

// CONSTANTS
const kDefaultExtensionName = "presence-only";

export interface PresenceOnlyExtensionOptions {
  broadcast: boolean;
  protocols?: MessageProtocols;
}

/**
 * Provides presence-only rooms, optionally relaying opaque payloads.
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
    this.protocols = options?.protocols ?? (
      this.#broadcast ? OPAQUE_PROTOCOLS : NO_MESSAGE_PROTOCOLS
    );
  }

  override onMessage(
    _clientId: string,
    payload: unknown,
    context: RoomContext
  ): void {
    this.#broadcast && context.room.broadcast(payload);
  }
}
