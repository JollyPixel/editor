// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetKindMismatchError,
  type AssetId,
  type AssetRecord
} from "@jolly-pixel/asset";

// CONSTANTS
const kWorldKind = "voxelmap";
const kTextureKind = "pixelart";

export interface EditorAssets {
  world: AssetRecord;
  texture: AssetRecord;
}

export interface ResolveEditorAssetsOptions {
  catalog?: AssetCatalog;
  world?: AssetId;
}

export async function resolveEditorAssets(
  options: ResolveEditorAssetsOptions = {}
): Promise<EditorAssets> {
  const {
    catalog = await AssetCatalog.fetch(),
    world
  } = options;

  return {
    world: world === undefined
      ? catalog.firstOfKind(kWorldKind)
      : recordOfKind(catalog, world, kWorldKind),
    texture: catalog.firstOfKind(kTextureKind)
  };
}

function recordOfKind(
  catalog: AssetCatalog,
  id: AssetId,
  kind: string
): AssetRecord {
  const record = catalog.get(id);
  if (record.kind !== kind) {
    throw new AssetKindMismatchError(
      id,
      kind,
      record.kind
    );
  }

  return record;
}
