// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const FOUNDATION_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "foundation/tokens",
    title: "Semantic tokens",
    load: async() => (await import("./tokens.ts")).TOKENS_EXAMPLE
  },
  {
    id: "foundation/peer-colors",
    title: "Peer colours",
    load: async() => (await import("./peerColors.ts")).PEER_COLORS_EXAMPLE
  },
  {
    id: "foundation/icon-tones",
    title: "Icon tones",
    load: async() => (await import("./iconTones.ts")).ICON_TONES_EXAMPLE
  }
];
