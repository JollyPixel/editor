// Import Internal Dependencies
import { ServerRoom } from "./server/ServerRoom.ts";
import { Envelope } from "./Envelope.ts";
import { createDefaultLogger } from "./server/logger.ts";
import type { RoomAuthority } from "./server/RoomAuthority.ts";
import type {
  ClientHandle,
  Logger
} from "./types.ts";

interface ClientRecord {
  handle: ClientHandle;
  rooms: Set<string>;
}

export interface ServerOptions {
  logger?: Logger;
}

/**
 * Transport-agnostic multiplexer sitting between raw connections and
 * registered RoomAuthority instances.
 */
export class Server {
  readonly logger: Logger;

  #rooms = new Map<string, ServerRoom>();
  #clients = new Map<string, ClientRecord>();

  constructor(
    options: ServerOptions = {}
  ) {
    this.logger = options.logger ?? createDefaultLogger();
  }

  register(
    authority: RoomAuthority
  ): void {
    const room = new ServerRoom(authority, this.logger);
    this.#rooms.set(authority.id, room);
    this.logger.info({ room: authority.id }, "room registered");
  }

  broadcast(
    roomId: string,
    payload: unknown
  ): void {
    this.#rooms.get(roomId)?.broadcast(payload);
  }

  handleConnect(
    client: ClientHandle
  ): void {
    this.#clients.set(client.id, {
      handle: client,
      rooms: new Set()
    });
    this.logger.debug({ clientId: client.id }, "client connected");
  }

  handleDisconnect(
    clientId: string
  ): void {
    const record = this.#clients.get(clientId);
    if (record) {
      for (const roomName of record.rooms) {
        this.#rooms.get(roomName)?.leave(clientId);
      }
    }

    this.#clients.delete(clientId);
    this.logger.debug({ clientId }, "client disconnected");
  }

  handleMessage(
    clientId: string,
    raw: unknown
  ): void {
    const result = Envelope.parse(raw);
    if (!result.success) {
      this.logger.warn({ clientId, error: result.error }, "dropped malformed envelope");

      return;
    }
    const envelope = result.data;

    const record = this.#clients.get(clientId);
    if (!record) {
      this.logger.warn({ clientId, room: envelope.room }, "dropped envelope from unknown client");

      return;
    }

    const room = this.#rooms.get(envelope.room);
    if (!room) {
      this.logger.warn({ clientId, room: envelope.room }, "dropped envelope for unregistered room");

      return;
    }

    switch (envelope.kind) {
      case "join":
        if (!record.rooms.has(envelope.room)) {
          record.rooms.add(envelope.room);
          room.join(
            clientId,
            record.handle,
            envelope.identity ?? Object.create(null)
          );
        }
        break;
      case "leave":
        if (record.rooms.delete(envelope.room)) {
          room.leave(clientId);
        }
        break;
      case "message":
        if (this.#hasJoined(clientId, envelope.room)) {
          room.message(
            clientId,
            envelope.payload
          );
        }
        else {
          this.logger.warn({ clientId, room: envelope.room }, "dropped message: client has not joined room");
        }
        break;
      case "presence":
        if (this.#hasJoined(clientId, envelope.room)) {
          room.updatePresence(
            clientId,
            envelope.patch ?? Object.create(null)
          );
        }
        else {
          this.logger.warn({ clientId, room: envelope.room }, "dropped presence: client has not joined room");
        }
        break;
    }
  }

  #hasJoined(
    clientId: string,
    room: string
  ): boolean {
    return this.#clients.get(clientId)?.rooms.has(
      room
    ) ?? false;
  }
}
