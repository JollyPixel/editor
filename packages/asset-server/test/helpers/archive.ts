// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import { AssetRoom } from "@jolly-pixel/asset";
import { Server } from "@jolly-pixel/network";
import {
  strToU8,
  zipSync,
  type Zippable
} from "fflate";

// Import Internal Dependencies
import {
  createAssetBackend,
  type AssetBackend,
  type AssetBackendOptions
} from "#src/index.ts";
import {
  linkContent,
  liveLinkHandler
} from "./kinds.ts";
import { recordingClient } from "./rooms.ts";

// CONSTANTS
export const ARCHIVE_ACTOR: EventStore.Actor = {
  type: "user",
  id: "alice"
};
const kEditor = "editor";

export interface ArchiveWorkspace extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly source: MemoryAssetSource;
  readonly eventStore: EventStore.EventStore;
  link(
    path: string,
    ...targets: string[]
  ): Promise<string>;
  editLive(
    assetId: string,
    ...targets: string[]
  ): Promise<void>;
}

export type ArchiveWorkspaceOptions = Pick<
  AssetBackendOptions,
  "catalogMaxContentBytes" | "catalogArchiveLimits"
>;

export async function archiveWorkspace(
  options: ArchiveWorkspaceOptions = {}
): Promise<ArchiveWorkspace> {
  const source = new MemoryAssetSource();
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    ...options,
    source,
    eventStore,
    handlers: [liveLinkHandler()],
    watch: false
  });

  let server: Server | null = null;
  const joined = new Set<string>();

  return {
    backend,
    source,
    eventStore,
    async editLive(assetId, ...targets) {
      if (server === null) {
        server = new Server();
        backend.attach(server);
        server.handleConnect(recordingClient(kEditor), {
          subject: kEditor,
          role: "default"
        });
      }

      const room = new AssetRoom("link", assetId).toString();
      if (!joined.has(room)) {
        joined.add(room);
        await server.handleMessage(kEditor, { room, kind: "join" });
      }
      await server.handleMessage(kEditor, {
        room,
        kind: "message",
        payload: { action: "set", targets }
      });
    },
    async link(path, ...targets) {
      const created = await backend.writer.create({
        path,
        data: linkContent(...targets),
        actor: ARCHIVE_ACTOR
      });

      return created.unwrap().assetId;
    },
    async [Symbol.asyncDispose]() {
      await server?.close();
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
  files["bundle.json"] = strToU8(JSON.stringify(manifest));

  return zipSync(files);
}
