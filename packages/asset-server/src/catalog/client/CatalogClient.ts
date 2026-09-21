// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  fromUint8Array,
  toUint8Array
} from "js-base64";
import type {
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";
import type * as network from "@jolly-pixel/network/client";

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
  type CatalogCommand,
  type CatalogCommandType,
  type CatalogInlineContent,
  type CatalogMessage,
  type CatalogPathConflict
} from "./protocol.ts";
import type {
  ImportConflictPolicy,
  ImportPlan,
  ImportReport
} from "../../archive/AssetArchive.ts";
import { CatalogRejectedError } from "./errors/CatalogRejectedError.ts";
import {
  DependencyIndex,
  type DependencyMap
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

export interface CatalogCreateOptions {
  kind?: string;
  onConflict?: CatalogPathConflict;
}

export interface CatalogImportOptions {
  onConflict: ImportConflictPolicy;
}

export type CatalogClientEvents = {
  change: () => void;
  dependencies: (assetId: string) => void;
};

type AppliedMessage = Extract<CatalogMessage, { type: typeof CATALOG_APPLIED; }>;
type SettledMessage = Extract<
  CatalogMessage,
  { type: typeof CATALOG_APPLIED | typeof CATALOG_REJECTED; }
>;
type Settle = (message: SettledMessage | null) => void;

export function catalogRoom(
  client: network.Client
): CatalogRoom {
  return client.room<CatalogCommand, CatalogMessage>(CATALOG_ROOM);
}

export class CatalogClient extends Emitter<CatalogClientEvents> {
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

  records(): IterableIterator<AssetRecordData> {
    return this.#records.values();
  }

  record(
    assetId: string
  ): AssetRecordData | undefined {
    return this.#records.get(assetId);
  }

  dependenciesOf(
    assetId: string
  ): readonly AssetReferenceData[] {
    return this.#dependencies.dependenciesOf(assetId);
  }

  dependentsOf(
    assetId: string
  ): readonly string[] {
    return this.#dependencies.dependentsOf(assetId);
  }

  closureOf(
    assetId: string
  ): AssetReferenceData[] {
    return this.#dependencies.closureOf(assetId);
  }

  async create(
    path: string,
    content: Uint8Array,
    options: CatalogCreateOptions = {}
  ): Promise<string> {
    const message = await this.#request({
      type: CATALOG_CREATE,
      requestId: crypto.randomUUID(),
      path,
      kind: options.kind,
      onConflict: options.onConflict,
      content: inlineContent(content)
    });
    if (message.command !== CATALOG_CREATE) {
      throw unexpectedReply(message, CATALOG_CREATE);
    }

    return message.assetId;
  }

  async rename(
    assetId: string,
    to: string
  ): Promise<void> {
    await this.#request({
      type: CATALOG_RENAME,
      requestId: crypto.randomUUID(),
      assetId,
      to
    });
  }

  async remove(
    assetId: string
  ): Promise<void> {
    await this.#request({
      type: CATALOG_DELETE,
      requestId: crypto.randomUUID(),
      assetId
    });
  }

  async exportArchive(
    root?: string
  ): Promise<Uint8Array> {
    const message = await this.#request({
      type: CATALOG_EXPORT,
      requestId: crypto.randomUUID(),
      root
    });
    if (message.command !== CATALOG_EXPORT) {
      throw unexpectedReply(message, CATALOG_EXPORT);
    }

    return toUint8Array(message.content.data);
  }

  async planImport(
    archive: Uint8Array
  ): Promise<ImportPlan> {
    const message = await this.#request({
      type: CATALOG_PLAN,
      requestId: crypto.randomUUID(),
      content: inlineContent(archive)
    });
    if (message.command !== CATALOG_PLAN) {
      throw unexpectedReply(message, CATALOG_PLAN);
    }

    return message.plan;
  }

  async importArchive(
    archive: Uint8Array,
    options: CatalogImportOptions
  ): Promise<ImportReport> {
    const message = await this.#request({
      type: CATALOG_IMPORT,
      requestId: crypto.randomUUID(),
      content: inlineContent(archive),
      onConflict: options.onConflict
    });
    if (message.command !== CATALOG_IMPORT) {
      throw unexpectedReply(message, CATALOG_IMPORT);
    }

    return message.report;
  }

  dispose(): void {
    this.#room.off("message", this.#onMessage);
    this.#room.leave();
    for (const settle of this.#pending.values()) {
      settle(null);
    }
    this.#pending.clear();
  }

  async #request(
    command: CatalogCommand & { requestId: string; }
  ): Promise<AppliedMessage> {
    await this.ready;

    const { promise, resolve, reject } = Promise.withResolvers<AppliedMessage>();
    this.#pending.set(command.requestId, (message) => {
      if (message === null) {
        reject(new CatalogRejectedError("catalog client disposed", command.type));
      }
      else if (message.type === CATALOG_APPLIED) {
        resolve(message);
      }
      else {
        reject(new CatalogRejectedError(message.reason, message.command));
      }
    });
    this.#room.send(command);

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
      default:
        this.#settle(message);
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

  #settle(
    message: SettledMessage
  ): void {
    if (message.requestId === undefined) {
      return;
    }

    const settle = this.#pending.get(message.requestId);
    this.#pending.delete(message.requestId);
    settle?.(message);
  }
}

function inlineContent(
  data: Uint8Array
): CatalogInlineContent {
  return {
    type: "inline",
    encoding: "base64",
    data: fromUint8Array(data)
  };
}

function unexpectedReply(
  message: AppliedMessage,
  command: CatalogCommandType
): CatalogRejectedError {
  return new CatalogRejectedError(
    `unexpected "${message.command}" reply`,
    command
  );
}
