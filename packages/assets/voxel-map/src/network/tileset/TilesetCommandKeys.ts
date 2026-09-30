// Import Third-party Dependencies
import {
  isPixelCommand,
  pixelCommandKeys
} from "@jolly-pixel/asset.pixel-art/client";

// Import Internal Dependencies
import type {
  TilesetDocumentNetworkCommand,
  TilesetNetworkCommand
} from "./types.ts";

export function tilesetCommandKey(
  command: TilesetDocumentNetworkCommand
): string {
  switch (command.action) {
    case "block-defined":
      return `block:${command.block.id}`;
    case "block-removed":
    case "block-moved":
      return `block:${command.blockId}`;
    case "material-group-defined":
      return `material-group:${command.group.id}`;
    case "material-group-removed":
      return `material-group:${command.groupId}`;
    case "blend-group-defined":
      return `blend-group:${command.group.id}`;
    case "blend-group-removed":
      return `blend-group:${command.groupId}`;
    case "tile-size-updated":
      return "tile-size";
    default: {
      const unhandled: never = command;
      throw new Error(
        `tilesetCommandKey: unhandled action '${(unhandled as TilesetDocumentNetworkCommand).action}'.`
      );
    }
  }
}

export function tilesetWriteKeys(
  command: TilesetNetworkCommand
): string[] | null {
  if (isPixelCommand(command)) {
    return pixelCommandKeys(command);
  }

  return command.action === "block-moved" ?
    null :
    [tilesetCommandKey(command)];
}
