// Import Internal Dependencies
import { GamePlayerError } from "./errors/GamePlayerError.ts";
import { PLAY_PAGE_PATH } from "../../editors/EditorDescriptor.ts";
import { GAME_MANIFEST_META } from "../../game/GameManifest.ts";

// CONSTANTS
const kParentReference = /\b(src|href)="\.\.\//g;
const kHeadEnd = "</head>";
const kGameMeta = `<meta name="${GAME_MANIFEST_META}" content="exported">`;

export interface GamePlayer {
  files(): Promise<Map<string, Uint8Array>>;
}

export function exportedPlayerPage(
  page: string
): string {
  if (page.search(kParentReference) === -1 || !page.includes(kHeadEnd)) {
    throw new GamePlayerError(
      `the built ${PLAY_PAGE_PATH} loads nothing from ../ or has no ${kHeadEnd}`
    );
  }

  return page
    .replace(kParentReference, "$1=\"./")
    .replace(kHeadEnd, `  ${kGameMeta}\n${kHeadEnd}`);
}
