// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import { fromUint8Array } from "js-base64";
import type { AssetRecordData } from "@jolly-pixel/asset";
import type * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_DELETE,
  CATALOG_REJECTED,
  CATALOG_RENAME,
  CATALOG_ROOM,
  CATALOG_SNAPSHOT,
  type CatalogCommand,
  type CatalogMessage,
  type CatalogPathConflict
} from "./protocol.ts";
import { CatalogRejectedError } from "./errors/CatalogRejectedError.ts";

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

export type CatalogClientEvents = {
  change: () => void;
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
      content: {
        type: "inline",
        encoding: "base64",
        data: fromUint8Array(content)
      }
    });

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
      case CATALOG_SNAPSHOT:
        this.#records.clear();
        for (const record of message.manifest.assets) {
          this.#records.set(record.id, record);
        }
        this.#ready.resolve();
        this.emit("change");
        break;
      case CATALOG_CHANGED:
        if (message.change.record === null) {
          this.#records.delete(message.change.assetId);
        }
        else {
          this.#records.set(
            message.change.assetId,
            message.change.record
          );
        }
        this.emit("change");
        break;
      default:
        this.#settle(message);
    }
  };

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
