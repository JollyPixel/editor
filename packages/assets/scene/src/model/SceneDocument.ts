// Import Third-party Dependencies
import {
  CommandDocument,
  type CommandChange,
  type CommandState
} from "@jolly-pixel/history";
import {
  randomId,
  withBefore
} from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type { ComponentChange } from "./componentChange.ts";
import { SceneTree, type SceneTreeReader } from "./SceneTree.ts";
import { SceneTransform } from "./SceneTransform.ts";
import { invert } from "./history/sceneInverse.ts";
import {
  captureSceneImage,
  restoreSceneImages,
  type SceneImage,
  type SceneImages
} from "./history/sceneImages.ts";
import type {
  AssetReferenceJSON,
  JSONObject,
  SceneActorJSON,
  SceneCommand,
  SceneComponentJSON,
  SceneEnvironmentPatch,
  SceneSnapshot,
  SceneTransformJSON,
  SceneTransformPatch
} from "../network/types.ts";

export type { SceneImage, SceneImages };

export type SceneChange = CommandChange<SceneCommand, SceneImage>;

export interface AddActorOptions {
  id?: string;
  name: string;
  parentId?: string | null;
  /**
   * The sibling to land before; last when omitted.
   */
  beforeId?: string;
  visible?: boolean;
  transform?: Partial<SceneTransformJSON>;
  components?: readonly SceneComponentJSON[];
}

export interface MoveActorOptions {
  /**
   * The transform relative to the new parent.
   */
  transform: SceneTransformJSON;
  /**
   * The sibling to land before; last when omitted.
   */
  beforeId?: string;
}

export interface AddComponentOptions {
  id?: string;
  type: string;
  data?: JSONObject;
  assets?: Record<string, AssetReferenceJSON | null>;
  /**
   * The component to land before; last when omitted.
   */
  beforeId?: string;
}

export class SceneDocument extends CommandDocument<
  SceneCommand,
  SceneSnapshot,
  SceneImage
> {
  readonly tree: SceneTreeReader;

  constructor() {
    const tree = new SceneTree();
    super(sceneState(tree));
    this.tree = tree;
  }

  addActor(
    options: AddActorOptions
  ): string | null {
    const {
      id = randomId(),
      name,
      parentId = null,
      beforeId,
      visible = true,
      transform,
      components = []
    } = options;
    const added = this.addSubtree([{
      id,
      name,
      parentId,
      visible,
      transform: SceneTransform.create(transform),
      components: [...components]
    }], beforeId);

    return added ? id : null;
  }

  addSubtree(
    actors: readonly SceneActorJSON[],
    beforeId?: string
  ): boolean {
    return this.commit({
      action: "actor-added",
      actors: [...actors],
      ...withBefore(beforeId)
    });
  }

  remove(
    id: string
  ): boolean {
    return this.commit({
      action: "actor-removed",
      id
    });
  }

  rename(
    id: string,
    name: string
  ): boolean {
    return this.commit({
      action: "actor-renamed",
      id,
      name
    });
  }

  changeVisibility(
    id: string,
    visible: boolean
  ): boolean {
    return this.commit({
      action: "actor-visibility",
      id,
      visible
    });
  }

  move(
    id: string,
    parentId: string | null,
    options: MoveActorOptions
  ): boolean {
    return this.commit({
      action: "actor-moved",
      id,
      parentId,
      transform: options.transform,
      ...withBefore(options.beforeId)
    });
  }

  transform(
    id: string,
    transform: SceneTransformPatch
  ): boolean {
    return this.commit({
      action: "actor-transformed",
      id,
      transform
    });
  }

  addComponent(
    actorId: string,
    options: AddComponentOptions
  ): string | null {
    const {
      id = randomId(),
      type,
      data = {},
      assets = {},
      beforeId
    } = options;
    const added = this.commit({
      action: "component-added",
      actorId,
      component: {
        id,
        type,
        data,
        assets
      },
      ...withBefore(beforeId)
    });

    return added ? id : null;
  }

  removeComponent(
    id: string
  ): boolean {
    const actorId = this.tree.componentOwner(id);

    return actorId !== undefined && this.commit({
      action: "component-removed",
      actorId,
      id
    });
  }

  moveComponent(
    id: string,
    beforeId?: string
  ): boolean {
    const actorId = this.tree.componentOwner(id);

    return actorId !== undefined && this.commit({
      action: "component-moved",
      actorId,
      id,
      ...withBefore(beforeId)
    });
  }

  changeComponent(
    id: string,
    change: ComponentChange
  ): boolean {
    const unset = [...change.unset ?? []];

    return this.commit({
      action: "component-changed",
      id,
      data: change.data ?? {},
      ...unset.length === 0 ? {} : { unset }
    });
  }

  changeComponentAssets(
    id: string,
    assets: Record<string, AssetReferenceJSON | null>
  ): boolean {
    return this.commit({
      action: "component-assets-changed",
      id,
      assets
    });
  }

  changeEnvironment(
    environment: SceneEnvironmentPatch
  ): boolean {
    return this.commit({
      action: "environment-changed",
      environment
    });
  }
}

function sceneState(
  tree: SceneTree
): CommandState<SceneCommand, SceneSnapshot, SceneImage> {
  return {
    accepts: (command) => tree.accepts(command),
    placeable: (command) => tree.placeable(command),
    apply: (command) => tree.apply(command),
    load: (snapshot) => tree.load(snapshot),
    captureImage: (command) => captureSceneImage(tree, command),
    invert: (command) => invert(tree, command),
    restored: (images) => restoreSceneImages(tree, images)
  };
}
