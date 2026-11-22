// Import Third-party Dependencies
import type {
  AssetCommandHeader,
  AssetKindHandler
} from "@jolly-pixel/asset-server";
import { DependencyIndex } from "@jolly-pixel/asset-server/client";
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import type {
  AssetStudio,
  CatalogReader
} from "../asset/AssetOpening.ts";
import type { GolemAsset } from "../asset/GolemAsset.ts";
import type {
  GolemAssets,
  GolemKindContribution,
  GolemKindList,
  GolemKindName
} from "../kind/golemKind.ts";
import { KindMismatchError } from "../errors/KindMismatchError.ts";
import { UnknownAssetError } from "../errors/UnknownAssetError.ts";
import { TestRoom } from "./TestRoom.ts";

export type TestAssetRecord = NonNullable<ReturnType<CatalogReader["record"]>>;

export interface TestStudioOptions {
  kinds: GolemKindList;
  /**
   * @default []
   */
  kindPackages?: readonly unknown[];
}

export interface HostedAsset<TState> {
  readonly id: string;
  /**
   * The studio's state of the asset.
   */
  readonly state: TState;
  readonly room: TestRoom;
}

export class TestStudio {
  readonly dependencies = new DependencyIndex();

  #kinds: ReadonlyMap<string, GolemKindContribution<GolemAsset>>;
  #records = new Map<string, TestAssetRecord>();
  #rooms = new Map<string, TestRoom>();
  #opened = new Map<string, Promise<GolemAsset>>();
  #signal = new AbortController().signal;
  #studio: AssetStudio;

  constructor(
    options: TestStudioOptions
  ) {
    const { kinds, kindPackages = [] } = options;
    this.#kinds = new Map(
      kinds.map((contribution) => [contribution.kind, contribution])
    );
    this.#studio = {
      catalog: {
        record: (assetId) => this.#records.get(assetId),
        records: () => this.#records.values(),
        dependencies: this.dependencies
      },
      kindPackages,
      open: (assetId, kind) => this.open(assetId, kind)
    };
  }

  host<
    TState,
    TCommand extends AssetCommandHeader,
    TRelay extends object = never
  >(
    path: string,
    handler: AssetKindHandler<TState, TCommand, TRelay>
  ): HostedAsset<TState> {
    const server = new LiveAssetRoom(handler);
    const id = `${handler.kind}-${this.#records.size + 1}`;
    const room = new TestRoom(`${handler.kind}:${id}`, server);
    this.record({
      id,
      kind: handler.kind,
      path
    });
    this.#rooms.set(id, room);

    return {
      id,
      state: server.state,
      room
    };
  }

  record(
    record: TestAssetRecord
  ): void {
    this.#records.set(record.id, record);
  }

  open<TKind extends GolemKindName>(
    assetId: string,
    kind: TKind
  ): Promise<GolemAssets[TKind]> {
    let opened = this.#opened.get(assetId);
    if (opened === undefined) {
      opened = this.#open(assetId, kind);
      this.#opened.set(assetId, opened);
      opened.catch(() => this.#opened.delete(assetId));
    }

    return opened as Promise<GolemAssets[TKind]>;
  }

  async #open(
    assetId: string,
    kind: string
  ): Promise<GolemAsset> {
    const record = this.#records.get(assetId);
    if (record === undefined) {
      throw new UnknownAssetError(assetId);
    }
    if (record.kind !== kind) {
      throw new KindMismatchError(assetId, record.kind, [kind]);
    }

    const contribution = this.#kinds.get(kind);
    const room = this.#rooms.get(assetId);
    if (contribution === undefined || room === undefined) {
      throw new TypeError(
        `The test studio cannot open ${kind} "${assetId}": host it and ` +
        "list its contribution in kinds."
      );
    }

    const asset = contribution.open({
      assetId,
      room,
      signal: this.#signal,
      onClose: () => this.#opened.delete(assetId),
      studio: this.#studio
    });
    try {
      await asset.ready;
    }
    catch (error) {
      asset.close();

      throw error;
    }

    return asset;
  }
}
