// Import Third-party Dependencies
import {
  findNextId,
  insertedBefore,
  InvalidEntryError,
  OrderedTree
} from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import { SCENE_KIND } from "../../asset/scene.ts";
import type {
  AssetReferenceJSON,
  SceneActorJSON,
  SceneActorPlacement,
  SceneActorView,
  SceneCommand,
  SceneComponentView,
  SceneEnvironmentView,
  SceneSnapshot
} from "../../network/types.ts";
import { ComponentChange } from "../changes/ComponentChange.ts";
import { ComponentOwners } from "./ComponentOwners.ts";
import {
  OverrideChange,
  type OverrideCommand
} from "../changes/OverrideChange.ts";
import { ownedCopy } from "../ownedCopy.ts";
import { SceneEnvironment } from "../changes/SceneEnvironment.ts";
import { SceneTransform } from "../changes/SceneTransform.ts";
import {
  actorReferences,
  rebindActor
} from "./sceneReferences.ts";
import { copySubtree } from "./subtreeCopy.ts";

// CONSTANTS
export const COMPONENT_DATA_MAX_LENGTH = 65_536;

export type SceneTreeReader = Pick<
  SceneTree,
  | "size"
  | "environment"
  | "has"
  | "canContain"
  | "canHoldComponents"
  | "actor"
  | "actors"
  | "actorIds"
  | "ancestorIds"
  | "findNextSibling"
  | "subtree"
  | "copySubtree"
  | "topmostIds"
  | "component"
  | "componentOwner"
  | "findNextComponent"
  | "toJSON"
>;

interface ActorListContext {
  hasActor(id: string): boolean;
  hasComponent(id: string): boolean;
  isOuterParent(actor: SceneActorView, index: number): boolean;
  isOwnScene(sceneId: string): boolean;
}

export interface SceneTreeOptions {
  sceneId?: string;
}

export class SceneTree {
  #actors = new OrderedTree<SceneActorView>({
    entry: "actor",
    canContain: (actor) => !isPrefabInstance(actor)
  });
  #owners = new ComponentOwners();
  #environment: SceneEnvironmentView = SceneEnvironment.create();
  #sceneId: string | null;

  constructor(
    options: SceneTreeOptions = {}
  ) {
    this.#sceneId = options.sceneId ?? null;
  }

  get size(): number {
    return this.#actors.size;
  }

  get environment(): SceneEnvironmentView {
    return this.#environment;
  }

  has(
    id: string
  ): boolean {
    return this.#actors.has(id);
  }

  canContain(
    id: string | null
  ): boolean {
    return this.#actors.isParent(id);
  }

  canHoldComponents(
    id: string
  ): boolean {
    const actor = this.#actors.peek(id);

    return actor !== undefined && !isPrefabInstance(actor);
  }

  actor(
    id: string
  ): SceneActorView | undefined {
    return this.#actors.peek(id);
  }

  actors(): IterableIterator<SceneActorView> {
    return this.#actors.scan();
  }

  * actorIds(): IterableIterator<string> {
    for (const actor of this.#actors.scan()) {
      yield actor.id;
    }
  }

  ancestorIds(
    id: string
  ): IterableIterator<string> {
    return this.#actors.ancestorIds(id);
  }

  findNextSibling(
    id: string
  ): string | undefined {
    return this.#actors.findNextSibling(id);
  }

  subtree(
    id: string
  ): SceneActorView[] {
    return this.#actors.peekSubtree(id);
  }

  copySubtree(
    id: string
  ): SceneActorJSON[] {
    const source = this.#actors.peekSubtree(id);
    const [root] = source;
    if (root === undefined) {
      return [];
    }
    const siblingNames = new Set(
      this.#actors.peekChildren(root.parentId).map(({ name }) => name)
    );

    return copySubtree(source, siblingNames);
  }

  topmostIds(
    ids: Iterable<string>
  ): string[] {
    const wanted = new Set(ids);

    return [...this.#actors.scan()]
      .map((actor) => actor.id)
      .filter((id) => wanted.has(id) &&
        ![...this.#actors.ancestorIds(id)].some((parentId) => wanted.has(parentId)));
  }

  component(
    id: string
  ): SceneComponentView | undefined {
    return this.#peekOwner(id)?.components.find(
      (component) => component.id === id
    );
  }

  componentOwner(
    id: string
  ): string | undefined {
    return this.#owners.owner(id);
  }

  findNextComponent(
    id: string
  ): string | undefined {
    const owner = this.#peekOwner(id);
    if (owner === undefined) {
      return undefined;
    }

    return findNextId(owner.components.map((component) => component.id), id);
  }

  references(): AssetReferenceJSON[] {
    const references = new Map<string, AssetReferenceJSON>();
    for (const actor of this.#actors.scan()) {
      for (const { id, kind } of actorReferences(actor)) {
        references.set(`${kind}:${id}`, {
          id,
          kind
        });
      }
    }

    return [...references.values()];
  }

  rebind(
    idMap: ReadonlyMap<string, string>
  ): void {
    for (const id of this.actorIds()) {
      this.#actors.update(id, (actor) => rebindActor(actor, idMap));
    }
  }

  placeable(
    command: SceneCommand
  ): SceneCommand {
    if (!("beforeId" in command) || this.#hasSlot(command)) {
      return command;
    }

    const { beforeId: _beforeId, ...placed } = command;

    return placed;
  }

  accepts(
    command: SceneCommand
  ): boolean {
    if (!this.#hasSlot(command)) {
      return false;
    }

    switch (command.action) {
      case "actor-added":
        return this.#canAdd(command.actors);
      case "actor-removed":
      case "actor-renamed":
      case "actor-visibility":
      case "actor-transformed":
        return this.#actors.has(command.id);
      case "actor-moved":
        return !isAnchorWithoutParent(command) &&
          this.#actors.canMove(command.id, command.parentId, command.beforeId);
      case "component-added":
        return this.canHoldComponents(command.actorId) &&
          !this.#owners.has(command.component.id) &&
          isPlainId(command.component.id) &&
          fitsDataLimit(command.component.data);
      case "component-removed":
      case "component-moved":
        return this.#owners.owns(command.actorId, command.id);
      case "component-changed":
        return this.#canChangeComponent(command);
      case "component-assets-changed":
        return this.#owners.has(command.id);
      case "actor-overridden":
      case "component-overridden":
        return this.#canOverride(command);
      case "environment-changed":
        return true;
    }
  }

  apply(
    command: SceneCommand
  ): void {
    switch (command.action) {
      case "actor-added":
        this.#insert(command.actors, command.beforeId);
        break;

      case "actor-removed":
        for (const actor of this.#actors.remove(command.id)) {
          this.#owners.forget(actor);
        }
        break;

      case "actor-moved":
        this.#actors.move(command.id, command.parentId, command.beforeId);
        this.#actors.update(command.id, (actor) => {
          const { anchor: _anchor, ...unanchored } = actor;

          return {
            ...unanchored,
            transform: structuredClone(command.transform),
            ...command.anchor === undefined ?
              {} :
              { anchor: structuredClone(command.anchor) }
          };
        });
        break;

      case "actor-renamed":
        this.#actors.update(command.id, (actor) => {
          return {
            ...actor,
            name: command.name
          };
        });
        break;

      case "actor-visibility":
        this.#actors.update(command.id, (actor) => {
          return {
            ...actor,
            visible: command.visible
          };
        });
        break;

      case "actor-transformed":
        this.#actors.update(command.id, (actor) => {
          return {
            ...actor,
            transform: SceneTransform.patch(command.transform).applyTo(actor.transform)
          };
        });
        break;

      case "component-added":
        this.#actors.update(command.actorId, (actor) => {
          return {
            ...actor,
            components: insertedBefore(
              actor.components,
              structuredClone(command.component),
              command.beforeId
            )
          };
        });
        this.#owners.add(command.component.id, command.actorId);
        break;

      case "component-removed":
        this.#actors.update(command.actorId, (actor) => {
          return {
            ...actor,
            components: actor.components.filter(({ id }) => id !== command.id)
          };
        });
        this.#owners.delete(command.id);
        break;

      case "component-moved":
        this.#actors.update(command.actorId, (actor) => {
          const moved = actor.components.find(({ id }) => id === command.id);

          return moved === undefined ? actor : {
            ...actor,
            components: insertedBefore(
              actor.components.filter(({ id }) => id !== command.id),
              moved,
              command.beforeId
            )
          };
        });
        break;

      case "component-changed":
        this.#updateComponent(command.id, (component) => {
          return {
            ...component,
            data: new ComponentChange(command).applyTo(component.data)
          };
        });
        break;

      case "component-assets-changed":
        this.#updateComponent(command.id, (component) => {
          return {
            ...component,
            assets: {
              ...component.assets,
              ...structuredClone(command.assets)
            }
          };
        });
        break;

      case "actor-overridden":
      case "component-overridden":
        this.#actors.update(command.id, (actor) => {
          const { overrides: _overrides, ...rest } = actor;
          const overrides = OverrideChange.from(command).applyTo(actor.overrides);

          return overrides === undefined ? rest : {
            ...rest,
            overrides
          };
        });
        break;

      case "environment-changed":
        this.#environment = SceneEnvironment.patch(command.environment).applyTo(this.#environment);
        break;
    }
  }

  load(
    snapshot: SceneSnapshot
  ): void {
    const problem = findActorListProblem(snapshot.actors, {
      hasActor: () => false,
      hasComponent: () => false,
      isOuterParent: (actor) => actor.parentId === null,
      isOwnScene: () => false
    });
    if (problem !== null) {
      throw problem;
    }

    this.clear();
    this.#environment = structuredClone(snapshot.environment);
    this.#insert(snapshot.actors, undefined);
  }

  clear(): void {
    this.#actors.clear();
    this.#owners.clear();
    this.#environment = SceneEnvironment.create();
  }

  toJSON(): SceneSnapshot {
    return ownedCopy({
      environment: this.#environment,
      actors: [...this.#actors.scan()]
    });
  }

  #peekOwner(
    componentId: string
  ): SceneActorView | undefined {
    const ownerId = this.#owners.owner(componentId);

    return ownerId === undefined ? undefined : this.#actors.peek(ownerId);
  }

  #hasSlot(
    command: SceneCommand
  ): boolean {
    switch (command.action) {
      case "actor-added": {
        const [root] = command.actors;

        return root !== undefined &&
          this.#actors.isSiblingSlot(command.beforeId, root.parentId, root.id);
      }
      case "actor-moved":
        return this.#actors.isSiblingSlot(command.beforeId, command.parentId, command.id);
      case "component-added":
        return this.#isComponentSlot(command.beforeId, command.actorId, command.component.id);
      case "component-moved":
        return this.#isComponentSlot(command.beforeId, command.actorId, command.id);
      default:
        return true;
    }
  }

  #isComponentSlot(
    beforeId: string | undefined,
    actorId: string,
    id: string
  ): boolean {
    return beforeId === undefined || (
      beforeId !== id &&
      this.#owners.owns(actorId, beforeId)
    );
  }

  #canAdd(
    actors: readonly SceneActorView[]
  ): boolean {
    return actors.length > 0 && findActorListProblem(actors, {
      hasActor: (id) => this.#actors.has(id),
      hasComponent: (id) => this.#owners.has(id),
      isOuterParent: (actor, index) => index === 0 && this.canContain(actor.parentId),
      isOwnScene: (sceneId) => sceneId === this.#sceneId
    }) === null;
  }

  #canChangeComponent(
    command: Extract<SceneCommand, { action: "component-changed"; }>
  ): boolean {
    const component = this.component(command.id);
    const change = ComponentChange.parse(command);

    return component !== undefined &&
      change !== null &&
      fitsDataLimit(change.applyTo(component.data));
  }

  #canOverride(
    command: OverrideCommand
  ): boolean {
    const actor = this.#actors.peek(command.id);
    const change = OverrideChange.from(command);

    return actor !== undefined &&
      isPrefabInstance(actor) &&
      !change.touchesNothing &&
      !change.contradicts &&
      fitsDataLimit(change.applyTo(actor.overrides) ?? {});
  }

  #insert(
    actors: readonly SceneActorView[],
    beforeId: string | undefined
  ): void {
    for (const [index, actor] of actors.entries()) {
      this.#actors.add(actor, index === 0 ? beforeId : undefined);
      this.#owners.register(actor);
    }
  }

  #updateComponent(
    id: string,
    change: (component: SceneComponentView) => SceneComponentView
  ): void {
    const ownerId = this.#owners.owner(id);
    if (ownerId === undefined) {
      return;
    }

    this.#actors.update(ownerId, (actor) => {
      return {
        ...actor,
        components: actor.components.map(
          (component) => (component.id === id ? change(component) : component)
        )
      };
    });
  }
}

function isPrefabInstance(
  actor: SceneActorView
): boolean {
  return actor.prefab !== undefined;
}

function isAnchorWithoutParent(
  placement: Readonly<SceneActorPlacement>
): boolean {
  return placement.anchor !== undefined && placement.parentId === null;
}

function fitsDataLimit(
  data: unknown
): boolean {
  return JSON.stringify(data).length <= COMPONENT_DATA_MAX_LENGTH;
}

function isPlainId(
  id: string
): boolean {
  return !id.includes("/");
}

function findActorListProblem(
  actors: readonly SceneActorView[],
  context: ActorListContext
): InvalidEntryError | null {
  const listed = new Map<string, SceneActorView>();
  const componentIds = new Set<string>();
  for (const [index, actor] of actors.entries()) {
    if (context.hasActor(actor.id) || listed.has(actor.id)) {
      return new InvalidEntryError("actor", actor.id, "is listed twice");
    }
    if (!isPlainId(actor.id)) {
      return new InvalidEntryError("actor", actor.id, "has a / in its id");
    }
    if (actor.overrides !== undefined && actor.prefab === undefined) {
      return new InvalidEntryError("actor", actor.id, "has overrides but no prefab");
    }
    const parent = actor.parentId === null ? undefined : listed.get(actor.parentId);
    if (parent === undefined && !context.isOuterParent(actor, index)) {
      return new InvalidEntryError("actor", actor.id, `has no parent ${actor.parentId} before it`);
    }
    if (isAnchorWithoutParent(actor)) {
      return new InvalidEntryError("actor", actor.id, "has an anchor but no parent");
    }
    if (parent !== undefined && isPrefabInstance(parent)) {
      return new InvalidEntryError("actor", actor.id, "is a child of a prefab instance");
    }
    if (actor.prefab !== undefined) {
      if (actor.prefab.kind !== SCENE_KIND) {
        return new InvalidEntryError("actor", actor.id, "has a prefab that is not a scene");
      }
      if (actor.components.length > 0) {
        return new InvalidEntryError("actor", actor.id, "is a prefab instance with components");
      }
      if (context.isOwnScene(actor.prefab.id)) {
        return new InvalidEntryError("actor", actor.id, "is an instance of its own scene");
      }
    }
    listed.set(actor.id, actor);

    for (const component of actor.components) {
      if (context.hasComponent(component.id) || componentIds.has(component.id)) {
        return new InvalidEntryError("component", component.id, "is listed twice");
      }
      if (!isPlainId(component.id)) {
        return new InvalidEntryError("component", component.id, "has a / in its id");
      }
      if (!fitsDataLimit(component.data)) {
        return new InvalidEntryError(
          "component",
          component.id,
          `has data over ${COMPONENT_DATA_MAX_LENGTH} characters`
        );
      }
      componentIds.add(component.id);
    }
  }

  return null;
}
