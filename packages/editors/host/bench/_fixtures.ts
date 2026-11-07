// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  BenchmarkConfig,
  createReport,
  createReporter,
  mulberry32
} from "@jolly-pixel/bench";
import {
  AssetId,
  type AssetRecordData,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import {
  CATALOG_CHANGED,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  type CatalogMessage
} from "@jolly-pixel/asset-server/client";
import {
  SyncedDocument,
  type ChangeOutbox,
  type DocumentSync,
  type Peer,
  type PeerMetadata,
  type Right,
  type Room,
  type RoomEventMap,
  type RoomRights
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import "../test/setup.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { AssetDocumentKind } from "#src/lease/AssetLease.ts";
import type { AssetRecords } from "#src/lease/AssetLeases.ts";
import type { EditorToolbarArchives } from "#src/session/EditorToolbarSources.ts";
import { SessionConnection } from "#src/session/SessionConnection.ts";

// CONSTANTS
export const TARGET_ID = "map";
export const TARGET_KIND = "voxelmap";
export const DEPENDENCY_KIND = "pixelart";
const kFolders = 16;
const kIdentity = {
  username: "bench",
  peerId: "peer-bench",
  color: "#ff0000"
};

export class BenchRoom extends Emitter<RoomEventMap> implements Room {
  readonly id: string;
  readonly clientId = "bench-client";
  readonly peers = new Map<string, Peer>();
  readonly profile = {};
  readonly role = "editor";
  readonly rights: RoomRights = {};
  readonly access: Right = "write";

  constructor(
    id: string
  ) {
    super();
    this.id = id;
  }

  can(): Right {
    return this.access;
  }

  send(
    _message: unknown
  ): void {
    return void 0;
  }

  updatePresence(
    _patch: PeerMetadata
  ): void {
    return void 0;
  }

  join(): void {
    return void 0;
  }

  resync(): void {
    return void 0;
  }

  resumeWith(): void {
    return void 0;
  }

  leave(): void {
    return void 0;
  }
}

export class BenchClient {
  readonly #rooms = new Map<string, BenchRoom>();

  room(
    name: string
  ): Room {
    return this.#room(name);
  }

  deliver(
    name: string,
    message: unknown
  ): void {
    this.#room(name).emit("message", message);
  }

  destroy(): void {
    this.#rooms.clear();
  }

  #room(
    name: string
  ): BenchRoom {
    let room = this.#rooms.get(name);
    if (room === undefined) {
      room = new BenchRoom(name);
      this.#rooms.set(name, room);
    }

    return room;
  }
}

export class BenchDocumentSync extends Emitter<{
  settled: () => void;
  unsettled: () => void;
}> implements DocumentSync {
  readonly ready = true;
  pending = 0;

  whenReady(): Promise<void> {
    return Promise.resolve();
  }

  destroy(): void {
    this.removeAllListeners();
  }

  keepIn(
    _outbox: ChangeOutbox
  ): void {
    return void 0;
  }

  edit(): void {
    this.pending++;
    if (this.pending === 1) {
      this.emit("unsettled");
    }
  }

  acknowledge(): void {
    this.pending = 0;
    this.emit("settled");
  }
}

export class BenchDocument {
  readonly changes = new BenchDocumentSync();
}

class BenchSyncedDocument extends SyncedDocument<BenchDocument> {
  readonly document: BenchDocument;

  constructor(
    document: BenchDocument
  ) {
    super(document.changes);
    this.document = document;
  }
}

export function benchDocumentKind(
  kind: string
): AssetDocumentKind<BenchDocument> {
  return {
    kind,
    syncDocument: () => new BenchSyncedDocument(new BenchDocument())
  };
}

export class RecordMap implements AssetRecords {
  readonly #records: Map<string, AssetRecordData>;

  constructor(
    records: Iterable<AssetRecordData>
  ) {
    this.#records = new Map(
      Array.from(records, (record) => [record.id, record])
    );
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.#records.get(assetId);
  }
}

export function dependencyRecords(
  count: number
): AssetRecordData[] {
  const random = mulberry32();
  const records = Array.from({ length: count }, (_, index) => {
    const folder = Math.floor(random() * kFolders);

    return {
      id: `asset-${index}`,
      kind: DEPENDENCY_KIND,
      path: `textures/folder-${folder}/asset-${index}.${DEPENDENCY_KIND}`
    };
  });
  for (let index = records.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [records[index], records[swap]] = [records[swap], records[index]];
  }

  return records;
}

export interface BenchProjectOptions {
  records: number;
  dependencies: number;
}

export interface ConnectedProject {
  client: BenchClient;
  connection: SessionConnection;
}

export class BenchProject {
  readonly target: AssetRecordData = {
    id: TARGET_ID,
    kind: TARGET_KIND,
    path: `maps/${TARGET_ID}.${TARGET_KIND}`
  };
  readonly records: AssetRecordData[];
  readonly dependencies: AssetReferenceData[];

  constructor(
    options: BenchProjectOptions
  ) {
    this.records = dependencyRecords(options.records);
    this.dependencies = Array.from(
      { length: options.dependencies },
      (_, index) => {
        return {
          id: `asset-${index}`,
          kind: DEPENDENCY_KIND
        };
      }
    );
  }

  get launch(): EditorLaunch {
    return new EditorLaunch(new AssetId(TARGET_ID));
  }

  async connect(): Promise<ConnectedProject> {
    const client = new BenchClient();
    const connecting = SessionConnection.connect({
      identity: kIdentity,
      client
    });
    client.deliver(CATALOG_ROOM, this.#snapshot());

    return {
      client,
      connection: await connecting
    };
  }

  unrelatedRenames(): [CatalogMessage, CatalogMessage] {
    const unrelated = this.records.find(
      (record) => !this.dependencies.some(({ id }) => id === record.id)
    );
    if (unrelated === undefined) {
      throw new Error("Every record is a dependency of the target");
    }

    return renames(unrelated);
  }

  targetRenames(): [CatalogMessage, CatalogMessage] {
    return renames(this.target);
  }

  dependencyToggle(): [CatalogMessage, CatalogMessage] {
    const extra = this.records.find(
      (record) => !this.dependencies.some(({ id }) => id === record.id)
    );
    if (extra === undefined) {
      throw new Error("Every record is a dependency of the target");
    }

    return [
      changed(this.target, [
        ...this.dependencies,
        {
          id: extra.id,
          kind: extra.kind
        }
      ]),
      changed(this.target, this.dependencies)
    ];
  }

  #snapshot(): CatalogMessage {
    return {
      type: CATALOG_SNAPSHOT,
      manifest: {
        version: 1,
        assets: [this.target, ...this.records]
      },
      dependencies: {
        [TARGET_ID]: this.dependencies
      },
      folders: []
    };
  }
}

function renames(
  record: AssetRecordData
): [CatalogMessage, CatalogMessage] {
  return [
    changed(record),
    changed({
      ...record,
      path: record.path.replace(/\.\w+$/, "-renamed$&")
    })
  ];
}

function changed(
  record: AssetRecordData,
  dependencies?: AssetReferenceData[]
): CatalogMessage {
  return {
    type: CATALOG_CHANGED,
    changes: [
      {
        eventType: "asset.updated",
        assetId: record.id,
        record,
        dependencies
      }
    ]
  };
}

export function toolbarArchives(): EditorToolbarArchives {
  return {
    canImport: true,
    canReset: false,
    dependencies: [],
    download: () => Promise.resolve(),
    downloadAsset: () => Promise.resolve(),
    pickAndImport: () => Promise.resolve(),
    reset: () => Promise.resolve()
  };
}

export function printSideReport(
  suite: string,
  results: object[]
): void {
  const format = process.argv.includes("--json") ?
    "json" :
    BenchmarkConfig.fromEnvironment().format;

  createReporter(format).print(createReport({
    suite,
    results
  }));
}
