// Import Third-party Dependencies
import {
  strFromU8,
  strToU8,
  unzipSync,
  zipSync
} from "fflate";

// Import Internal Dependencies
import type { PlayerBundle } from "./GamePlayer.ts";
import { GamePlayerError } from "./errors/GamePlayerError.ts";
import {
  PLAY_PAGE_DIR,
  PLAY_PAGE_PATH
} from "../editors/EditorDescriptor.ts";

// CONSTANTS
export const PLAYER_ARCHIVE_PATH = `${PLAY_PAGE_DIR}/player.zip`;

export function zipPlayer(
  bundle: PlayerBundle
): Uint8Array {
  return zipSync({
    ...Object.fromEntries(bundle.files),
    [PLAY_PAGE_PATH]: strToU8(bundle.page)
  });
}

export function unzipPlayer(
  bytes: Uint8Array
): PlayerBundle {
  const { [PLAY_PAGE_PATH]: page, ...files } = unzipSync(bytes);
  if (page === undefined) {
    throw new GamePlayerError(`the player archive has no ${PLAY_PAGE_PATH}`);
  }

  return {
    page: strFromU8(page),
    files: new Map(Object.entries(files))
  };
}
