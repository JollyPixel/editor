// Import Third-party Dependencies
import {
  SCENE_SELECTION_PRESENCE_KEY,
  sceneCommandActor,
  type SceneCommand,
  type SceneComponentJSON,
  type SceneSnapshot,
  type SceneTransformJSON,
  type SceneTreeReader,
  type SyncedSceneDocument
} from "@jolly-pixel/asset.scene/client";
import type { SceneEditableKind } from "@jolly-pixel/asset.scene/server";
import type { PeerMetadata } from "@jolly-pixel/network/client";
import type { SceneComponentTypes } from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  GolemAsset,
  type AssetOpening
} from "../GolemAsset.ts";
import {
  actorList,
  componentJSON,
  type ActorSpec,
  type AddedActor,
  type ComponentSpec
} from "./ActorSpec.ts";
import { SceneRefs } from "./SceneRefs.ts";

export interface AddActorsOptions {
  /**
   * The name or id of the actor the new actors go under; `null` for the
   * scene root.
   * @default null
   */
  parentId?: string | null;
}

export interface ActorTransform {
  /**
   * An actor name or id.
   */
  actor: string;
  /**
   * Only the fields that change.
   */
  transform: Partial<SceneTransformJSON>;
}

export interface MoveActorsOptions {
  /**
   * The name or id of the new parent; `null` for the scene root.
   */
  parent: string | null;
  /**
   * The name or id of the child the actors go before.
   * @default the actors go after the parent's last child
   */
  before?: string;
}

export interface AddedComponent {
  id: string;
  type: string;
}

export class SceneAsset extends GolemAsset<
  SceneCommand,
  SyncedSceneDocument
> {
  #refs: SceneRefs;
  #components: SceneComponentTypes;

  constructor(
    opening: AssetOpening,
    kind: SceneEditableKind
  ) {
    super(opening, kind);
    this.#refs = new SceneRefs(this.tree, opening.catalog);
    this.#components = opening.manifest.sceneComponents();
  }

  get tree(): SceneTreeReader {
    return this.synced.document.tree;
  }

  read(): SceneSnapshot {
    return this.tree.toJSON();
  }

  async addActors(
    specs: Iterable<ActorSpec>,
    options: AddActorsOptions = {}
  ): Promise<AddedActor[]> {
    const parentId = this.#parent(options.parentId ?? null);
    const lists = Array.from(
      specs,
      (spec) => actorList(spec, parentId, this.#refs)
    );
    await this.applyInBatches(lists.map((actors): SceneCommand => {
      return {
        action: "actor-added",
        actors
      };
    }));

    return lists.flat().map(({ id, name }) => {
      return {
        id,
        name
      };
    });
  }

  async transformActors(
    changes: Iterable<ActorTransform>
  ): Promise<void> {
    await this.applyInBatches(Array.from(changes, (change): SceneCommand => {
      return {
        action: "actor-transformed",
        id: this.#refs.actor(change.actor),
        transform: change.transform
      };
    }));
  }

  async moveActors(
    actors: Iterable<string>,
    options: MoveActorsOptions
  ): Promise<void> {
    const parentId = this.#parent(options.parent);
    const beforeId = options.before === undefined ?
      undefined :
      this.#refs.actor(options.before);
    await this.applyInBatches(Array.from(actors, (actor): SceneCommand => {
      const id = this.#refs.actor(actor);

      return {
        action: "actor-moved",
        id,
        parentId,
        transform: this.tree.actor(id)!.transform,
        ...beforeId === undefined ? {} : { beforeId }
      };
    }));
  }

  async removeActors(
    actors: Iterable<string>
  ): Promise<void> {
    const ids = Array.from(actors, (actor) => this.#refs.actor(actor));
    await this.applyInBatches(
      this.tree.topmostIds(ids).map((id): SceneCommand => {
        return {
          action: "actor-removed",
          id
        };
      })
    );
  }

  async addComponents(
    actor: string,
    specs: Iterable<ComponentSpec>
  ): Promise<AddedComponent[]> {
    const actorId = this.#refs.actor(actor);
    if (!this.tree.canHoldComponents(actorId)) {
      throw new TypeError(
        `Actor ${JSON.stringify(actor)} is a prefab instance: it cannot ` +
        "take components."
      );
    }

    const components = Array.from(
      specs,
      (spec) => componentJSON(spec, this.#refs)
    );
    await this.applyInBatches(components.map((component): SceneCommand => {
      return {
        action: "component-added",
        actorId,
        component
      };
    }));

    return components.map(({ id, type }) => {
      return {
        id,
        type
      };
    });
  }

  protected override guard(
    commands: readonly SceneCommand[]
  ): void {
    const added = new Map<string, string>();
    const check = (component: SceneComponentJSON) => {
      this.#components.assertValid(component.type, component.assets);
      added.set(component.id, component.type);
    };
    for (const command of commands) {
      switch (command.action) {
        case "actor-added":
          command.actors.forEach(({ components }) => components.forEach(check));
          break;
        case "component-added":
          check(command.component);
          break;
        case "component-assets-changed": {
          const type = added.get(command.id) ??
            this.tree.component(command.id)?.type;
          if (type !== undefined) {
            this.#components.assertValid(type, command.assets);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  protected focus(
    commands: readonly SceneCommand[]
  ): PeerMetadata | null {
    for (const command of commands.toReversed()) {
      const actorId = sceneCommandActor(this.tree, command);
      if (actorId !== null && this.tree.has(actorId)) {
        return { [SCENE_SELECTION_PRESENCE_KEY]: actorId };
      }
    }

    return null;
  }

  #parent(
    nameOrId: string | null
  ): string | null {
    const parentId = nameOrId === null ? null : this.#refs.actor(nameOrId);
    if (!this.tree.canContain(parentId)) {
      throw new TypeError(
        `Actor ${JSON.stringify(nameOrId)} is a prefab instance: it cannot ` +
        "hold children."
      );
    }

    return parentId;
  }
}
