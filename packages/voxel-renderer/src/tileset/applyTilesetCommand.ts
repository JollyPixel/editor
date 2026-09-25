// Import Internal Dependencies
import { rescaleTileRef } from "./tileRef.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";
import type { TilesetList } from "./TilesetList.ts";
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { ResolvedBlockDefinition } from "../blocks/BlockDefinition.ts";
import type { VoxelTilesetCommand } from "../commands/types.ts";

export interface TilesetDocument {
  readonly tilesets: TilesetList;
  readonly blocks: BlockRegistry;
}

/**
 * Applies the command and returns it as applied, or null when it changed
 * nothing.
 */
export function applyTilesetCommand(
  document: TilesetDocument,
  command: VoxelTilesetCommand
): VoxelTilesetCommand | null {
  const { tilesets } = document;

  let applied: boolean;
  switch (command.action) {
    case "tileset-added":
      applied = tilesets.add(command.tileset);
      break;
    case "tileset-removed":
      applied = tilesets.remove(command.tilesetId);
      break;
    case "tileset-resized":
      applied = resizeTileset(document, command.tilesetId, command.tileSize);
      break;
    case "default-tile-size-updated":
      applied = tilesets.updateDefaultTileSize(command.defaultTileSize);
      break;
    default: {
      const unhandled: never = command;
      throw new Error(
        `applyTilesetCommand: unhandled action '${(unhandled as VoxelTilesetCommand).action}'.`
      );
    }
  }

  return applied ? command : null;
}

function resizeTileset(
  document: TilesetDocument,
  tilesetId: string,
  tileSize: number
): boolean {
  const from = document.tilesets.get(tilesetId)?.tileSize;
  if (from === undefined || !document.tilesets.resize(tilesetId, tileSize)) {
    return false;
  }

  const rescale = {
    tilesetId,
    from,
    to: tileSize
  };
  const rescaled: ResolvedBlockDefinition[] = [];
  for (const block of document.blocks) {
    const next = BlockTextures.of(block)
      .map((ref) => rescaleTileRef(ref, rescale))
      .applyTo(block);
    if (next !== block) {
      rescaled.push(next);
    }
  }
  document.blocks.registerMany(rescaled);

  return true;
}
