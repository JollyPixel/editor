// Import Node.js Dependencies
import { Buffer } from "node:buffer";

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
import type { AssetManifestData } from "@jolly-pixel/asset";
import {
  Err,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  CatalogChange,
  CatalogProjection
} from "./CatalogProjection.ts";
import {
  catalogProtocols,
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_SNAPSHOT
} from "./CatalogExtension.schema.ts";
import { CatalogContentTooLargeError } from "./errors/CatalogContentTooLargeError.ts";
import type { AssetWriter } from "../sync/AssetWriter.ts";
import {
  decodeContent,
  type AssetInlineContent
} from "../events/AssetEvents.ts";

// CONSTANTS
export const CATALOG_ROOM = "asset-catalog";
export const DEFAULT_CATALOG_MAX_CONTENT_BYTES = 16 * 1024 * 1024;

export type CatalogCommandType =
  | typeof CATALOG_CREATE
  | typeof CATALOG_RENAME
  | typeof CATALOG_DELETE;

export interface CatalogCreateCommand {
  type: typeof CATALOG_CREATE;
  requestId?: string;
  path: string;
  kind?: string;
  content: AssetInlineContent;
}

export interface CatalogRenameCommand {
  type: typeof CATALOG_RENAME;
  requestId?: string;
  assetId: string;
  to: string;
}

export interface CatalogDeleteCommand {
  type: typeof CATALOG_DELETE;
  requestId?: string;
  assetId: string;
}

export type CatalogCommand =
  | CatalogCreateCommand
  | CatalogRenameCommand
  | CatalogDeleteCommand;

export type CatalogMessage =
  | { type: typeof CATALOG_SNAPSHOT; manifest: AssetManifestData; }
  | { type: typeof CATALOG_CHANGED; change: CatalogChange; }
  | {
    type: typeof CATALOG_APPLIED;
    requestId?: string;
    command: CatalogCommandType;
    assetId: string;
  }
  | {
    type: typeof CATALOG_REJECTED;
    requestId?: string;
    command: CatalogCommandType;
    reason: string;
  };

export interface CatalogExtensionOptions {
  projection: CatalogProjection;
  writer: AssetWriter;
  id?: string;
  maxContentBytes?: number;
}

export class CatalogExtension extends Extension<CatalogCommand> {
  readonly id: string;
  readonly name = CATALOG_ROOM;
  readonly protocols: MessageProtocols = catalogProtocols;

  #projection: CatalogProjection;
  #writer: AssetWriter;
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
      manifest: this.#projection.snapshot()
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
    const result = await this.#execute(command, context.actor)
      .catch((error: unknown) => Err(
        error instanceof Error ? error : new Error(String(error))
      ));

    context.room.sendTo(clientId, result.ok ?
      {
        type: CATALOG_APPLIED,
        requestId: command.requestId,
        command: command.type,
        assetId: result.val.assetId
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

  #execute(
    command: CatalogCommand,
    actor: EventStore.Actor
  ): Promise<Result<EventStore.Event, Error>> {
    switch (command.type) {
      case CATALOG_CREATE: {
        const size = Buffer.byteLength(command.content.data, "base64");
        if (size > this.#maxContentBytes) {
          return Promise.resolve(
            Err(new CatalogContentTooLargeError(size, this.#maxContentBytes))
          );
        }

        return this.#writer.create({
          path: command.path,
          kind: command.kind,
          data: decodeContent(command.content),
          actor
        });
      }
      case CATALOG_RENAME:
        return this.#writer.rename({
          assetId: command.assetId,
          to: command.to,
          actor
        });
      default:
        return this.#writer.remove({
          assetId: command.assetId,
          actor
        });
    }
  }
}
