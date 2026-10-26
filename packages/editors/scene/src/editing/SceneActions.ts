// Import Third-party Dependencies
import type { SceneDocument } from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { componentAssetSlots } from "../components/sceneComponents.ts";
import type {
  ActorPreset,
  PickedAssets
} from "../features/hierarchy/model/ActorPreset.ts";
import {
  SCENE_HISTORY_SCOPE,
  type SceneHistory
} from "../features/history/sceneHistory.ts";
import { rebaseTransform } from "../scene/sceneTransform.ts";
import type { SelectionStore } from "../state/SelectionStore.ts";
import type { SceneAssetSlots } from "./SceneEditing.ts";
import { SubtreeCopy } from "./SubtreeCopy.ts";

export interface ActorMove {
  id: string;
  parentId: string | null;
  beforeId?: string;
}

export interface SceneActionsOptions {
  document: SceneDocument;
  history: Pick<SceneHistory, "record">;
  selection: SelectionStore;
  assetSlots: Pick<SceneAssetSlots, "name" | "pick">;
}

export class SceneActions {
  #document: SceneDocument;
  #history: Pick<SceneHistory, "record">;
  #selection: SelectionStore;
  #assetSlots: Pick<SceneAssetSlots, "name" | "pick">;

  constructor(
    options: SceneActionsOptions
  ) {
    this.#document = options.document;
    this.#history = options.history;
    this.#selection = options.selection;
    this.#assetSlots = options.assetSlots;
  }

  async addActor(
    preset: ActorPreset,
    parentId: string | null
  ): Promise<string | null> {
    const components = await preset.createComponents(
      (type) => this.#pickAssets(type)
    );
    if (components === null) {
      return null;
    }

    const { tree } = this.#document;
    const [firstAsset] = components.flatMap(
      ({ assets }) => Object.values(assets).filter((asset) => asset !== null)
    );
    const id = this.#document.addActor({
      name: firstAsset === undefined ?
        preset.label :
        this.#assetSlots.name(firstAsset),
      parentId: parentId !== null && tree.has(parentId) ? parentId : null,
      components
    });
    if (id !== null) {
      this.#selection.select([id]);
    }

    return id;
  }

  async addComponent(
    actorId: string,
    type: string
  ): Promise<string | null> {
    const assets = await this.#pickAssets(type);
    if (assets === null || !this.#document.tree.has(actorId)) {
      return null;
    }

    return this.#document.addComponent(actorId, {
      type,
      assets
    });
  }

  duplicateSelection(): string[] {
    const roots = this.#selectedRoots();
    const copies = this.#history.record(
      SCENE_HISTORY_SCOPE,
      "Duplicate",
      () => roots.flatMap((id) => {
        const copy = new SubtreeCopy(this.#document.tree.subtreeFrom(id));
        const added = this.#document.addSubtree(
          copy.actors,
          this.#document.tree.findNextSibling(id)
        );

        return added ? [copy.rootId] : [];
      })
    );
    if (copies.length > 0) {
      this.#selection.select(copies);
    }

    return copies;
  }

  removeSelection(): void {
    const roots = this.#selectedRoots();
    if (roots.length === 0) {
      return;
    }

    this.#history.record(SCENE_HISTORY_SCOPE, "Delete", () => {
      for (const id of roots) {
        this.#document.remove(id);
      }
    });
  }

  move(
    moves: readonly ActorMove[]
  ): void {
    this.#history.record(SCENE_HISTORY_SCOPE, "Move actor", () => {
      for (const { id, parentId, beforeId } of moves) {
        this.#document.move(id, parentId, {
          transform: rebaseTransform(this.#document.tree, id, parentId),
          ...beforeId === undefined ? {} : { beforeId }
        });
      }
    });
  }

  async #pickAssets(
    type: string
  ): Promise<PickedAssets | null> {
    const assets: PickedAssets = {};
    for (const [slot, assetType] of Object.entries(componentAssetSlots(type))) {
      const picked = await this.#assetSlots.pick(assetType, null);
      if (picked === null) {
        return null;
      }
      assets[slot] = picked;
    }

    return assets;
  }

  #selectedRoots(): string[] {
    const { tree } = this.#document;
    const selected = new Set(
      this.#selection.ids.filter((id) => tree.has(id))
    );

    return [...tree.actorIds()].filter((id) => selected.has(id) &&
      ![...tree.ancestorIds(id)].some((ancestorId) => selected.has(ancestorId)));
  }
}
