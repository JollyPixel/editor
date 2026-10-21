// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../../model/kinds/AssetKindRegistry.ts";
import type { AssetIndex } from "../AssetIndex.ts";
import {
  ASSET_CREATED,
  ASSET_DELETED,
  ASSET_RENAMED,
  ASSET_UPDATED,
  writeData,
  type AssetEventDataMap,
  type AssetPartRef,
  type AssetPartsWrite,
  type AssetWriteData
} from "../../model/events/AssetEvents.ts";
import { ASSET_PART_ID_PATTERN } from "../../model/events/AssetEvents.schema.ts";
import type { AssetProjector } from "../projection/AssetProjector.ts";
import type { AssetProjection } from "../projection/applyProjection.ts";
import {
  silentLogger,
  type Logger
} from "../../common/logger.ts";
import { asError } from "../../common/asError.ts";
import { TaskChain } from "../../common/TaskChain.ts";
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
} from "../../model/PathConflictPolicy.ts";
export type * from "./AssetWriteInput.ts";

export interface AssetWriterOptions {
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  kinds: AssetKindRegistry;
  projector: AssetProjector;
  assetIndex: AssetIndex;
  logger?: Logger;
}

export class AssetWriter {
  #eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  #kinds: AssetKindRegistry;
  #projector: AssetProjector;
  #assetIndex: AssetIndex;
  #logger: Logger;
  #paths: AssetPathAllocator;
  #planner: AssetCreationPlanner;
  #dependencies: DependencyReader;
  #writes = new TaskChain();

  constructor(
    options: AssetWriterOptions
  ) {
    this.#eventStore = options.eventStore;
    this.#kinds = options.kinds;
    this.#projector = options.projector;
    this.#assetIndex = options.assetIndex;
    this.#logger = options.logger ?? silentLogger();
    this.#paths = new AssetPathAllocator({
      projector: options.projector,
      assetIndex: options.assetIndex
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
    if (input.restoredFrom !== undefined) {
      snapshot.restoredFrom = { ...input.restoredFrom };
    }

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

    await this.#saveIndex();

    return appended;
  }

  async #appendCreated(
    asset: PlannedAsset,
    options: WriteOptions
  ): Promise<Result<EventStore.Event, Error>> {
    const data = await this.#writeData(
      asset.assetId,
      asset.path,
      asset.kind,
      asset,
      null
    );
    if (!data.ok) {
      return data;
    }

    const appended = this.#append(
      asset.assetId,
      asset.kind,
      ASSET_CREATED,
      data.val,
      options
    );
    if (appended.ok) {
      this.#assetIndex.set({
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
      this.#assetIndex.removeById(asset.assetId);
    }
    if (written.length > 0) {
      await this.#saveIndex();
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
    const data = await this.#writeData(
      input.assetId,
      path,
      kind,
      input,
      current.val
    );
    if (!data.ok) {
      return data;
    }

    const { restoredFrom } = input;

    return this.#append(
      input.assetId,
      kind,
      ASSET_UPDATED,
      restoredFrom === undefined ? data.val : { ...data.val, restoredFrom },
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

    this.#assetIndex.set({
      id: input.assetId,
      path: to,
      kind: current.kind
    });
    await this.#saveIndex();

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

    this.#assetIndex.removeById(input.assetId);
    await this.#saveIndex();

    return appended;
  }

  #current(
    assetId: string
  ): Result<AssetProjection, UnknownAssetError> {
    const current = this.#projector.desired(assetId);
    if (current !== null) {
      return Ok(current);
    }

    const error = new UnknownAssetError(assetId);

    return Err(error);
  }

  async #writeData(
    assetId: string,
    path: string,
    kind: string,
    payload: AssetPayload,
    current: AssetProjection | null
  ): Promise<Result<AssetWriteData, Error>> {
    const parts = this.#partsWrite(kind, payload, current);
    if (!parts.ok) {
      return parts;
    }

    return Ok(await writeData(
      path,
      kind,
      payload.data,
      this.#dependencies.resolve(assetId, kind, payload),
      parts.val
    ));
  }

  #partsWrite(
    kind: string,
    payload: AssetPayload,
    current: AssetProjection | null
  ): Result<AssetPartsWrite | undefined, Error> {
    const parted = this.#kinds.has(kind) &&
      this.#kinds.get(kind).parts !== undefined;
    if (!parted) {
      if (payload.parts === undefined) {
        return Ok(undefined);
      }

      const error = new TypeError(
        `Asset kind "${kind}" declares no parts.`
      );

      return Err(error);
    }

    const changes = payload.parts ?? new Map<string, Uint8Array | null>();
    const written = new Map<string, Uint8Array>();
    const kept = new Map<string, AssetPartRef>();
    for (const [partId, data] of changes) {
      if (!ASSET_PART_ID_PATTERN.test(partId)) {
        const error = new TypeError(`Invalid asset part id "${partId}".`);

        return Err(error);
      }
      if (data !== null) {
        written.set(partId, data);
      }
    }
    for (const [partId, ref] of current?.parts ?? []) {
      if (!changes.has(partId)) {
        kept.set(partId, ref);
      }
    }

    return Ok({
      written,
      kept
    });
  }

  async #saveIndex(): Promise<void> {
    try {
      await this.#assetIndex.save();
    }
    catch (error) {
      this.#logger
        .withMetadata({
          reason: asError(error).message
        })
        .warn("asset index not persisted");
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
      actor: options.actor,
      expectedVersion: options.expectedVersion
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
    parts: input.parts === undefined
      ? undefined
      : new Map(
        Array.from(
          input.parts,
          ([partId, data]) => [
            partId,
            data === null ? null : Uint8Array.from(data)
          ]
        )
      ),
    dependencies: input.dependencies?.map(
      (reference) => {
        return { ...reference };
      }
    )
  };
}
