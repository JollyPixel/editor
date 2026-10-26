// Import Internal Dependencies
import type { AnyAssetKindHandler } from "./AssetKindHandler.ts";

export interface SerializedAsset {
  readonly data: Uint8Array;
  readonly parts?: ReadonlyMap<string, Uint8Array>;
}

export async function serializeAsset(
  handler: AnyAssetKindHandler,
  state: unknown
): Promise<SerializedAsset> {
  const data = await handler.serialize(state);
  const { parts } = handler;
  if (parts === undefined) {
    return { data };
  }

  const serialized = new Map<string, Uint8Array>();
  for (const partId of parts.list(data)) {
    serialized.set(partId, await parts.serialize(state, partId));
  }

  return { data, parts: serialized };
}
