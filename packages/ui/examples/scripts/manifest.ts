// Import Internal Dependencies
import type { GalleryExample } from "./types.ts";
import { TOKENS_EXAMPLE } from "./examples/tokens.ts";
import { PEER_COLORS_EXAMPLE } from "./examples/peerColors.ts";

/** The nav and the e2e sweep both derive from this list, so adding a file adds an entry. */
export const manifest: readonly GalleryExample[] = [
  TOKENS_EXAMPLE,
  PEER_COLORS_EXAMPLE
];

export function findExample(
  id: string | null
): GalleryExample {
  return manifest.find((example) => example.id === id) ?? manifest[0];
}
