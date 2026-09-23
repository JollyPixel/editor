// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  AssetArchive,
  AssetArchiveAsset
} from "../AssetArchive.ts";
import { AssetArchiveError } from "../errors/AssetArchiveError.ts";
import type { AssetKindRegistry } from "../../kinds/AssetKindRegistry.ts";
import { asError } from "../../utils/asError.ts";

export async function copyWithFreshIds(
  archive: AssetArchive,
  kinds: AssetKindRegistry
): Promise<Result<AssetArchive, AssetArchiveError>> {
  const copies = archive.assets.map((asset) => {
    return {
      asset,
      id: crypto.randomUUID()
    };
  });
  const idMap = new Map(copies.map(({ asset, id }) => [asset.id, id]));

  const assets: AssetArchiveAsset[] = [];
  for (const { asset, id } of copies) {
    const copied = await rebind(asset, id, idMap, kinds);
    if (!copied.ok) {
      return copied;
    }
    assets.push(copied.val);
  }

  const { root } = archive;

  return Ok({
    root: root === undefined ? undefined : {
      id: idMap.get(root.id) ?? root.id,
      kind: root.kind
    },
    assets,
    missing: archive.missing
  });
}

async function rebind(
  asset: AssetArchiveAsset,
  id: string,
  idMap: ReadonlyMap<string, string>,
  kinds: AssetKindRegistry
): Promise<Result<AssetArchiveAsset, AssetArchiveError>> {
  const handler = kinds.get(asset.kind);
  const state = handler.create(id);
  try {
    handler.load(state, asset.data);
    const references = handler.dependencies?.(state) ?? [];
    if (
      handler.rebind === undefined &&
      references.some((reference) => idMap.has(reference.id))
    ) {
      throw new Error(`Kind "${asset.kind}" cannot rebind asset references.`);
    }
    handler.rebind?.(state, idMap);

    return Ok({
      id,
      kind: asset.kind,
      path: asset.path,
      data: await handler.serialize(state)
    });
  }
  catch (cause) {
    const error = new AssetArchiveError(
      "unreadable-asset",
      `Cannot copy "${asset.path}": ${asError(cause).message}`,
      {
        assetId: asset.id,
        cause
      }
    );

    return Err(error);
  }
}
