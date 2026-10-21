// Import Internal Dependencies
import type { AnyAssetKindHandler } from "./AssetKindHandler.ts";

export async function serializeParts(
  handler: AnyAssetKindHandler,
  state: unknown
): Promise<Map<string, Uint8Array> | undefined> {
  const { parts } = handler;
  if (parts === undefined) {
    return undefined;
  }

  const serialized = new Map<string, Uint8Array>();
  for (const partId of parts.list(state)) {
    serialized.set(partId, await parts.serialize(state, partId));
  }

  return serialized;
}
