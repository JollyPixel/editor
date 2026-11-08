// Import Third-party Dependencies
import type { PeerMarks } from "@jolly-pixel/ui";
import { PeerMarkTracker } from "@jolly-pixel/ui/network";
import { decodeString } from "@jolly-pixel/network/client";
import type { VoxelModelRoom } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  BlockMark,
  BlockSelectionStore,
  PresenceStore
} from "../../../state/index.ts";
import { PRESENCE_KEYS } from "../../../collaboration/presenceKeys.ts";

// CONSTANTS
const kMarkChannels: Record<BlockMark, {
  key: string;
  read(selection: BlockSelectionStore): string | null;
  publish(presence: PresenceStore, marks: PeerMarks<string>): void;
}> = {
  select: {
    key: PRESENCE_KEYS.block,
    read: (selection) => selection.selected,
    publish: (presence, marks) => {
      presence.blockSelections = marks;
    }
  },
  hover: {
    key: PRESENCE_KEYS.blockHover,
    read: (selection) => selection.hovered,
    publish: (presence, marks) => {
      presence.blockHovers = marks;
    }
  }
};

export interface BlockMarkPresenceOptions {
  room: VoxelModelRoom;
  selection: BlockSelectionStore;
  presence: PresenceStore;
  mark: BlockMark;
}

export class BlockMarkPresence {
  #tracker: PeerMarkTracker<string>;

  constructor(
    options: BlockMarkPresenceOptions
  ) {
    const { selection, presence, mark } = options;
    const channel = kMarkChannels[mark];

    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: channel.key,
      decode: decodeString,
      local: {
        read: () => channel.read(selection),
        subscribe: (listener) => selection.subscribe(mark, listener)
      },
      publish: (marks) => channel.publish(presence, marks)
    });
  }

  dispose(): void {
    this.#tracker.dispose();
  }
}
