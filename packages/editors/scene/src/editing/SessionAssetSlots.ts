// Import Third-party Dependencies
import {
  AssetPath,
  type AssetReferenceData,
  type AssetType
} from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import type { EditorSession } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { SceneAssetSlots } from "./SceneEditing.ts";

// CONSTANTS
const kMissingName = "Missing asset";

export interface SessionAssetSlotsOptions {
  session: Pick<EditorSession, "catalog" | "pickAsset">;
  descriptors: Iterable<AssetKindDescriptor>;
  open: ((assetId: string) => void) | null;
}

export class SessionAssetSlots implements SceneAssetSlots {
  readonly open: ((reference: AssetReferenceData) => void) | null;

  #session: Pick<EditorSession, "catalog" | "pickAsset">;
  #descriptors: ReadonlyMap<string, AssetKindDescriptor>;

  constructor(
    options: SessionAssetSlotsOptions
  ) {
    const { open } = options;

    this.#session = options.session;
    this.#descriptors = new Map(
      Array.from(options.descriptors, (descriptor) => [descriptor.kind, descriptor])
    );
    this.open = open === null ?
      null :
      (reference) => open(reference.id);
  }

  name(
    reference: AssetReferenceData
  ): string {
    const record = this.#session.catalog.record(reference.id);

    return record === undefined ?
      kMissingName :
      new AssetPath(record.path).name;
  }

  async pick(
    type: AssetType<unknown>,
    current: AssetReferenceData | null
  ): Promise<AssetReferenceData | null> {
    const descriptor = this.#descriptors.get(type.kind.value);
    if (descriptor === undefined) {
      throw new Error(
        `SessionAssetSlots: no "${type.kind.value}" descriptor to pick from.`
      );
    }

    return this.#session.pickAsset({
      kinds: [descriptor],
      title: `Pick a ${descriptor.label.toLowerCase()}`,
      current
    });
  }

  subscribe(
    listener: () => void
  ): () => void {
    const { catalog } = this.#session;
    catalog.on("change", listener);

    return () => catalog.off("change", listener);
  }
}
