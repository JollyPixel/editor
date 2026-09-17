// Import Internal Dependencies
import { rescaleTileRef } from "./tileset/tileRef.ts";
import { BlockTextures } from "./blocks/BlockTextures.ts";
import type { TilesetList } from "./tileset/TilesetList.ts";
import type { BlockRegistry } from "./blocks/BlockRegistry.ts";
import type { ResolvedBlockDefinition } from "./blocks/BlockDefinition.ts";
import type { VoxelTilesetCommand } from "./commands.ts";

export interface TilesetDocument {
  readonly tilesets: TilesetList;
  readonly blocks: BlockRegistry;
}

export function applyTilesetCommand(
  document: TilesetDocument,
  command: VoxelTilesetCommand
): boolean {
  const { tilesets } = document;

  switch (command.action) {
    case "tileset-added":
      return tilesets.add(command.tileset);
    case "tileset-removed":
      return tilesets.remove(command.tilesetId);
    case "tileset-resized":
      return resizeTileset(document, command.tilesetId, command.tileSize);
    default:
      return tilesets.updateDefaultTileSize(command.defaultTileSize);
  }
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
