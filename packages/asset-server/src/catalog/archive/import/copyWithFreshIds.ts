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
import type { AssetKindRegistry } from "../../../model/kinds/AssetKindRegistry.ts";
import { asError } from "../../../common/asError.ts";
import { serializeAsset } from "../../../model/kinds/serializeAsset.ts";

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
  const decoded = kinds.decode(asset.kind, id, asset.data, asset.partData);
  if (!decoded.ok) {
    return Err(uncopyable(asset, decoded.val));
  }

  const { handler, state } = decoded.val;
  try {
    const references = handler.dependencies?.(state) ?? [];
    if (
      handler.rebind === undefined &&
      references.some((reference) => idMap.has(reference.id))
    ) {
      throw new Error(`Kind "${asset.kind}" cannot rebind asset references.`);
    }
    handler.rebind?.(state, idMap);
    const serialized = await serializeAsset(handler, state);
    const partData = asset.partData === undefined ? undefined : serialized.parts;

    return Ok({
      ...asset,
      id,
      data: serialized.data,
      ...(partData === undefined ? {} : {
        parts: [...partData.keys()],
        partData
      })
    });
  }
  catch (cause) {
    return Err(uncopyable(asset, asError(cause)));
  }
}

function uncopyable(
  asset: AssetArchiveAsset,
  cause: Error
): AssetArchiveError {
  return new AssetArchiveError(
    "unreadable-asset",
    `Cannot copy "${asset.path}": ${cause.message}`,
    {
      assetId: asset.id,
      cause
    }
  );
}
