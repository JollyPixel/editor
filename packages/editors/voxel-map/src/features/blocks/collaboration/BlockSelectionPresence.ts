// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";

// Import Internal Dependencies
import {
  editorState,
  type BrushStore,
  type ShellStore
} from "../../../app/state/index.ts";
import {
  peerColor,
  readUsername
} from "../../../collaboration/identity.ts";
import type { BlockPeerMark } from "../blockMarks.ts";

// CONSTANTS
const kPresenceBlockKey = "block";

export interface BlockSelectionPresenceOptions {
  room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  brush?: BrushStore;
  shell?: ShellStore;
}

export class BlockSelectionPresence {
  #room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
  #brush: BrushStore;
  #shell: ShellStore;
  #selections = new Map<string, number>();
  #unsubscribeBlock: () => void;

  #onSync = (): void => {
    this.#publishLocal();
    this.#resync();
  };

  #onPeerLeft = (
    event: network.RoomPeerEvent
  ): void => {
    if (this.#selections.delete(event.clientId)) {
      this.#publish();
    }
  };

  #onPeerPresence = (
    event: network.RoomPeerPresenceEvent
  ): void => {
    if (!(kPresenceBlockKey in event.patch)) {
      return;
    }

    this.#track(
      event.clientId,
      readBlockId(event.patch[kPresenceBlockKey])
    );
    this.#publish();
  };

  #onBlockChange = (): void => {
    this.#publishLocal();
  };

  constructor(
    options: BlockSelectionPresenceOptions
  ) {
    this.#room = options.room;
    this.#brush = options.brush ?? editorState.brush;
    this.#shell = options.shell ?? editorState.shell;

    this.#room.on("sync", this.#onSync);
    this.#room.on("peer-left", this.#onPeerLeft);
    this.#room.on("peer-presence", this.#onPeerPresence);
    this.#unsubscribeBlock = this.#brush.watch(
      "blockChange",
      this.#onBlockChange
    );

    this.#publishLocal();
    this.#resync();
  }

  dispose(): void {
    this.#unsubscribeBlock();
    this.#room.off("sync", this.#onSync);
    this.#room.off("peer-left", this.#onPeerLeft);
    this.#room.off("peer-presence", this.#onPeerPresence);

    this.#selections.clear();
    this.#shell.blockSelections = new Map();
  }

  #publishLocal(): void {
    this.#room.updatePresence({
      [kPresenceBlockKey]: this.#brush.blockId
    });
  }

  #resync(): void {
    this.#selections.clear();
    for (const [clientId, peer] of this.#room.peers) {
      this.#track(
        clientId,
        readBlockId(peer.presence[kPresenceBlockKey])
      );
    }

    this.#publish();
  }

  #track(
    clientId: string,
    blockId: number | null
  ): void {
    if (blockId === null) {
      this.#selections.delete(clientId);

      return;
    }

    this.#selections.set(clientId, blockId);
  }

  #publish(): void {
    const marks = new Map<number, BlockPeerMark[]>();
    const entries = [...this.#selections]
      .sort(([left], [right]) => left.localeCompare(right));

    for (const [clientId, blockId] of entries) {
      const peer = this.#room.peers.get(clientId);
      if (!peer) {
        continue;
      }

      const bucket = marks.get(blockId) ?? [];
      bucket.push({
        clientId,
        displayName: readUsername(peer.profile),
        color: peerColor(clientId, peer.profile)
      });
      marks.set(blockId, bucket);
    }

    this.#shell.blockSelections = marks;
  }
}

function readBlockId(
  value: unknown
): number | null {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : null;
}
