// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import {
  strToU8,
  zipSync,
  type Zippable
} from "fflate";

// Import Internal Dependencies
import {
  ASSET_ARCHIVE_MANIFEST_PATH,
  createAssetBackend,
  type AssetBackend
} from "#src/index.ts";
import {
  linkContent,
  linkHandler
} from "./kinds.ts";

// CONSTANTS
export const ARCHIVE_ACTOR: EventStore.Actor = {
  type: "user",
  id: "alice"
};

export interface ArchiveWorkspace extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly source: MemoryAssetSource;
  readonly eventStore: EventStore.EventStore;
  link(
    path: string,
    ...targets: string[]
  ): Promise<string>;
}

export async function archiveWorkspace(
  catalogMaxContentBytes?: number
): Promise<ArchiveWorkspace> {
  const source = new MemoryAssetSource();
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source,
    eventStore,
    handlers: [linkHandler()],
    catalogMaxContentBytes,
    watch: false
  });

  return {
    backend,
    source,
    eventStore,
    async link(path, ...targets) {
      const created = await backend.writer.create({
        path,
        data: linkContent(...targets),
        actor: ARCHIVE_ACTOR
      });

      return created.unwrap().assetId;
    },
    async [Symbol.asyncDispose]() {
      await backend.close();
      eventStore.close();
    }
  };
}

export function zipArchive(
  manifest: unknown,
  entries: Record<string, Uint8Array>
): Uint8Array {
  const files: Zippable = { ...entries };
  files[ASSET_ARCHIVE_MANIFEST_PATH] = strToU8(JSON.stringify(manifest));

  return zipSync(files);
}
