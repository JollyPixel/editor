// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  ownedCopy,
  type AddActorOptions,
  type ConnectOptions,
  type SceneActorPlacement,
  type SceneAnchorJSON,
  type SceneComponentJSON,
  type SceneDocument,
  type SceneEnvironmentJSON
} from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { SceneAccess } from "../access/SceneAccess.ts";
import type { SceneComponents } from "../components/SceneComponents.ts";
import {
  SCENE_HISTORY_SCOPE,
  type SceneHistory
} from "../features/history/sceneHistory.ts";
import { rebaseTransform } from "../scene/sceneTransform.ts";
import type {
  ComponentFocus,
  SelectionStore
} from "../state/SelectionStore.ts";
import type { SceneAssetSlots } from "./SceneEditing.ts";

// CONSTANTS
const kActorName = "Actor";

type PickedAssets = Record<string, AssetReferenceData>;

export interface ActorMove extends SceneActorPlacement {
  id: string;
  beforeId?: string;
}

export interface SceneActionsOptions {
  document: SceneDocument;
  history: Pick<SceneHistory, "record" | "undo" | "redo">;
  selection: SelectionStore;
  components: Pick<SceneComponents, "requiredAssetSlots" | "find">;
  assetSlots: Pick<SceneAssetSlots, "name" | "pick" | "pickScene">;
  anchors: Pick<Systems.SceneAnchorsReader, "findAnchor">;
  access: Pick<SceneAccess, "can" | "readOnly">;
}

export class SceneActions {
  #document: SceneDocument;
  #access: Pick<SceneAccess, "can" | "readOnly">;
  #history: Pick<SceneHistory, "record" | "undo" | "redo">;
  #selection: SelectionStore;
  #components: Pick<SceneComponents, "requiredAssetSlots" | "find">;
  #assetSlots: Pick<SceneAssetSlots, "name" | "pick" | "pickScene">;
  #anchors: Pick<Systems.SceneAnchorsReader, "findAnchor">;

  constructor(
    options: SceneActionsOptions
  ) {
    this.#document = options.document;
    this.#history = options.history;
    this.#selection = options.selection;
    this.#components = options.components;
    this.#assetSlots = options.assetSlots;
    this.#anchors = options.anchors;
    this.#access = options.access;
  }

  undo(): boolean {
    return !this.#access.readOnly && this.#history.undo(SCENE_HISTORY_SCOPE);
  }

  redo(): boolean {
    return !this.#access.readOnly && this.#history.redo(SCENE_HISTORY_SCOPE);
  }

  addActor(
    parentId: string | null,
    anchor?: SceneAnchorJSON
  ): string | null {
    return this.#add({
      name: kActorName,
      parentId,
      anchor
    });
  }

  async addInstance(
    parentId: string | null,
    anchor?: SceneAnchorJSON
  ): Promise<string | null> {
    if (!this.#access.can("hierarchy")) {
      return null;
    }

    const prefab = await this.#assetSlots.pickScene();
    if (prefab === null) {
      return null;
    }

    return this.#add({
      name: this.#assetSlots.name(prefab),
      parentId,
      anchor,
      prefab
    });
  }

  async addComponent(
    actorId: string,
    type: string
  ): Promise<string | null> {
    if (!this.#access.can("components")) {
      return null;
    }

    const assets = await this.#pickAssets(type);
    if (
      assets === null ||
      !this.#access.can("components") ||
      !this.#document.tree.has(actorId)
    ) {
      return null;
    }

    const id = this.#document.addComponent(actorId, {
      type,
      data: structuredClone(this.#components.find(type)?.initialData ?? {}),
      assets
    });
    if (id !== null) {
      this.#selection.focus({
        ownerId: actorId,
        componentId: id
      });
    }

    return id;
  }

  canEditSelection(): boolean {
    const { primary, focused } = this.#selection;

    return primary !== null && this.#canEditFocus() && (
      focused === null ||
      this.#document.tree.component(focused.componentId) !== undefined
    );
  }

  duplicateSelection(): string[] {
    if (!this.#canEditFocus()) {
      return [];
    }

    const { focused } = this.#selection;
    if (focused !== null) {
      return this.#duplicateComponent(focused);
    }

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
    if (!this.#canEditFocus()) {
      return;
    }

    const { focused } = this.#selection;
    if (focused !== null) {
      this.#document.removeComponent(focused.componentId);

      return;
    }

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
    if (!this.#access.can("hierarchy")) {
      return;
    }

    this.#history.record(SCENE_HISTORY_SCOPE, "Move actor", () => {
      for (const { id, beforeId, ...placement } of moves) {
        this.#document.move(id, placement, {
          transform: rebaseTransform(this.#document.tree, this.#anchors, id, placement),
          ...beforeId === undefined ? {} : { beforeId }
        });
      }
    });
  }

  removeComponent(
    id: string
  ): boolean {
    return this.#access.can("components") && this.#document.removeComponent(id);
  }

  moveComponent(
    id: string,
    beforeId?: string
  ): boolean {
    return this.#access.can("components") && this.#document.moveComponent(id, beforeId);
  }

  connect(
    componentId: string,
    connection: ConnectOptions
  ): string | null {
    return this.#access.can("signals") ?
      this.#document.connect(componentId, connection) :
      null;
  }

  disconnect(
    componentId: string,
    id: string
  ): boolean {
    return this.#access.can("signals") && this.#document.disconnect(componentId, id);
  }

  changeEnvironment(
    environment: SceneEnvironmentJSON
  ): boolean {
    return this.#access.can("environment") &&
      this.#document.changeEnvironment(environment);
  }

  #canEditFocus(): boolean {
    return this.#access.can(this.#selection.focused === null ? "hierarchy" : "components");
  }

  #add(
    options: AddActorOptions & { parentId: string | null; }
  ): string | null {
    if (!this.#access.can("hierarchy")) {
      return null;
    }

    const { parentId, anchor, ...rest } = options;
    const placed = parentId !== null && this.#document.tree.has(parentId);
    const id = this.#document.addActor({
      ...rest,
      parentId: placed ? parentId : null,
      ...placed && anchor !== undefined ? { anchor } : {}
    });
    if (id !== null) {
      this.#selection.select([id]);
    }

    return id;
  }

  #duplicateComponent(
    { ownerId, componentId }: ComponentFocus
  ): string[] {
    const components = this.#document.tree.actor(ownerId)?.components ?? [];
    const index = components.findIndex(({ id }) => id === componentId);
    const source = components[index];
    if (source === undefined) {
      return [];
    }

    const { type, data, assets } = ownedCopy<SceneComponentJSON>(source);
    const copyId = this.#document.addComponent(ownerId, {
      type,
      data,
      assets,
      beforeId: components[index + 1]?.id
    });
    if (copyId === null) {
      return [];
    }
    this.#selection.focus({
      ownerId,
      componentId: copyId
    });

    return [copyId];
  }

  async #pickAssets(
    type: string
  ): Promise<PickedAssets | null> {
    const assets: PickedAssets = {};
    for (const [slot, assetType] of Object.entries(this.#components.requiredAssetSlots(type))) {
      const picked = await this.#assetSlots.pick(assetType, null);
      if (picked === null) {
        return null;
      }
      assets[slot] = picked;
    }

    return assets;
  }
}
