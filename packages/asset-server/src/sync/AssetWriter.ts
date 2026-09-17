// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { AssetSource as AssetSourcePath } from "@jolly-pixel/asset";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import {
  AssetPathEscapeError,
  isStatePath,
  safeAssetPath,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import { UnknownAssetKindError } from "../kinds/errors/UnknownAssetKindError.ts";
import { AssetPathConflictError } from "./errors/AssetPathConflictError.ts";
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
import type { CatalogPathConflict } from "../catalog/protocol.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";

export interface AssetWriterOptions {
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  kinds: AssetKindRegistry;
  projector: AssetProjector;
  identity: CatalogIdentitySidecar;
  source: AssetSource;
  logger?: Logger;
}

interface WriteOptions {
  actor: EventStore.Actor;
  alreadyProjected?: boolean;
}

export interface CreateAssetInput extends WriteOptions {
  path: string;
  data: Uint8Array;
  kind?: string;
  assetId?: string;
  onPathConflict?: CatalogPathConflict;
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

export class AssetWriter {
  #eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
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
    const writable = writableAssetPath(input.path);
    if (!writable.ok) {
      return Err(writable.val);
    }

    if (input.kind !== undefined && !this.#kinds.has(input.kind)) {
      return Err(new UnknownAssetKindError(input.kind));
    }

    const assetId = input.assetId ?? randomUUID();
    const path = input.onPathConflict === "suffix" ?
      this.#vacantPath(writable.val, assetId) :
      writable.val;
    const vacant = this.#vacant(path, assetId);
    if (!vacant.ok) {
      return Err(vacant.val);
    }

    const kind = input.kind ?? this.#kinds.resolve(path).kind;
    const assetData = {
      path,
      kind,
      hash: contentHash(input.data),
      size: input.data.byteLength,
      content: encodeContent(input.data)
    };

    const appended = this.#append(
      assetId,
      kind,
      ASSET_CREATED,
      assetData,
      input
    );
    if (!appended.ok) {
      return appended;
    }

    this.#identity.set({
      id: assetId,
      path,
      kind
    });
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

    const updatedAssetData = {
      path: current.val.path,
      kind: current.val.kind,
      hash: contentHash(input.data),
      size: input.data.byteLength,
      content: encodeContent(input.data)
    };

    return Promise.resolve(
      this.#append(
        input.assetId,
        current.val.kind,
        ASSET_UPDATED,
        updatedAssetData,
        input
      )
    );
  }

  async rename(
    input: RenameAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const found = this.#current(input.assetId);
    if (!found.ok) {
      return found;
    }

    const writable = writableAssetPath(input.to);
    if (!writable.ok) {
      return Err(writable.val);
    }

    const to = writable.val;
    const vacant = this.#vacant(to, input.assetId);
    if (!vacant.ok) {
      return Err(vacant.val);
    }

    const current = found.val;
    const renamedAssetData = {
      from: current.path,
      to,
      kind: current.kind,
      hash: current.hash
    };
    const appended = this.#append(
      input.assetId,
      current.kind,
      ASSET_RENAMED,
      renamedAssetData,
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
    const deletedAssetData = {
      path: current.path,
      kind: current.kind
    };
    const appended = this.#append(
      input.assetId,
      current.kind,
      ASSET_DELETED,
      deletedAssetData,
      input
    );
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

  #vacant(
    path: string,
    assetId: string
  ): Result<void, AssetPathConflictError> {
    const occupant = this.#projector.assetAt(path);

    return occupant === null || occupant === assetId ?
      Ok(undefined) :
      Err(new AssetPathConflictError(path, occupant));
  }

  #vacantPath(
    path: string,
    assetId: string
  ): string {
    const source = new AssetSourcePath(path);

    let candidate = path;
    for (let index = 2; !this.#vacant(candidate, assetId).ok; index++) {
      candidate = source.withName(`${source.name}-${index}`).toString();
    }

    return candidate;
  }

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
    if (
      result.ok &&
      options.alreadyProjected === true
    ) {
      this.#projector.markProjected(assetId);
    }

    return result;
  }
}

function writableAssetPath(
  input: string
): Result<string, AssetPathEscapeError> {
  const result = safeAssetPath(input);
  if (!result.ok) {
    return Err(new AssetPathEscapeError(input, result.val));
  }
  if (isStatePath(result.val)) {
    return Err(new AssetPathEscapeError(input, "reserved"));
  }

  return Ok(result.val);
}
