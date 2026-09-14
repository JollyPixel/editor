// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand,
  PixelServerMessage
} from "#src/network/types.ts";
import { MockEmitter } from "./emitter.ts";

// CONSTANTS
const kEmptySnapshot: PixelBufferSnapshot = {
  size: { x: 1, y: 1 },
  pixels: "",
  uvRegions: []
};

export interface MockRoomOptions {
  clientId?: string;
  onSend?: (command: PixelNetworkCommand) => void;
}

export interface MockPeer {
  profile?: network.PeerMetadata;
  presence?: network.PeerMetadata;
}

export class MockRoom
  extends MockEmitter<network.RoomEventMap<PixelServerMessage>>
  implements network.Room<PixelNetworkCommand, PixelServerMessage> {
  readonly id = "test-room";
  readonly clientId: string;
  readonly peers = new Map<string, network.Peer>();
  readonly role = "default";
  readonly rights = {};
  readonly access = "write";
  readonly sent: PixelNetworkCommand[] = [];
  readonly presenceUpdates: network.PeerMetadata[] = [];

  #onSend: ((command: PixelNetworkCommand) => void) | undefined;

  constructor(
    options: MockRoomOptions = {}
  ) {
    super();
    this.clientId = options.clientId ?? "local-A";
    this.#onSend = options.onSend;
  }

  can(): network.Right {
    return "write";
  }

  join(): void {
    return void 0;
  }

  leave(): void {
    return void 0;
  }

  send(
    command: PixelNetworkCommand
  ): void {
    this.sent.push(command);
    this.#onSend?.(command);
  }

  updatePresence(
    patch: network.PeerMetadata
  ): void {
    this.presenceUpdates.push(patch);
  }

  addPeer(
    clientId: string,
    peer: MockPeer = {}
  ): void {
    this.peers.set(clientId, {
      clientId,
      role: "default",
      profile: peer.profile ?? {},
      presence: peer.presence ?? {}
    });
  }

  deliverCommand(
    command: PixelNetworkCommand
  ): void {
    this.emit("message", {
      type: "command",
      data: command
    });
  }

  deliverSnapshot(
    snapshot: PixelBufferSnapshot = kEmptySnapshot
  ): void {
    this.emit("message", {
      type: "snapshot",
      data: snapshot
    });
  }
}
