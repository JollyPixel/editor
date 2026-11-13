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
  CATALOG_PREVIEW,
  CATALOG_PROGRESS,
  CATALOG_READ,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_REPLACE,
  CATALOG_RESTORE,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  CATALOG_TAG,
  CATALOG_TAGS,
  CATALOG_TAGS_CHANGED,
  CATALOG_UNTAG,
  type CatalogApplied,
  type CatalogChange,
  type CatalogCommand,
  type CatalogCommandType,
  type CatalogMessage,
  type CatalogProgress,
  type CatalogRequest
} from "../catalog/protocol.ts";
import type { PathConflictPolicy } from "../model/PathConflictPolicy.ts";
import type { AssetPreview } from "../model/kinds/AssetKindHandler.ts";
import type {
  ImportConflictPolicy,
  ImportPlan,
  ImportReport
} from "../catalog/archive/import/AssetImport.ts";
import type {
  AssetTag,
  ReplaceReport,
  RestoreReport
} from "../catalog/tags/AssetTags.schema.ts";
import { MAX_KIND_CONTENT_BYTES } from "../model/kinds/KindLimits.ts";
import { CatalogContentTooLargeError } from "../catalog/errors/CatalogContentTooLargeError.ts";
import { CatalogRejectedError } from "./errors/CatalogRejectedError.ts";
import { CatalogUnavailableError } from "./errors/CatalogUnavailableError.ts";
import {
  DependencyIndex,
  type DependencyMap,
  type ReadonlyDependencyIndex
} from "../catalog/DependencyIndex.ts";

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
  /**
   * Aborting it rejects the connection with the signal's reason.
   */
  signal?: AbortSignal;
  /**
   * @default CATALOG_ROOM
   */
  room?: string;
}

export interface CatalogCreateOptions {
  kind?: string;
  onConflict?: PathConflictPolicy;
  /**
   * Extension of the content's format, such as `".png"`. The kind's handler
   * converts it before the asset is written.
   */
  from?: string;
  /**
   * Called with each stage the server enters before it replies: `converting`
   * when `from` is set, then `writing`, which also fires without content.
   */
  onProgress?: CatalogProgress;
}

export interface CatalogReplaceOptions {
  /**
   * Extension of the content's format, such as `".png"`. The asset kind's
   * handler converts it before the content is written.
   */
  from?: string;
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
  "tags-changed": (
    assetId: string,
    tags: readonly AssetTag[]
  ) => void;
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

interface PendingRequest {
  readonly settle: Settle;
  readonly onProgress?: CatalogProgress;
}

export class CatalogClient extends Emitter<CatalogClientEvents> {
  static async connect(
    rooms: CatalogRoomSource,
    options: CatalogConnectOptions = {}
  ): Promise<CatalogClient> {
    const catalog = new CatalogClient(
      rooms.room(options.room ?? CATALOG_ROOM)
    );
    try {
      await readyWithin(catalog.ready, options);
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
  readonly #pending = new Map<string, PendingRequest>();
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

  listDependents(
    assetId: string
  ): AssetRecordData[] {
    return this.#dependencies
      .listDependents(assetId)
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
      content: content === null ? undefined : checkedKindContent(content),
      from: options.from
    }, options.onProgress);

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

    return toReport(rawReport);
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

    return toReport(rawReport);
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

    return reply.content;
  }

  async planImport(
    archive: Uint8Array
  ): Promise<ImportPlan> {
    const reply = await this.#request({
      type: CATALOG_PLAN,
      content: archive
    });

    return reply.plan;
  }

  async importArchive(
    archive: Uint8Array,
    options: CatalogImportOptions
  ): Promise<ImportReport> {
    const reply = await this.#request({
      type: CATALOG_IMPORT,
      content: archive,
      onConflict: options.onConflict
    });

    return reply.report;
  }

  async tags(
    assetId: string
  ): Promise<readonly AssetTag[]> {
    const reply = await this.#request({
      type: CATALOG_TAGS,
      assetId
    });

    return reply.tags;
  }

  async tag(
    assetId: string,
    name: string,
    message?: string
  ): Promise<AssetTag> {
    const reply = await this.#request({
      type: CATALOG_TAG,
      assetId,
      name,
      message
    });

    return reply.tag;
  }

  async untag(
    assetId: string,
    name: string
  ): Promise<void> {
    await this.#request({
      type: CATALOG_UNTAG,
      assetId,
      name
    });
  }

  async restore(
    assetId: string,
    name: string
  ): Promise<RestoreReport> {
    const reply = await this.#request({
      type: CATALOG_RESTORE,
      assetId,
      name
    });

    return reply.report;
  }

  async replace(
    assetId: string,
    content: Uint8Array,
    options: CatalogReplaceOptions = {}
  ): Promise<ReplaceReport> {
    const reply = await this.#request({
      type: CATALOG_REPLACE,
      assetId,
      content: checkedKindContent(content),
      from: options.from
    });

    return reply.report;
  }

  async read(
    assetId: string
  ): Promise<Uint8Array> {
    const reply = await this.#request({
      type: CATALOG_READ,
      assetId
    });

    return reply.content;
  }

  async preview(
    assetId: string
  ): Promise<AssetPreview | null> {
    const reply = await this.#request({
      type: CATALOG_PREVIEW,
      assetId
    });

    return reply.preview;
  }

  dispose(): void {
    this.#room.off("message", this.#onMessage);
    this.#room.leave();
    for (const { settle } of this.#pending.values()) {
      settle(null);
    }
    this.#pending.clear();
  }

  async #request<TRequest extends CatalogRequest>(
    request: TRequest,
    onProgress?: CatalogProgress
  ): Promise<Reply<TRequest["type"]>>;
  async #request(
    request: CatalogRequest,
    onProgress?: CatalogProgress
  ): Promise<CatalogApplied> {
    await this.ready;

    const requestId = crypto.randomUUID();
    const { promise, resolve, reject } = Promise.withResolvers<
      CatalogApplied
    >();
    this.#pending.set(requestId, {
      settle: (message) => {
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
      },
      onProgress
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
      .with({ type: CATALOG_TAGS_CHANGED }, ({ assetId, tags }) => this.emit(
        "tags-changed",
        assetId,
        tags
      ))
      .with({ type: P.union(CATALOG_APPLIED, CATALOG_REJECTED) }, (reply) => this.#settle(reply))
      .with({ type: CATALOG_PROGRESS }, ({ requestId, stage }) => {
        this.#pending.get(requestId)?.onProgress?.(stage);
      })
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
    const pending = this.#pending.get(reply.requestId);
    this.#pending.delete(reply.requestId);
    pending?.settle(reply);
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
  options: CatalogConnectOptions
): Promise<void> {
  const { timeoutMs, signal } = options;
  signal?.throwIfAborted();

  const failed = Promise.withResolvers<never>();
  const timer = timeoutMs === undefined ?
    undefined :
    setTimeout(
      () => failed.reject(new CatalogUnavailableError()),
      timeoutMs
    );
  function onAbort(): void {
    failed.reject(signal?.reason);
  }
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    await Promise.race([
      ready,
      failed.promise
    ]);
  }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function toReport(
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

function checkedKindContent(
  content: Uint8Array
): Uint8Array {
  if (content.byteLength > MAX_KIND_CONTENT_BYTES) {
    throw new CatalogContentTooLargeError(
      content.byteLength,
      MAX_KIND_CONTENT_BYTES
    );
  }

  return content;
}
