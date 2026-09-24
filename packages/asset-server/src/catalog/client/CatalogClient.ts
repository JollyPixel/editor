// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { AssetRecordData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_EXPORT,
  CATALOG_IMPORT,
  CATALOG_PLAN,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  type CatalogApplied,
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

export interface CatalogImportOptions {
  onConflict: ImportConflictPolicy;
}

export type CatalogClientEvents = {
  change: () => void;
  dependencies: (assetId: string) => void;
};

type Reply<TType extends CatalogCommandType> = Extract<
  CatalogApplied,
  { command: TType; }
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
    const catalog = new CatalogClient(rooms.room(CATALOG_ROOM));
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

  dependentsOf(
    assetId: string
  ): AssetRecordData[] {
    return this.#dependencies
      .dependentsOf(assetId)
      .flatMap((dependentId) => this.#records.get(dependentId) ?? []);
  }

  async create(
    path: string,
    content: Uint8Array,
    options: CatalogCreateOptions = {}
  ): Promise<string> {
    const reply = await this.#request({
      type: CATALOG_CREATE,
      path,
      kind: options.kind,
      onConflict: options.onConflict,
      content: encodeContent(content)
    });

    return reply.assetId;
  }

  async rename(
    assetId: string,
    to: string
  ): Promise<void> {
    await this.#request({
      type: CATALOG_RENAME,
      assetId,
      to
    });
  }

  async remove(
    assetId: string,
    options: CatalogRemoveOptions = {}
  ): Promise<void> {
    await this.#request({
      type: CATALOG_DELETE,
      assetId,
      force: options.force
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
        reject(new CatalogRejectedError(message.reason, message.command));
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
    switch (message.type) {
      case CATALOG_SNAPSHOT: {
        this.#records.clear();
        for (const record of message.manifest.assets) {
          this.#records.set(record.id, record);
        }
        const changed = this.#replaceDependencies(message.dependencies ?? {});
        this.#ready.resolve();
        this.emit("change");
        for (const assetId of changed) {
          this.emit("dependencies", assetId);
        }
        break;
      }
      case CATALOG_CHANGED: {
        const { assetId, record, dependencies } = message.change;
        if (record === null) {
          this.#records.delete(assetId);
        }
        else {
          this.#records.set(assetId, record);
        }
        const changed = dependencies === undefined ?
          this.#dependencies.delete(assetId) :
          this.#dependencies.set(assetId, dependencies);
        this.emit("change");
        if (changed) {
          this.emit("dependencies", assetId);
        }
        break;
      }
      default: {
        const settle = this.#pending.get(message.requestId);
        this.#pending.delete(message.requestId);
        settle?.(message);
      }
    }
  };

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
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ready,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new CatalogUnavailableError()),
          timeoutMs
        );
      })
    ]);
  }
  finally {
    clearTimeout(timer);
  }
}
