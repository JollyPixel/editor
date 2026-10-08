// Import Third-party Dependencies
import {
  Extension,
  type ClientHandle,
  type MessageProtocols,
  type RoomPeer,
  type RoomBroadcast,
  type RoomContext
} from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import { match } from "ts-pattern";

// Import Internal Dependencies
import { catalogProtocols } from "./protocol.schema.ts";
import {
  CATALOG_APPLIED,
  CATALOG_CREATE,
  CATALOG_CREATE_FOLDER,
  CATALOG_DELETE,
  CATALOG_DELETE_FOLDER,
  CATALOG_EXPORT,
  CATALOG_IMPORT,
  CATALOG_MOVE_FOLDER,
  CATALOG_PLAN,
  CATALOG_RENAME,
  CATALOG_REJECTED,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  type CatalogApplied,
  type CatalogChange,
  type CatalogCommand,
  type CatalogCreateCommand,
  type CatalogExportCommand,
  type CatalogImportCommand,
  type CatalogMessage,
  type CatalogPlanCommand
} from "./client/protocol.ts";
import type { CatalogFolders } from "./CatalogFolders.ts";
import { CatalogOutbox } from "./CatalogOutbox.ts";
import { CatalogContentTooLargeError } from "./errors/CatalogContentTooLargeError.ts";
import { AssetHasDependentsError } from "./errors/AssetHasDependentsError.ts";
import {
  actorOf,
  type AssetInlineContent
} from "../events/AssetEvents.ts";
import {
  decodeContent,
  encodeContent
} from "../events/inlineContent.ts";
import type { AssetArchive } from "../archive/AssetArchive.ts";
import type { ArchiveBackend } from "../archive/ArchiveBackend.ts";
import { exportAssetArchive } from "../archive/exportAssetArchive.ts";
import { readAssetArchive } from "../archive/readAssetArchive.ts";
import type { ArchiveLimits } from "../archive/ArchiveLimits.ts";
import {
  importAssetArchive,
  planAssetImport
} from "../archive/import/importAssetArchive.ts";
import { asError } from "../utils/asError.ts";

// CONSTANTS
export const DEFAULT_CATALOG_MAX_CONTENT_BYTES = 16 * 1024 * 1024;

export interface CatalogBackend extends ArchiveBackend {
  readonly folders: CatalogFolders;
}

export interface CatalogExtensionOptions {
  backend: CatalogBackend;
  id?: string;
  maxContentBytes?: number;
  /**
   * Decoded size caps of an archive received by plan and import.
   */
  archiveLimits?: ArchiveLimits;
  /**
   * Refuse a delete command aimed at an asset other assets still reference.
   * @default true
   */
  deleteProtection?: boolean;
}

export class CatalogExtension extends Extension<CatalogCommand> {
  readonly id: string;
  readonly name = CATALOG_ROOM;
  readonly protocols: MessageProtocols = catalogProtocols;

  #backend: CatalogBackend;
  #maxContentBytes: number;
  #archiveLimits: ArchiveLimits;
  #deleteProtection: boolean;
  #broadcast: RoomBroadcast | null = null;
  #members = new Set<string>();
  readonly #outbox = new CatalogOutbox(
    (message) => this.#broadcast?.broadcast(message)
  );
  #onChanged: (change: CatalogChange) => void;
  #onFolders: (folders: readonly string[]) => void;

  constructor(
    options: CatalogExtensionOptions
  ) {
    super();

    this.id = options.id ?? CATALOG_ROOM;
    this.#backend = options.backend;
    this.#maxContentBytes = options.maxContentBytes ??
      DEFAULT_CATALOG_MAX_CONTENT_BYTES;
    this.#archiveLimits = {
      ...options.archiveLimits
    };
    this.#deleteProtection = options.deleteProtection ?? true;
    this.#onChanged = (change) => this.#outbox.pushChange(change);
    this.#onFolders = (folders) => this.#outbox.pushFolders(folders);
    this.#backend.catalog.on(
      "changed",
      this.#onChanged
    );
    this.#backend.folders.on(
      "changed",
      this.#onFolders
    );
  }

  override onClientConnect(
    client: ClientHandle,
    _peer: RoomPeer,
    context: RoomContext
  ): void {
    this.#broadcast = context.room;
    this.#members.add(client.id);

    const { catalog, folders } = this.#backend;
    context.room.sendTo(client.id, {
      type: CATALOG_SNAPSHOT,
      manifest: catalog.snapshot(),
      dependencies: catalog.dependencies.toJSON(),
      folders: folders.toJSON()
    } satisfies CatalogMessage);
  }

  override onClientDisconnect(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    if (this.#members.size === 0) {
      this.#broadcast = null;
    }
  }

  override async onMessage(
    clientId: string,
    command: CatalogCommand,
    context: RoomContext
  ): Promise<void> {
    const result = await this.#execute(command, actorOf(context.identity))
      .catch((error: unknown) => Err(asError(error)));

    this.#outbox.flush();
    context.room.sendTo(clientId, result.ok ?
      {
        type: CATALOG_APPLIED,
        requestId: command.requestId,
        ...result.val
      } satisfies CatalogMessage :
      {
        type: CATALOG_REJECTED,
        requestId: command.requestId,
        command: command.type,
        reason: result.val.message
      } satisfies CatalogMessage
    );
  }

  override dispose(): void {
    this.#backend.catalog.off(
      "changed",
      this.#onChanged
    );
    this.#backend.folders.off(
      "changed",
      this.#onFolders
    );
    this.#members.clear();
    this.#broadcast = null;
  }

  async #execute(
    command: CatalogCommand,
    actor: EventStore.Actor
  ): Promise<Result<CatalogApplied, Error>> {
    const { writer, folders } = this.#backend;

    return match(command)
      .with({ type: CATALOG_CREATE }, (create) => this.#create(create, actor))
      .with({ type: CATALOG_RENAME }, ({ type, renames }) => this.#applyEach(
        type,
        renames,
        (rename) => writer.rename({
          assetId: rename.assetId,
          to: rename.to,
          actor
        })
      ))
      .with({ type: CATALOG_DELETE }, ({ type, assetIds, force }) => this.#applyEach(
        type,
        assetIds,
        (assetId) => this.#remove(assetId, force, actor)
      ))
      .with({ type: CATALOG_CREATE_FOLDER }, async({ type, path }) => Ok({
        command: type,
        path: await folders.create(path)
      }))
      .with({ type: CATALOG_MOVE_FOLDER }, async({ type, from, to }) => Ok({
        command: type,
        path: await folders.move(from, to)
      }))
      .with({ type: CATALOG_DELETE_FOLDER }, async({ type, path }) => Ok({
        command: type,
        path: await folders.delete(path)
      }))
      .with({ type: CATALOG_EXPORT }, (exported) => this.#export(exported))
      .with({ type: CATALOG_PLAN }, (plan) => this.#plan(plan))
      .with({ type: CATALOG_IMPORT }, (imported) => this.#import(imported, actor))
      .exhaustive();
  }

  async #create(
    command: CatalogCreateCommand,
    actor: EventStore.Actor
  ): Promise<Result<CatalogApplied, Error>> {
    const data = command.content === undefined ?
      Ok(undefined) :
      this.#decode(command.content);
    if (!data.ok) {
      return data;
    }

    const written = await this.#backend.writer.create({
      path: command.path,
      kind: command.kind,
      onPathConflict: command.onConflict,
      data: data.val,
      actor
    });

    return written.map((event) => {
      return {
        command: command.type,
        assetId: event.assetId
      };
    });
  }

  async #export(
    command: CatalogExportCommand
  ): Promise<Result<CatalogApplied, Error>> {
    const archive = await exportAssetArchive(this.#backend, {
      root: command.root
    });
    if (!archive.ok) {
      return archive;
    }
    if (archive.val.byteLength > this.#maxContentBytes) {
      const error = new CatalogContentTooLargeError(
        archive.val.byteLength,
        this.#maxContentBytes
      );

      return Err(error);
    }

    return Ok({
      command: command.type,
      content: encodeContent(archive.val)
    });
  }

  #plan(
    command: CatalogPlanCommand
  ): Result<CatalogApplied, Error> {
    return this.#readArchive(command.content)
      .andThen((archive) => planAssetImport(this.#backend, archive))
      .map((plan) => {
        return {
          command: command.type,
          plan
        };
      });
  }

  async #import(
    command: CatalogImportCommand,
    actor: EventStore.Actor
  ): Promise<Result<CatalogApplied, Error>> {
    const archive = this.#readArchive(command.content);
    if (!archive.ok) {
      return archive;
    }

    const report = await importAssetArchive(this.#backend, archive.val, {
      onConflict: command.onConflict,
      actor
    });

    return report.map((value) => {
      return {
        command: command.type,
        report: value
      };
    });
  }

  #applyEach<TEntry>(
    command: typeof CATALOG_RENAME | typeof CATALOG_DELETE,
    entries: readonly TEntry[],
    write: (entry: TEntry) => Promise<Result<EventStore.Event, Error>>
  ): Promise<Result<CatalogApplied, Error>> {
    return this.#outbox.hold(async() => {
      let applied = 0;
      for (const entry of entries) {
        const written = await write(entry)
          .catch((error: unknown) => Err(asError(error)));
        if (!written.ok) {
          return Ok({
            command,
            applied,
            failure: written.val.message
          });
        }
        applied++;
      }

      return Ok({
        command,
        applied
      });
    });
  }

  async #remove(
    assetId: string,
    force: boolean | undefined,
    actor: EventStore.Actor
  ): Promise<Result<EventStore.Event, Error>> {
    const deletable = this.#deletable(assetId, force);
    if (!deletable.ok) {
      return deletable;
    }

    return this.#backend.writer.remove({
      assetId,
      actor
    });
  }

  #deletable(
    assetId: string,
    force: boolean | undefined
  ): Result<void, AssetHasDependentsError> {
    if (!this.#deleteProtection || force === true) {
      return Ok(undefined);
    }

    const dependents = this.#backend.catalog
      .dependentsOf(assetId)
      .map((record) => {
        return {
          id: record.id.value,
          path: record.source
        };
      });

    if (dependents.length === 0) {
      return Ok(undefined);
    }

    const error = new AssetHasDependentsError(assetId, dependents);

    return Err(error);
  }

  #readArchive(
    content: AssetInlineContent
  ): Result<AssetArchive, Error> {
    return this.#decode(content).andThen(
      (bytes) => readAssetArchive(bytes, this.#archiveLimits)
    );
  }

  #decode(
    content: AssetInlineContent
  ): Result<Uint8Array, Error> {
    const data = decodeContent(content);
    if (data.byteLength <= this.#maxContentBytes) {
      return Ok(data);
    }

    const error = new CatalogContentTooLargeError(
      data.byteLength,
      this.#maxContentBytes
    );

    return Err(error);
  }
}
