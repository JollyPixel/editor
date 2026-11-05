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
  CATALOG_READ,
  CATALOG_RENAME,
  CATALOG_REJECTED,
  CATALOG_REPLACE,
  CATALOG_RESTORE,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  CATALOG_TAG,
  CATALOG_TAGS,
  CATALOG_UNTAG,
  type CatalogApplied,
  type CatalogChange,
  type CatalogCommand,
  type CatalogCreateCommand,
  type CatalogExportCommand,
  type CatalogImportCommand,
  type CatalogMessage,
  type CatalogPlanCommand,
  type CatalogReadCommand,
  type CatalogReplaceCommand,
  type CatalogRestoreCommand,
  type CatalogTagCommand
} from "./client/protocol.ts";
import type { CatalogFolders } from "./CatalogFolders.ts";
import { CatalogOutbox } from "./CatalogOutbox.ts";
import { CatalogContentTooLargeError } from "./errors/CatalogContentTooLargeError.ts";
import { CompanionReplacementError } from "./errors/CompanionReplacementError.ts";
import { AssetHasDependentsError } from "./errors/AssetHasDependentsError.ts";
import {
  toActor,
  type AssetInlineContent
} from "../model/events/AssetEvents.ts";
import {
  decodeContent,
  encodeContent
} from "../model/events/inlineContent.ts";
import type { AssetArchive } from "./archive/AssetArchive.ts";
import type { ArchiveBackend } from "./archive/ArchiveBackend.ts";
import { exportAssetArchive } from "./archive/exportAssetArchive.ts";
import { readAssetArchive } from "./archive/readAssetArchive.ts";
import type { ArchiveLimits } from "./archive/ArchiveLimits.ts";
import {
  importAssetArchive,
  planAssetImport
} from "./archive/import/importAssetArchive.ts";
import type { AssetTags } from "./tags/AssetTags.ts";
import type {
  CreateAssetFromPayload,
  CreateConvertedAsset
} from "../storage/writer/AssetWriteInput.ts";
import { asError } from "../common/asError.ts";
import { TaskChain } from "../common/TaskChain.ts";
import { UnknownAssetError } from "../storage/writer/errors/UnknownAssetError.ts";

// CONSTANTS
export const DEFAULT_CATALOG_MAX_CONTENT_BYTES = 16 * 1024 * 1024;
const kCreatedAssetId = "created";

export interface CatalogBackend extends ArchiveBackend {
  readonly folders: CatalogFolders;
  readonly tags: AssetTags;
}

export interface CatalogPolicy {
  /**
   * Decoded size cap of a catalog payload: created content and archives.
   * The `maxContentBytes` of a kind's handler replaces it for content of that
   * kind.
   * @default DEFAULT_CATALOG_MAX_CONTENT_BYTES
   */
  maxContentBytes?: number;
  /**
   * Decoded size caps of an archive received by plan and import.
   */
  archiveLimits?: ArchiveLimits;
  /**
   * Refuse a delete command aimed at an asset other assets still reference.
   * Reconciliation is never refused.
   * @default true
   */
  deleteProtection?: boolean;
}

export interface CatalogExtensionOptions extends CatalogPolicy {
  backend: CatalogBackend;
  id?: string;
}

type CreatedContent =
  | Pick<CreateAssetFromPayload, "data">
  | Pick<CreateConvertedAsset, "converted">;

export class CatalogExtension extends Extension<CatalogCommand> {
  readonly id: string;
  readonly name = CATALOG_ROOM;
  readonly protocols: MessageProtocols = catalogProtocols;
  override readonly queries = [CATALOG_READ];

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
  #onTags: (assetId: string) => void;
  #tagReads = new TaskChain();
  #snapshot: CatalogMessage | null = null;

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
    this.#onChanged = (change) => {
      this.#snapshot = null;
      this.#outbox.pushChange(change);
    };
    this.#onFolders = (folders) => {
      this.#snapshot = null;
      this.#outbox.pushFolders(folders);
    };
    this.#onTags = (assetId) => {
      this.#outbox
        .hold(() => this.#tagReads.run(async() => {
          this.#outbox.pushTags(assetId, await this.#backend.tags.list(assetId));
        }))
        .catch(() => undefined);
    };
    this.#backend.catalog.on(
      "changed",
      this.#onChanged
    );
    this.#backend.folders.on(
      "changed",
      this.#onFolders
    );
    this.#backend.tags.on(
      "changed",
      this.#onTags
    );
  }

  override onClientConnect(
    client: ClientHandle,
    _peer: RoomPeer,
    context: RoomContext
  ): void {
    this.#broadcast = context.room;
    this.#members.add(client.id);

    context.room.sendTo(client.id, this.#joinSnapshot());
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
    const result = await this.#execute(command, toActor(context.identity))
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
    this.#backend.tags.off(
      "changed",
      this.#onTags
    );
    this.#members.clear();
    this.#broadcast = null;
  }

  #joinSnapshot(): CatalogMessage {
    const { catalog, folders } = this.#backend;
    this.#snapshot ??= Object.freeze({
      type: CATALOG_SNAPSHOT,
      manifest: catalog.snapshot(),
      dependencies: catalog.dependencies.toJSON(),
      folders: folders.toJSON()
    } satisfies CatalogMessage);

    return this.#snapshot;
  }

  async #execute(
    command: CatalogCommand,
    actor: EventStore.Actor
  ): Promise<Result<CatalogApplied, Error>> {
    const { writer, folders, tags } = this.#backend;

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
      .with({ type: CATALOG_TAGS }, async({ type, assetId }) => Ok({
        command: type,
        assetId,
        tags: await tags.list(assetId)
      }))
      .with({ type: CATALOG_TAG }, (tag) => this.#tag(tag, actor))
      .with({ type: CATALOG_UNTAG }, async({ type, assetId, name }) => (
        await tags.delete(assetId, name)
      )
        .map(() => {
          return {
            command: type,
            assetId,
            name
          };
        }))
      .with({ type: CATALOG_RESTORE }, (restore) => this.#restore(restore, actor))
      .with({ type: CATALOG_REPLACE }, (replace) => this.#replace(replace, actor))
      .with({ type: CATALOG_READ }, (read) => this.#read(read))
      .exhaustive();
  }

  async #tag(
    command: CatalogTagCommand,
    actor: EventStore.Actor
  ): Promise<Result<CatalogApplied, Error>> {
    const created = await this.#backend.tags.create({
      assetId: command.assetId,
      name: command.name,
      message: command.message,
      actor
    });

    return created.map((tag) => {
      return {
        command: command.type,
        tag
      };
    });
  }

  async #restore(
    command: CatalogRestoreCommand,
    actor: EventStore.Actor
  ): Promise<Result<CatalogApplied, Error>> {
    const restored = await this.#backend.tags.restore({
      assetId: command.assetId,
      name: command.name,
      actor
    });

    return restored.map((report) => {
      return {
        command: command.type,
        report
      };
    });
  }

  async #replace(
    command: CatalogReplaceCommand,
    actor: EventStore.Actor
  ): Promise<Result<CatalogApplied, Error>> {
    const { assetId, from } = command;
    const record = this.#backend.catalog.record(assetId);
    if (record === undefined) {
      const error = new UnknownAssetError(assetId);

      return Err(error);
    }

    const decoded = this.#decode(
      command.content,
      this.#kindContentLimit(record.kind.value)
    );
    const data = !decoded.ok || from === undefined ?
      decoded :
      await this.#convertedReplacement(record.kind.value, from, decoded.val);
    if (!data.ok) {
      return data;
    }

    const replaced = await this.#backend.tags.replace({
      assetId,
      data: data.val,
      actor
    });

    return replaced.map((report) => {
      return {
        command: command.type,
        assetId,
        report
      };
    });
  }

  async #read(
    command: CatalogReadCommand
  ): Promise<Result<CatalogApplied, Error>> {
    const { assetId } = command;
    await this.#backend.flush(assetId);
    const record = this.#backend.catalog.record(assetId);
    if (record === undefined) {
      const error = new UnknownAssetError(assetId);

      return Err(error);
    }

    const data = await this.#backend.source.read(record.path.toString());
    const limit = this.#kindContentLimit(record.kind.value);
    if (data.byteLength > limit) {
      const error = new CatalogContentTooLargeError(data.byteLength, limit);

      return Err(error);
    }

    return Ok({
      command: command.type,
      assetId,
      content: encodeContent(data)
    });
  }

  async #convertedReplacement(
    kind: string,
    from: string,
    content: Uint8Array
  ): Promise<Result<Uint8Array, Error>> {
    const converted = await this.#backend.kinds.convert(kind, from, content);

    return converted.andThen(({ content, companions = [] }) => {
      if (companions.length > 0) {
        const error = new CompanionReplacementError(kind, from);

        return Err(error);
      }

      return Ok(content);
    });
  }

  async #create(
    command: CatalogCreateCommand,
    actor: EventStore.Actor
  ): Promise<Result<CatalogApplied, Error>> {
    const created = await this.#createdContent(command);
    if (!created.ok) {
      return created;
    }

    const written = await this.#backend.writer.create({
      path: command.path,
      kind: command.kind,
      onPathConflict: command.onConflict,
      actor,
      ...created.val
    });

    return written.map((event) => {
      return {
        command: command.type,
        assetId: event.assetId
      };
    });
  }

  async #createdContent(
    command: CatalogCreateCommand
  ): Promise<Result<CreatedContent, Error>> {
    const { content, from } = command;
    if (content === undefined) {
      return Ok({});
    }

    const { kinds } = this.#backend;
    const kind = command.kind ?? kinds.resolve(command.path).kind;
    const decoded = this.#decode(content, this.#kindContentLimit(kind));
    if (!decoded.ok) {
      return decoded;
    }

    if (from === undefined) {
      return this.#loadable(kind, decoded.val).map(() => {
        return { data: decoded.val };
      });
    }

    const converted = await kinds.convert(kind, from, decoded.val);

    return converted.andThen((asset) => this.#loadable(kind, asset.content).map(() => {
      return { converted: asset };
    }));
  }

  #loadable(
    kind: string,
    content: Uint8Array
  ): Result<unknown, Error> {
    const { kinds } = this.#backend;

    return kinds.has(kind) ?
      kinds.decode(kind, kCreatedAssetId, content) :
      Ok(undefined);
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
      .listDependents(assetId)
      .map((record) => {
        return {
          id: record.id.value,
          path: record.path.toString()
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
    return this.#decode(content, this.#maxContentBytes).andThen(
      (bytes) => readAssetArchive(bytes, this.#archiveLimits)
    );
  }

  #kindContentLimit(
    kind: string
  ): number {
    const { kinds } = this.#backend;
    const limit = kinds.has(kind) ?
      kinds.get(kind).maxContentBytes :
      undefined;

    return limit ?? this.#maxContentBytes;
  }

  #decode(
    content: AssetInlineContent,
    limit: number
  ): Result<Uint8Array, Error> {
    const data = decodeContent(content);
    if (data.byteLength <= limit) {
      return Ok(data);
    }

    const error = new CatalogContentTooLargeError(
      data.byteLength,
      limit
    );

    return Err(error);
  }
}
