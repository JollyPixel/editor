// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const PEER_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "peer/presence",
    title: "Presence",
    load: async() => (await import("./presence.ts")).PRESENCE_EXAMPLE
  },
  {
    id: "peer/presence-stack",
    title: "Presence stack",
    load: async() => (await import("./presenceStack.ts")).PRESENCE_STACK_EXAMPLE
  }
];
