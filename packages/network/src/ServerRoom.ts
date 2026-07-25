// Import Internal Dependencies
import { createDefaultLogger } from "./logger.ts";
import type { RoomAuthority } from "./RoomAuthority.ts";
import type { Envelope } from "./Envelope.ts";
import type {
  ClientHandle,
  Logger,
  PeerMetadata
} from "./types.ts";

interface PeerRecord {
  handle: ClientHandle;
  identity: PeerMetadata;
  presence: PeerMetadata;
}

export class ServerRoom {
  readonly id: string;

  #authority: RoomAuthority;
  #members = new Map<string, PeerRecord>();
  #logger: Logger;

  constructor(
    authority: RoomAuthority,
    logger: Logger = createDefaultLogger()
  ) {
    this.id = authority.id;
    this.#authority = authority;
    this.#logger = logger;
  }

  join(
    clientId: string,
    client: ClientHandle,
    identity: PeerMetadata
  ): void {
    this.#send({
      room: this.id,
      kind: "peer-joined",
      clientId,
      identity
    }, clientId);

    if (this.#members.size > 0) {
      const members = [...this.#members].map(([memberId, record]) => {
        return {
          clientId: memberId,
          identity: record.identity,
          presence: record.presence
        };
      });

      client.send({
        room: this.id,
        kind: "sync",
        members
      });
    }

    this.#members.set(clientId, {
      handle: client,
      identity,
      presence: {}
    });

    this.#authority.onClientConnect(
      {
        id: client.id,
        send: (data) => client.send({
          room: this.id,
          kind: "message",
          payload: data
        })
      },
      identity,
      this
    );
    this.#logger.debug({ room: this.id, clientId }, "client joined room");
  }

  leave(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    this.#send({
      room: this.id,
      kind: "peer-left",
      clientId
    }, clientId);
    this.#authority.onClientDisconnect(clientId, this);
    this.#logger.debug({ room: this.id, clientId }, "client left room");
  }

  updatePresence(
    clientId: string,
    patch: PeerMetadata
  ): void {
    const record = this.#members.get(clientId);
    if (!record) {
      this.#logger.debug({ room: this.id, clientId }, "presence update ignored: client is not a member");

      return;
    }

    Object.assign(record.presence, patch);
    this.#send({
      room: this.id,
      kind: "peer-presence",
      clientId,
      patch
    }, clientId);
  }

  message(
    clientId: string,
    payload: unknown
  ): void {
    this.#authority.onMessage(clientId, payload, this);
  }

  broadcast(
    payload: unknown
  ): void {
    this.#send({
      room: this.id,
      kind: "message",
      payload
    });
  }

  #send(
    envelope: Envelope,
    excludeClientId?: string
  ): void {
    for (const [memberId, record] of this.#members) {
      if (memberId === excludeClientId) {
        continue;
      }

      record.handle.send(envelope);
    }
  }
}
