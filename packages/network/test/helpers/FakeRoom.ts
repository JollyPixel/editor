// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  Peer,
  PeerMetadata,
  Right,
  Room,
  RoomEventMap,
  RoomRights
} from "#src/index.ts";

export class FakeRoom<
  TClientMessage = unknown,
  TServerMessage = unknown
>
  extends Emitter<RoomEventMap<TServerMessage>>
  implements Room<TClientMessage, TServerMessage> {
  readonly id = "fake-room";
  readonly peers = new Map<string, Peer>();
  readonly patches: PeerMetadata[] = [];
  readonly sent: TClientMessage[] = [];
  readonly role = "default";
  readonly rights: RoomRights = {};
  readonly access: Right = "write";

  clientId = "self";
  left = false;

  can(): Right {
    return "write";
  }

  join(): void {
    return void 0;
  }

  send(
    payload: TClientMessage
  ): void {
    this.sent.push(payload);
  }

  updatePresence(
    patch: PeerMetadata
  ): void {
    this.patches.push(patch);
  }

  leave(): void {
    this.left = true;
  }

  addPeer(
    clientId: string,
    presence: PeerMetadata = {}
  ): void {
    this.peers.set(clientId, {
      clientId,
      role: "default",
      profile: {},
      presence
    });
  }

  presence(
    clientId: string,
    patch: PeerMetadata
  ): void {
    Object.assign(this.peers.get(clientId)!.presence, patch);
    this.emit("peer-presence", {
      clientId,
      patch
    });
  }

  removePeer(
    clientId: string
  ): void {
    this.peers.delete(clientId);
    this.emit("peer-left", { clientId });
  }
}
