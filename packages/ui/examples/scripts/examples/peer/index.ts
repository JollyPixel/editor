// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const PEER_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "peer/presence",
    title: "Presence",
    load: async() => (await import("./presence.ts")).PRESENCE_EXAMPLE
  }
];
