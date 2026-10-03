// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { IdentitySidecar } from "../identity/IdentitySidecar.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  writeData,
  type AssetEventDataMap,
  type AssetWriteData
} from "../events/AssetEvents.ts";
import type { AssetProjector } from "../projection/AssetProjector.ts";
import type { AssetProjection } from "../projection/applyProjection.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import { asError } from "../utils/asError.ts";
import { TaskChain } from "../utils/TaskChain.ts";
import {
  AssetPathAllocator,
  writableAssetPath
} from "./AssetPathAllocator.ts";
import {
  AssetCreationPlanner,
  type PlannedAsset
} from "./AssetCreationPlanner.ts";
import { DependencyReader } from "./DependencyReader.ts";
import type {
  AssetPayload,
  CreateAssetInput,
  DeleteAssetInput,
  RenameAssetInput,
  UpdateAssetInput,
  WriteOptions
} from "./AssetWriteInput.ts";
import { UnknownAssetError } from "./errors/UnknownAssetError.ts";

export {
  PATH_CONFLICT_POLICIES,
  type PathConflictPolicy
} from "./AssetPathAllocator.ts";
export type * from "./AssetWriteInput.ts";

export interface AssetWriterOptions {
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  kinds: AssetKindRegistry;
  projector: AssetProjector;
  identity: IdentitySidecar;
  logger?: Logger;
}

export class AssetWriter {
  #eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  #projector: AssetProjector;
  #identity: IdentitySidecar;
  #logger: Logger;
  #paths: AssetPathAllocator;
  #planner: AssetCreationPlanner;
  #dependencies: DependencyReader;
  #writes = new TaskChain();

  constructor(
    options: AssetWriterOptions
  ) {
    this.#eventStore = options.eventStore;
    this.#projector = options.projector;
    this.#identity = options.identity;
    this.#logger = options.logger ?? silentLogger();
    this.#paths = new AssetPathAllocator({
      projector: options.projector,
      identity: options.identity
    });
    this.#planner = new AssetCreationPlanner({
      kinds: options.kinds,
      paths: this.#paths
    });
    this.#dependencies = new DependencyReader({
      kinds: options.kinds,
      logger: this.#logger
    });
  }

  create(
    input: CreateAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const snapshot = copyContentInput(input);

    return this.#writes.run(() => this.#create(snapshot));
  }

  update(
    input: UpdateAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const snapshot = copyContentInput(input);

    return this.#writes.run(
      () => this.#update(snapshot)
    );
  }

  rename(
    input: RenameAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const snapshot = {
      ...input,
      actor: { ...input.actor }
    };

    return this.#writes.run(
      () => this.#rename(snapshot)
    );
  }

  remove(
    input: DeleteAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const snapshot = {
      ...input,
      actor: { ...input.actor }
    };

    return this.#writes.run(
      () => this.#remove(snapshot)
    );
  }

  async #create(
    input: CreateAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const planned = await this.#planner.plan(input);
    if (!planned.ok) {
      return planned;
    }

    const { owner, companions } = planned.val;
    const written: PlannedAsset[] = [];
    for (const companion of companions) {
      const appended = await this.#appendCreated(
        companion,
        input
      );
      if (!appended.ok) {
        await this.#discard(written, input);

        return appended;
      }
      written.push(companion);
    }

    const appended = await this.#appendCreated(
      owner,
      input
    );
    if (!appended.ok) {
      await this.#discard(written, input);

      return appended;
    }

    await this.#saveIdentity();

    return appended;
  }

  async #appendCreated(
    asset: PlannedAsset,
    options: WriteOptions
  ): Promise<Result<EventStore.Event, Error>> {
    const appended = this.#append(
      asset.assetId,
      asset.kind,
      ASSET_CREATED,
      await this.#writeData(asset.assetId, asset.path, asset.kind, asset),
      options
    );
    if (appended.ok) {
      this.#identity.set({
        id: asset.assetId,
        path: asset.path,
        kind: asset.kind
      });
    }

    return appended;
  }

  async #discard(
    written: readonly PlannedAsset[],
    options: WriteOptions
  ): Promise<void> {
    for (const asset of written) {
      this.#append(
        asset.assetId,
        asset.kind,
        ASSET_DELETED,
        {
          path: asset.path,
          kind: asset.kind
        },
        options
      );
      this.#identity.removeById(asset.assetId);
    }
    if (written.length > 0) {
      await this.#saveIdentity();
    }
  }

  async #update(
    input: UpdateAssetInput
  ): Promise<Result<EventStore.Event, Error>> {
    const current = this.#current(input.assetId);
    if (!current.ok) {
      return current;
    }

    const { path, kind } = current.val;

    return this.#append(
      input.assetId,
      kind,
      ASSET_UPDATED,
      await this.#writeData(input.assetId, path, kind, input),
      input
    );
  }

  async #rename(
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
    const vacant = this.#paths.vacant(to, input.assetId);
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

  async #remove(
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
  ): Result<AssetProjection, UnknownAssetError> {
    const current = this.#projector.desired(assetId);

    return current === null ?
      Err(new UnknownAssetError(assetId)) :
      Ok(current);
  }

  #writeData(
    assetId: string,
    path: string,
    kind: string,
    payload: AssetPayload
  ): Promise<AssetWriteData> {
    return writeData(
      path,
      kind,
      payload.data,
      this.#dependencies.resolve(assetId, kind, payload)
    );
  }

  async #saveIdentity(): Promise<void> {
    try {
      await this.#identity.save();
    }
    catch (error) {
      this.#logger
        .withMetadata({
          reason: asError(error).message
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

function copyContentInput<
  TInput extends CreateAssetInput | UpdateAssetInput
>(
  input: TInput
): TInput {
  return {
    ...input,
    actor: {
      ...input.actor
    },
    data: input.data === undefined
      ? undefined
      : Uint8Array.from(input.data),
    dependencies: input.dependencies?.map(
      (reference) => {
        return { ...reference };
      }
    )
  };
}
