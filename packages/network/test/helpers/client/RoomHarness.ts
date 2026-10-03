// Import Internal Dependencies
import { ClientRoom } from "#src/client/ClientRoom.ts";
import type {
  ClientEnvelope,
  PeerMetadata,
  RoomOptions
} from "#src/index.ts";

export class RoomHarness<
  TClientMessage = unknown,
  TServerMessage = unknown
> {
  readonly room: ClientRoom<TClientMessage, TServerMessage>;
  readonly sent: ClientEnvelope[] = [];

  constructor(
    options: RoomOptions<TServerMessage> = {}
  ) {
    this.room = new ClientRoom<TClientMessage, TServerMessage>({
      id: "room",
      profile: {},
      parser: options.parser,
      send: (envelope) => this.sent.push(envelope),
      onLeave: () => undefined
    });
  }

  get messages(): unknown[] {
    return this.sent.flatMap(
      (envelope) => (envelope.kind === "message" ? [envelope.payload] : [])
    );
  }

  get patches(): PeerMetadata[] {
    return this.sent.flatMap(
      (envelope) => (envelope.kind === "presence" ? [envelope.patch] : [])
    );
  }

  admit(
    self = "self",
    peers: Record<string, PeerMetadata> = {}
  ): void {
    this.room.receive({
      room: this.room.id,
      kind: "sync",
      self,
      rights: {},
      members: [
        self,
        ...Object.keys(peers)
      ].map((clientId) => {
        return {
          clientId,
          role: "default",
          profile: {},
          presence: peers[clientId] ?? {}
        };
      })
    });
  }

  peerJoined(
    clientId: string,
    presence: PeerMetadata = {}
  ): void {
    this.room.receive({
      room: this.room.id,
      kind: "peer-joined",
      clientId,
      role: "default",
      profile: {},
      presence
    });
  }

  peerLeft(
    clientId: string
  ): void {
    this.room.receive({
      room: this.room.id,
      kind: "peer-left",
      clientId
    });
  }

  peerPresence(
    clientId: string,
    patch: PeerMetadata
  ): void {
    this.room.receive({
      room: this.room.id,
      kind: "peer-presence",
      clientId,
      patch
    });
  }

  serverMessage(
    payload: TServerMessage
  ): void {
    this.room.receive({
      room: this.room.id,
      kind: "message",
      payload
    });
  }
}
