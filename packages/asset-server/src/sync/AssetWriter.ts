// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import { normalizeAssetPath } from "../sources/paths.ts";
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import { CatalogIdentitySidecar } from "../catalog/CatalogIdentitySidecar.ts";
import { contentHash } from "../utils/contentHash.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  encodeContent,
  type AssetEventDataMap
} from "../events/AssetEvents.ts";
import type { AssetProjector } from "./AssetProjector.ts";
import type { AssetProjection } from "./foldProjection.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";

export interface AssetWriterOptions {
  eventStore: EventStore.EventStore;
  kinds: AssetKindRegistry;
  projector: AssetProjector;
  identity: CatalogIdentitySidecar;
  source: AssetSource;
  logger?: Logger;
}

interface WriteOptions {
  actor: EventStore.Actor;
  /**
   * Marks source-backed mutations as projected without another write.
   */
  alreadyProjected?: boolean;
}

export interface CreateAssetInput extends WriteOptions {
  path: string;
  data: Uint8Array;
  kind?: string;
  assetId?: string;
}

export interface UpdateAssetInput extends WriteOptions {
  assetId: string;
  data: Uint8Array;
}

export interface RenameAssetInput extends WriteOptions {
  assetId: string;
  to: string;
}

export interface DeleteAssetInput extends WriteOptions {
  assetId: string;
}

/**
 * Appends lifecycle events before updating projections and identity.
 */
export class AssetWriter {
  #eventStore: EventStore.EventStore;
  #kinds: AssetKindRegistry;
  #projector: AssetProjector;
  #identity: CatalogIdentitySidecar;
  #source: AssetSource;
  #logger: Logger;

  constructor(
    options: AssetWriterOptions
  ) {
    this.#eventStore = options.eventStore;
    this.#kinds = options.kinds;
    this.#projector = options.projector;
    this.#identity = options.identity;
    this.#source = options.source;
    this.#logger = options.logger ?? silentLogger();
  }

  get identity(): CatalogIdentitySidecar {
    return this.#identity;
  }

  async create(
    input: CreateAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const path = normalizeAssetPath(input.path);
    const kind = input.kind ?? this.#kinds.resolve(path).kind;
    const assetId = input.assetId ?? randomUUID();

    const appended = this.#append(assetId, kind, ASSET_CREATED, {
      path,
      kind,
      hash: contentHash(input.data),
      size: input.data.byteLength,
      content: encodeContent(input.data)
    }, input);
    if (!appended.ok) {
      return appended;
    }

    this.#identity.set({ id: assetId, path, kind });
    await this.#saveIdentity();

    return appended;
  }

  update(
    input: UpdateAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const current = this.#current(input.assetId);
    if (!current.ok) {
      return Promise.resolve(current);
    }

    return Promise.resolve(
      this.#append(input.assetId, current.val.kind, ASSET_UPDATED, {
        path: current.val.path,
        kind: current.val.kind,
        hash: contentHash(input.data),
        size: input.data.byteLength,
        content: encodeContent(input.data)
      }, input)
    );
  }

  async rename(
    input: RenameAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const found = this.#current(input.assetId);
    if (!found.ok) {
      return found;
    }

    const current = found.val;
    const to = normalizeAssetPath(input.to);
    const appended = this.#append(
      input.assetId,
      current.kind,
      ASSET_RENAMED,
      {
        from: current.path,
        to,
        kind: current.kind,
        hash: current.hash
      },
      input
    );
    if (!appended.ok) {
      return appended;
    }

    this.#identity.set({
      id: input.assetId,
      path: to,
      kind: current.kind
    });
    await this.#saveIdentity();

    return appended;
  }

  async remove(
    input: DeleteAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const found = this.#current(input.assetId);
    if (!found.ok) {
      return found;
    }

    const current = found.val;
    const appended = this.#append(input.assetId, current.kind, ASSET_DELETED, {
      path: current.path,
      kind: current.kind
    }, input);
    if (!appended.ok) {
      return appended;
    }

    this.#identity.removeById(input.assetId);
    await this.#saveIdentity();

    return appended;
  }

  #current(
    assetId: string
  ): Result<AssetProjection, Error> {
    const current = this.#projector.desired(assetId);

    return current === null ?
      Err(new Error(`Unknown asset "${assetId}".`)) :
      Ok(current);
  }

  /**
   * Sidecar failures lose stable ids but never appended events.
   */
  async #saveIdentity(): Promise<void> {
    try {
      await this.#identity.save(this.#source);
    }
    catch (error) {
      this.#logger
        .withMetadata({
          reason: error instanceof Error ? error.message : String(error)
        })
        .warn("identity sidecar not persisted");
    }
  }

  /**
   * The type parameter binds `eventData` to the payload `eventType`
   * declares, so a malformed literal fails to compile.
   */
  #append<TEventType extends keyof AssetEventDataMap>(
    assetId: string,
    kind: string,
    eventType: TEventType,
    eventData: AssetEventDataMap[TEventType],
    options: WriteOptions
  ): Result<EventStore.Event, Error> {
    const result = this.#eventStore.writer.append({
      assetType: kind,
      assetId,
      eventType,
      eventData,
      actor: options.actor
    });
    if (result.ok && options.alreadyProjected === true) {
      this.#projector.markProjected(assetId);
    }

    return result;
  }
}
