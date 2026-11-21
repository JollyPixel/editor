// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { AssetRoomBinding } from "../model/kinds/AssetKindHandler.ts";

export interface RoomBindingOptions<TState> {
  readonly kind: string;
  readonly state: TState;
  /**
   * @default "asset-1"
   */
  readonly assetId?: string;
  readonly version?: () => number | undefined;
  /**
   * The asset path the room reports.
   * @default the asset id
   */
  readonly path?: string;
  /**
   * Project files the room can read, by path.
   */
  readonly files?: Readonly<Record<string, string | Uint8Array>>;
}

// CONSTANTS
const kEncoder = new TextEncoder();

export function roomBinding<TState>(
  options: RoomBindingOptions<TState>
): AssetRoomBinding<TState> {
  const {
    kind,
    state,
    assetId = "asset-1",
    version,
    path = assetId,
    files = {}
  } = options;

  return {
    assetId,
    kind,
    roomId: new AssetRoom(kind, assetId).toString(),
    state,
    version,
    path: () => path,
    readFile: (filePath) => Promise.resolve(
      Object.hasOwn(files, filePath) ? fileBytes(files[filePath]) : null
    )
  };
}

function fileBytes(
  content: string | Uint8Array
): Uint8Array {
  return typeof content === "string" ? kEncoder.encode(content) : content;
}
