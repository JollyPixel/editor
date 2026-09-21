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

// Import Internal Dependencies
import type { CatalogProjection } from "./CatalogProjection.ts";
import { catalogProtocols } from "./protocol.schema.ts";
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_EXPORT,
  CATALOG_PLAN,
  CATALOG_RENAME,
  CATALOG_REJECTED,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  type CatalogApplied,
  type CatalogChange,
  type CatalogCommand,
  type CatalogInlineContent,
  type CatalogLifecycleCommandType,
  type CatalogMessage
} from "./client/protocol.ts";
import { CatalogContentTooLargeError } from "./errors/CatalogContentTooLargeError.ts";
import type { AssetWriter } from "../writer/AssetWriter.ts";
import {
  actorOf,
  decodeContent,
  encodeContent
} from "../events/AssetEvents.ts";
import type {
  ArchiveBackend,
  AssetArchive
} from "../archive/AssetArchive.ts";
import { exportAssetArchive } from "../archive/exportAssetArchive.ts";
import { readAssetArchive } from "../archive/readAssetArchive.ts";
import { planAssetImport } from "../archive/planAssetImport.ts";
import { importAssetArchive } from "../archive/importAssetArchive.ts";
import { asError } from "../utils/asError.ts";

// CONSTANTS
export const DEFAULT_CATALOG_MAX_CONTENT_BYTES = 16 * 1024 * 1024;

export interface CatalogExtensionOptions {
  projection: CatalogProjection;
  writer: AssetWriter;
  archive?: ArchiveBackend;
  id?: string;
  maxContentBytes?: number;
}

export class CatalogExtension extends Extension<CatalogCommand> {
  readonly id: string;
  readonly name = CATALOG_ROOM;
  readonly protocols: MessageProtocols = catalogProtocols;

  #projection: CatalogProjection;
  #writer: AssetWriter;
  #archive: ArchiveBackend | null;
  #maxContentBytes: number;
  #broadcast: RoomBroadcast | null = null;
  #members = new Set<string>();
  #onChanged: (change: CatalogChange) => void;

  constructor(
    options: CatalogExtensionOptions
  ) {
    super();
    this.id = options.id ?? CATALOG_ROOM;
    this.#projection = options.projection;
    this.#writer = options.writer;
    this.#archive = options.archive ?? null;
    this.#maxContentBytes = options.maxContentBytes ??
      DEFAULT_CATALOG_MAX_CONTENT_BYTES;
    this.#onChanged = (change) => this.#broadcast?.broadcast({
      type: CATALOG_CHANGED,
      change
    } satisfies CatalogMessage);
    this.#projection.on(
      "changed",
      this.#onChanged
    );
  }

  override onClientConnect(
    client: ClientHandle,
    _peer: RoomPeer,
    context: RoomContext
  ): void {
    this.#broadcast = context.room;
    this.#members.add(client.id);

    context.room.sendTo(client.id, {
      type: CATALOG_SNAPSHOT,
      manifest: this.#projection.snapshot(),
      dependencies: this.#projection.dependencies()
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
    this.#projection.off(
      "changed",
      this.#onChanged
    );
    this.#members.clear();
    this.#broadcast = null;
  }

  async #execute(
    command: CatalogCommand,
    actor: EventStore.Actor
  ): Promise<Result<CatalogApplied, Error>> {
    switch (command.type) {
      case CATALOG_CREATE: {
        const data = this.#decode(command.content);

        return data.ok ?
          applied(command.type, await this.#writer.create({
            path: command.path,
            kind: command.kind,
            onPathConflict: command.onConflict,
            data: data.val,
            actor
          })) :
          data;
      }
      case CATALOG_RENAME:
        return applied(command.type, await this.#writer.rename({
          assetId: command.assetId,
          to: command.to,
          actor
        }));
      case CATALOG_DELETE:
        return applied(command.type, await this.#writer.remove({
          assetId: command.assetId,
          actor
        }));
      case CATALOG_EXPORT: {
        const backend = this.#archiveBackend();
        if (!backend.ok) {
          return backend;
        }

        const archive = await exportAssetArchive(backend.val, {
          root: command.root
        });
        if (archive.byteLength > this.#maxContentBytes) {
          return Err(new CatalogContentTooLargeError(
            archive.byteLength,
            this.#maxContentBytes
          ));
        }

        return Ok({
          command: command.type,
          content: encodeContent(archive)
        });
      }
      case CATALOG_PLAN: {
        const backend = this.#archiveBackend();
        if (!backend.ok) {
          return backend;
        }

        return this.#readArchive(command.content)
          .andThen((archive) => planAssetImport(backend.val, archive))
          .map((plan) => {
            return {
              command: command.type,
              plan
            };
          });
      }
      default: {
        const backend = this.#archiveBackend();
        if (!backend.ok) {
          return backend;
        }

        const archive = this.#readArchive(command.content);
        if (!archive.ok) {
          return archive;
        }

        const report = await importAssetArchive(backend.val, archive.val, {
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
    }
  }

  #archiveBackend(): Result<ArchiveBackend, Error> {
    return this.#archive === null ?
      Err(new Error("Archives are not available on this catalog.")) :
      Ok(this.#archive);
  }

  #readArchive(
    content: CatalogInlineContent
  ): Result<AssetArchive, Error> {
    return this.#decode(content).andThen(
      (bytes) => readAssetArchive(bytes)
    );
  }

  #decode(
    content: CatalogInlineContent
  ): Result<Uint8Array, Error> {
    const data = decodeContent(content);

    return data.byteLength > this.#maxContentBytes ?
      Err(new CatalogContentTooLargeError(
        data.byteLength,
        this.#maxContentBytes
      )) :
      Ok(data);
  }
}

function applied(
  command: CatalogLifecycleCommandType,
  written: Result<EventStore.Event, Error>
): Result<CatalogApplied, Error> {
  return written.map((event) => {
    return {
      command,
      assetId: event.assetId
    };
  });
}
