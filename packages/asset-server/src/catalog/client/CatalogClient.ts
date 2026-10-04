// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { AssetRecordData } from "@jolly-pixel/asset";
import {
  match,
  P
} from "ts-pattern";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_CREATE_FOLDER,
  CATALOG_DELETE,
  CATALOG_DELETE_FOLDER,
  CATALOG_EXPORT,
  CATALOG_FOLDERS,
  CATALOG_IMPORT,
  CATALOG_MOVE_FOLDER,
  CATALOG_PLAN,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  type CatalogApplied,
  type CatalogChange,
  type CatalogCommand,
  type CatalogCommandType,
  type CatalogMessage,
  type CatalogRequest
} from "./protocol.ts";
import type { PathConflictPolicy } from "../../writer/AssetWriter.ts";
import type {
  ImportConflictPolicy,
  ImportPlan,
  ImportReport
} from "../../archive/import/AssetImport.ts";
import {
  decodeContent,
  encodeContent
} from "../../events/inlineContent.ts";
import { CatalogRejectedError } from "./errors/CatalogRejectedError.ts";
import { CatalogUnavailableError } from "./errors/CatalogUnavailableError.ts";
import {
  DependencyIndex,
  type DependencyMap,
  type ReadonlyDependencyIndex
} from "./DependencyIndex.ts";

export interface CatalogRoom {
  on(
    type: "message",
    listener: (message: CatalogMessage) => void
  ): void;
  off(
    type: "message",
    listener: (message: CatalogMessage) => void
  ): void;
  send(command: CatalogCommand): void;
  join(): void;
  leave(): void;
}

export interface CatalogRoomSource {
  room(
    name: string
  ): CatalogRoom;
}

export interface CatalogConnectOptions {
  timeoutMs?: number;
}

export interface CatalogCreateOptions {
  kind?: string;
  onConflict?: PathConflictPolicy;
}

export interface CatalogRemoveOptions {
  /**
   * Delete the asset even when others still reference it.
   * @default false
   */
  force?: boolean;
}

export interface CatalogRename {
  assetId: string;
  to: string;
}

export interface CatalogBatchReport {
  applied: number;
  failure?: string;
}

export interface CatalogImportOptions {
  onConflict: ImportConflictPolicy;
}

export type CatalogClientEvents = {
  change: () => void;
  dependencies: (assetId: string) => void;
};

type Reply<TType extends CatalogCommandType> = CatalogApplied extends infer TApplied ?
  TApplied extends { command: infer TCommand; } ?
    TType extends TCommand ? TApplied : never :
    never :
  never;
type CatalogSnapshot = Extract<
  CatalogMessage,
  { type: typeof CATALOG_SNAPSHOT; }
>;
type SettledMessage = Extract<
  CatalogMessage,
  { type: typeof CATALOG_APPLIED | typeof CATALOG_REJECTED; }
>;
type Settle = (message: SettledMessage | null) => void;

export class CatalogClient extends Emitter<CatalogClientEvents> {
  static async connect(
    rooms: CatalogRoomSource,
    options: CatalogConnectOptions = {}
  ): Promise<CatalogClient> {
    const catalog = new CatalogClient(
      rooms.room(CATALOG_ROOM)
    );
    try {
      await (options.timeoutMs === undefined ?
        catalog.ready :
        readyWithin(catalog.ready, options.timeoutMs));
    }
    catch (error) {
      catalog.dispose();

      throw error;
    }

    return catalog;
  }

  readonly #room: CatalogRoom;
  readonly #records = new Map<string, AssetRecordData>();
  #folders: readonly string[] = [];
  readonly #dependencies = new DependencyIndex();
  readonly #pending = new Map<string, Settle>();
  readonly #ready = Promise.withResolvers<void>();

  constructor(
    room: CatalogRoom
  ) {
    super();

    this.#room = room;
    this.#room.on("message", this.#onMessage);
    this.#room.join();
  }

  get ready(): Promise<void> {
    return this.#ready.promise;
  }

  get dependencies(): ReadonlyDependencyIndex {
    return this.#dependencies;
  }

  records(): IterableIterator<AssetRecordData> {
    return this.#records.values();
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.#records.get(assetId);
  }

  folders(): IterableIterator<string> {
    return this.#folders.values();
  }

  dependentsOf(
    assetId: string
  ): AssetRecordData[] {
    return this.#dependencies
      .dependentsOf(assetId)
      .flatMap((dependentId) => this.#records.get(dependentId) ?? []);
  }

  toSnapshot(): CatalogSnapshot {
    return {
      type: CATALOG_SNAPSHOT,
      manifest: {
        version: 1,
        assets: [
          ...this.#records.values()
        ]
      },
      dependencies: this.#dependencies.toJSON(),
      folders: this.#folders
    };
  }

  async create(
    path: string,
    content: Uint8Array | null,
    options: CatalogCreateOptions = {}
  ): Promise<string> {
    const reply = await this.#request({
      type: CATALOG_CREATE,
      path,
      kind: options.kind,
      onConflict: options.onConflict,
      content: content === null ? undefined : encodeContent(content)
    });

    return reply.assetId;
  }

  async rename(
    assetId: string,
    to: string
  ): Promise<void> {
    throwOnFailure(
      CATALOG_RENAME,
      await this.renameMany([
        { assetId, to }
      ])
    );
  }

  async remove(
    assetId: string,
    options: CatalogRemoveOptions = {}
  ): Promise<void> {
    throwOnFailure(
      CATALOG_DELETE,
      await this.removeMany([assetId], options)
    );
  }

  async renameMany(
    renames: Iterable<CatalogRename>
  ): Promise<CatalogBatchReport> {
    const entries = Array.from(renames, (rename) => {
      return {
        assetId: rename.assetId,
        to: rename.to
      };
    });
    if (entries.length === 0) {
      return { applied: 0 };
    }

    const rawReport = await this.#request({
      type: CATALOG_RENAME,
      renames: entries
    });

    return reportOf(rawReport);
  }

  async removeMany(
    assetIds: Iterable<string>,
    options: CatalogRemoveOptions = {}
  ): Promise<CatalogBatchReport> {
    const entries = [...assetIds];
    if (entries.length === 0) {
      return { applied: 0 };
    }

    const rawReport = await this.#request({
      type: CATALOG_DELETE,
      assetIds: entries,
      force: options.force
    });

    return reportOf(rawReport);
  }

  async createFolder(
    path: string
  ): Promise<string> {
    const reply = await this.#request({
      type: CATALOG_CREATE_FOLDER,
      path
    });

    return reply.path;
  }

  async moveFolder(
    from: string,
    to: string
  ): Promise<string> {
    const reply = await this.#request({
      type: CATALOG_MOVE_FOLDER,
      from,
      to
    });

    return reply.path;
  }

  async removeFolder(
    path: string
  ): Promise<void> {
    await this.#request({
      type: CATALOG_DELETE_FOLDER,
      path
    });
  }

  async exportArchive(
    root?: string
  ): Promise<Uint8Array> {
    const reply = await this.#request({
      type: CATALOG_EXPORT,
      root
    });

    return decodeContent(reply.content);
  }

  async planImport(
    archive: Uint8Array
  ): Promise<ImportPlan> {
    const reply = await this.#request({
      type: CATALOG_PLAN,
      content: encodeContent(archive)
    });

    return reply.plan;
  }

  async importArchive(
    archive: Uint8Array,
    options: CatalogImportOptions
  ): Promise<ImportReport> {
    const reply = await this.#request({
      type: CATALOG_IMPORT,
      content: encodeContent(archive),
      onConflict: options.onConflict
    });

    return reply.report;
  }

  dispose(): void {
    this.#room.off("message", this.#onMessage);
    this.#room.leave();
    for (const settle of this.#pending.values()) {
      settle(null);
    }
    this.#pending.clear();
  }

  async #request<TRequest extends CatalogRequest>(
    request: TRequest
  ): Promise<Reply<TRequest["type"]>>;
  async #request(
    request: CatalogRequest
  ): Promise<CatalogApplied> {
    await this.ready;

    const requestId = crypto.randomUUID();
    const { promise, resolve, reject } = Promise.withResolvers<
      CatalogApplied
    >();
    this.#pending.set(requestId, (message) => {
      if (message === null) {
        reject(new CatalogRejectedError(
          "catalog client disposed",
          request.type
        ));
      }
      else if (message.type === CATALOG_REJECTED) {
        reject(
          new CatalogRejectedError(
            message.reason,
            message.command
          )
        );
      }
      else if (message.command === request.type) {
        resolve(message);
      }
      else {
        reject(new CatalogRejectedError(
          `unexpected "${message.command}" reply`,
          request.type
        ));
      }
    });
    this.#room.send({
      ...request,
      requestId
    });

    return promise;
  }

  readonly #onMessage = (
    message: CatalogMessage
  ): void => {
    match(message)
      .with({ type: CATALOG_SNAPSHOT }, (snapshot) => this.#applySnapshot(snapshot))
      .with({ type: CATALOG_CHANGED }, ({ changes }) => this.#applyChanges(changes))
      .with({ type: CATALOG_FOLDERS }, ({ folders }) => this.#applyFolders(folders))
      .with({ type: P.union(CATALOG_APPLIED, CATALOG_REJECTED) }, (reply) => this.#settle(reply))
      .exhaustive();
  };

  #applySnapshot(
    snapshot: CatalogSnapshot
  ): void {
    this.#records.clear();
    for (const record of snapshot.manifest.assets) {
      this.#records.set(record.id, record);
    }

    this.#folders = [...snapshot.folders];
    const changed = this.#replaceDependencies(
      snapshot.dependencies ?? {}
    );

    this.#ready.resolve();
    this.emit("change");
    for (const assetId of changed) {
      this.emit("dependencies", assetId);
    }
  }

  #applyChanges(
    changes: Iterable<CatalogChange>
  ): void {
    const changed = new Set<string>();
    for (const { assetId, record, dependencies } of changes) {
      if (record === null) {
        this.#records.delete(assetId);
      }
      else {
        this.#records.set(assetId, record);
      }
      const edgesChanged = dependencies === undefined ?
        this.#dependencies.delete(assetId) :
        this.#dependencies.set(assetId, dependencies);
      if (edgesChanged) {
        changed.add(assetId);
      }
    }

    this.emit("change");
    for (const assetId of changed) {
      this.emit("dependencies", assetId);
    }
  }

  #applyFolders(
    folders: Iterable<string>
  ): void {
    this.#folders = [...folders];
    this.emit("change");
  }

  #settle(
    reply: SettledMessage
  ): void {
    const settle = this.#pending.get(reply.requestId);
    this.#pending.delete(reply.requestId);
    settle?.(reply);
  }

  #replaceDependencies(
    dependencies: DependencyMap
  ): string[] {
    const changed: string[] = [];
    const previous = this.#dependencies.toJSON();
    for (const assetId of Object.keys(previous)) {
      if (
        !Object.hasOwn(dependencies, assetId) &&
        this.#dependencies.delete(assetId)
      ) {
        changed.push(assetId);
      }
    }

    for (const [assetId, references] of Object.entries(dependencies)) {
      if (this.#dependencies.set(assetId, references)) {
        changed.push(assetId);
      }
    }

    return changed;
  }
}

async function readyWithin(
  ready: Promise<void>,
  timeoutMs: number
): Promise<void> {
  const timeout = Promise.withResolvers<never>();
  const timer = setTimeout(
    () => timeout.reject(new CatalogUnavailableError()),
    timeoutMs
  );

  try {
    await Promise.race([
      ready,
      timeout.promise
    ]);
  }
  finally {
    clearTimeout(timer);
  }
}

function reportOf(
  reply: Reply<typeof CATALOG_RENAME | typeof CATALOG_DELETE>
): CatalogBatchReport {
  return reply.failure === undefined ?
    { applied: reply.applied } :
    {
      applied: reply.applied,
      failure: reply.failure
    };
}

function throwOnFailure(
  command: typeof CATALOG_RENAME | typeof CATALOG_DELETE,
  report: CatalogBatchReport
): void {
  if (report.failure !== undefined) {
    throw new CatalogRejectedError(
      report.failure,
      command
    );
  }
}
