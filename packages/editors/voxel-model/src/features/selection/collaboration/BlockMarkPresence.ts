// Import Third-party Dependencies
import {
  PeerMarkTracker,
  type PeerMarkMap
} from "@jolly-pixel/ui/network";
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
  publish(presence: PresenceStore, marks: PeerMarkMap<string>): void;
}> = {
  select: {
    key: PRESENCE_KEYS.block,
    publish: (presence, marks) => {
      presence.blockSelections = marks;
    }
  },
  hover: {
    key: PRESENCE_KEYS.blockHover,
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
  #selection: BlockSelectionStore;
  #mark: BlockMark;
  #tracker: PeerMarkTracker<string>;

  #onMarkChange = (): void => {
    this.#tracker.publishLocal();
  };

  constructor(
    options: BlockMarkPresenceOptions
  ) {
    const { selection, presence, mark } = options;
    const channel = kMarkChannels[mark];
    this.#selection = selection;
    this.#mark = mark;

    this.#tracker = new PeerMarkTracker({
      room: options.room,
      presenceKey: channel.key,
      localKey: () => (mark === "select" ? selection.selected : selection.hovered),
      readKey: readBlockUuid,
      publish: (marks) => channel.publish(presence, marks)
    });
    this.#selection.on(mark, this.#onMarkChange);
  }

  dispose(): void {
    this.#selection.off(this.#mark, this.#onMarkChange);
    this.#tracker.dispose();
  }
}

function readBlockUuid(
  value: unknown
): string | null {
  return typeof value === "string" ? value : null;
}
