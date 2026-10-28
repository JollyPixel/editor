// Import Third-party Dependencies
import type {
  AddActorOptions,
  SceneDocument
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { SceneComponents } from "../components/SceneComponents.ts";
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

export interface ActorMove {
  id: string;
  parentId: string | null;
  beforeId?: string;
}

export interface SceneActionsOptions {
  document: SceneDocument;
  history: Pick<SceneHistory, "record">;
  selection: SelectionStore;
  components: Pick<SceneComponents, "assetSlots">;
  assetSlots: Pick<SceneAssetSlots, "name" | "pick" | "pickScene">;
}

export class SceneActions {
  #document: SceneDocument;
  #history: Pick<SceneHistory, "record">;
  #selection: SelectionStore;
  #components: Pick<SceneComponents, "assetSlots">;
  #assetSlots: Pick<SceneAssetSlots, "name" | "pick" | "pickScene">;

  constructor(
    options: SceneActionsOptions
  ) {
    this.#document = options.document;
    this.#history = options.history;
    this.#selection = options.selection;
    this.#components = options.components;
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

    const [firstAsset] = components.flatMap(
      ({ assets }) => Object.values(assets).filter((asset) => asset !== null)
    );

    return this.#add({
      name: firstAsset === undefined ?
        preset.label :
        this.#assetSlots.name(firstAsset),
      parentId,
      components
    });
  }

  async addInstance(
    parentId: string | null
  ): Promise<string | null> {
    const prefab = await this.#assetSlots.pickScene();
    if (prefab === null) {
      return null;
    }

    return this.#add({
      name: this.#assetSlots.name(prefab),
      parentId,
      prefab
    });
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
    const { tree } = this.#document;
    const roots = tree.topmostIds(this.#selection.ids);
    const copies = this.#history.record(
      SCENE_HISTORY_SCOPE,
      "Duplicate",
      () => roots.flatMap((id) => {
        const copy = tree.copySubtree(id);
        const added = this.#document.addSubtree(
          copy,
          tree.findNextSibling(id)
        );

        return added ? [copy[0].id] : [];
      })
    );
    if (copies.length > 0) {
      this.#selection.select(copies);
    }

    return copies;
  }

  removeSelection(): void {
    const roots = this.#document.tree.topmostIds(this.#selection.ids);
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

  #add(
    options: AddActorOptions & { parentId: string | null; }
  ): string | null {
    const { parentId } = options;
    const id = this.#document.addActor({
      ...options,
      parentId: parentId !== null && this.#document.tree.has(parentId) ?
        parentId :
        null
    });
    if (id !== null) {
      this.#selection.select([id]);
    }

    return id;
  }

  async #pickAssets(
    type: string
  ): Promise<PickedAssets | null> {
    const assets: PickedAssets = {};
    for (const [slot, assetType] of Object.entries(this.#components.assetSlots(type))) {
      const picked = await this.#assetSlots.pick(assetType, null);
      if (picked === null) {
        return null;
      }
      assets[slot] = picked;
    }

    return assets;
  }
}
