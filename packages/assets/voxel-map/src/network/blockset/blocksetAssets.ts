// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  encodeBlocksetFile,
  BLOCKSET_KIND,
  type BlocksetFile
} from "../../asset/blockset.ts";

export type BlocksetAssetWriter = Pick<CatalogClient, "create">;

export function createBlocksetAsset(
  catalog: BlocksetAssetWriter,
  path: string,
  file: BlocksetFile
): Promise<string> {
  return catalog.create(
    path,
    encodeBlocksetFile(file),
    {
      kind: BLOCKSET_KIND,
      onConflict: "suffix"
    }
  );
}
