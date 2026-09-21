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
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { CatalogProjection } from "./CatalogProjection.ts";
import { catalogProtocols } from "./protocol.schema.ts";
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_RENAME,
  CATALOG_REJECTED,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  type CatalogChange,
  type CatalogCommand,
  type CatalogMessage
} from "./client/protocol.ts";
import { CatalogContentTooLargeError } from "./errors/CatalogContentTooLargeError.ts";
import type { AssetWriter } from "../writer/AssetWriter.ts";
import {
  actorOf,
  decodeContent
} from "../events/AssetEvents.ts";
import { asError } from "../utils/asError.ts";

// CONSTANTS
export const DEFAULT_CATALOG_MAX_CONTENT_BYTES = 16 * 1024 * 1024;

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
        const data = decodeContent(command.content);
        if (data.byteLength > this.#maxContentBytes) {
          return Promise.resolve(
            Err(new CatalogContentTooLargeError(
              data.byteLength,
              this.#maxContentBytes
            ))
          );
        }

        return this.#writer.create({
          path: command.path,
          kind: command.kind,
          onPathConflict: command.onConflict,
          data,
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
