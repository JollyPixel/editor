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
import { catalogProtocols } from "./protocol.schema.ts";
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_EXPORT,
  CATALOG_IMPORT,
  CATALOG_PLAN,
  CATALOG_RENAME,
  CATALOG_REJECTED,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  type CatalogApplied,
  type CatalogChange,
  type CatalogCommand,
  type CatalogDeleteCommand,
  type CatalogMessage
} from "./client/protocol.ts";
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
import type {
  ArchiveBackend,
  AssetArchive
} from "../archive/AssetArchive.ts";
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

export interface CatalogExtensionOptions {
  backend: ArchiveBackend;
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

  #backend: ArchiveBackend;
  #maxContentBytes: number;
  #archiveLimits: ArchiveLimits;
  #deleteProtection: boolean;
  #broadcast: RoomBroadcast | null = null;
  #members = new Set<string>();
  #onChanged: (change: CatalogChange) => void;

  constructor(
    options: CatalogExtensionOptions
  ) {
    super();
    this.id = options.id ?? CATALOG_ROOM;
    this.#backend = options.backend;
    this.#maxContentBytes = options.maxContentBytes ??
      DEFAULT_CATALOG_MAX_CONTENT_BYTES;
    this.#archiveLimits = { ...options.archiveLimits };
    this.#deleteProtection = options.deleteProtection ?? true;
    this.#onChanged = (change) => this.#broadcast?.broadcast({
      type: CATALOG_CHANGED,
      change
    } satisfies CatalogMessage);
    this.#backend.catalog.on(
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

    const { catalog } = this.#backend;
    context.room.sendTo(client.id, {
      type: CATALOG_SNAPSHOT,
      manifest: catalog.snapshot(),
      dependencies: catalog.dependencies.toJSON()
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
    this.#backend.catalog.off(
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
    const backend = this.#backend;

    switch (command.type) {
      case CATALOG_CREATE: {
        const data = this.#decode(command.content);
        if (!data.ok) {
          return data;
        }

        const written = await backend.writer.create({
          path: command.path,
          kind: command.kind,
          onPathConflict: command.onConflict,
          data: data.val,
          actor
        });

        return applied(command.type, written);
      }
      case CATALOG_RENAME: {
        const written = await backend.writer.rename({
          assetId: command.assetId,
          to: command.to,
          actor
        });

        return applied(command.type, written);
      }
      case CATALOG_DELETE: {
        const deletable = this.#deletable(command);
        if (!deletable.ok) {
          return deletable;
        }

        const written = await backend.writer.remove({
          assetId: command.assetId,
          actor
        });

        return applied(command.type, written);
      }
      case CATALOG_EXPORT: {
        const archive = await exportAssetArchive(backend, {
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
      case CATALOG_PLAN:
        return this.#readArchive(command.content)
          .andThen((archive) => planAssetImport(backend, archive))
          .map((plan) => {
            return {
              command: command.type,
              plan
            };
          });
      case CATALOG_IMPORT: {
        const archive = this.#readArchive(command.content);
        if (!archive.ok) {
          return archive;
        }

        const report = await importAssetArchive(backend, archive.val, {
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

  #deletable(
    command: CatalogDeleteCommand
  ): Result<void, AssetHasDependentsError> {
    if (!this.#deleteProtection || command.force === true) {
      return Ok(undefined);
    }

    const dependents = this.#backend.catalog
      .dependentsOf(command.assetId)
      .map((record) => {
        return {
          id: record.id.value,
          path: record.source
        };
      });

    return dependents.length === 0 ?
      Ok(undefined) :
      Err(new AssetHasDependentsError(command.assetId, dependents));
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

    return data.byteLength > this.#maxContentBytes ?
      Err(new CatalogContentTooLargeError(
        data.byteLength,
        this.#maxContentBytes
      )) :
      Ok(data);
  }
}

function applied(
  command: Extract<CatalogApplied, { assetId: string; }>["command"],
  written: Result<EventStore.Event, Error>
): Result<CatalogApplied, Error> {
  return written.map((event) => {
    return {
      command,
      assetId: event.assetId
    };
  });
}
