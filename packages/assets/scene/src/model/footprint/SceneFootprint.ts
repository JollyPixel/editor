// Import Internal Dependencies
import { overrideFields } from "../changes/OverrideChange.ts";
import { sceneWriteRefs } from "./SceneCommandKeys.ts";
import type { SceneTreeReader } from "../tree/SceneTree.ts";
import { SceneTransform } from "../changes/SceneTransform.ts";
import { SceneValueRef } from "./SceneValueRef.ts";
import type {
  SceneActorView,
  SceneCommand,
  SceneComponentView,
  SceneEnvironmentView
} from "../../network/types.ts";

type FootprintTree = Pick<
  SceneTreeReader,
  "actor" | "subtree" | "componentOwner" | "environment"
>;

export class SceneFootprint {
  static capture(
    tree: FootprintTree,
    command: SceneCommand
  ): SceneFootprint {
    switch (command.action) {
      case "actor-added":
        return new SceneFootprint(
          command,
          [],
          command.actors.slice(0, 1).map(({ parentId }) => parentId)
        );
      case "actor-removed":
        return new SceneFootprint(command, tree.subtree(command.id));
      case "actor-moved":
        return SceneFootprint.#actor(command, tree.actor(command.id), [command.parentId]);
      case "actor-renamed":
      case "actor-visibility":
      case "actor-transformed":
      case "actor-overridden":
      case "component-overridden":
        return SceneFootprint.#actor(command, tree.actor(command.id));
      case "component-added":
      case "component-removed":
      case "component-moved":
        return SceneFootprint.#actor(command, tree.actor(command.actorId), [command.actorId]);
      case "component-changed":
      case "component-assets-changed": {
        const ownerId = tree.componentOwner(command.id);

        return ownerId === undefined ?
          SceneFootprint.unknown(command) :
          SceneFootprint.#actor(command, tree.actor(ownerId), [ownerId]);
      }
      case "environment-changed":
        return new SceneFootprint(command, [], [], tree.environment);
    }
  }

  static unknown(
    command: SceneCommand
  ): SceneFootprint {
    return new SceneFootprint(command);
  }

  static #actor(
    command: SceneCommand,
    actor: SceneActorView | undefined,
    touched: readonly (string | null)[] = []
  ): SceneFootprint {
    return new SceneFootprint(command, actor === undefined ? [] : [actor], touched);
  }

  readonly actors: readonly SceneActorView[];
  readonly environment: SceneEnvironmentView | null;
  readonly #command: SceneCommand;
  readonly #containers: readonly (string | null)[];

  constructor(
    command: SceneCommand,
    actors: readonly SceneActorView[] = [],
    touched: readonly (string | null)[] = [],
    environment: SceneEnvironmentView | null = null
  ) {
    this.actors = actors;
    this.environment = environment;
    this.#command = command;
    this.#containers = [
      ...actors.map(({ parentId }) => parentId),
      ...touched
    ];
  }

  conflictRefs(): SceneValueRef[] {
    const command = this.#command;
    switch (command.action) {
      case "actor-removed":
        return this.actors.length === 0 ?
          actorRefs(command.id) :
          this.actors.flatMap((actor) => [
            ...actorRefs(actor.id),
            ...actor.components.flatMap(componentRefs),
            ...overrideFields(actor.overrides).map(
              ({ group, path, field }) => SceneValueRef.override(actor.id, group, path, field)
            )
          ]);
      case "actor-moved":
        return [
          SceneValueRef.actorParent(command.id),
          ...transformRefs(command.id)
        ];
      case "component-added":
      case "component-moved":
        return [SceneValueRef.actorComponents(command.actorId)];
      case "component-removed":
        return [
          SceneValueRef.actorComponents(command.actorId),
          ...this.actors
            .flatMap(({ components }) => components)
            .filter(({ id }) => id === command.id)
            .flatMap(componentRefs)
        ];
      case "actor-added":
        return [];
      case "actor-renamed":
      case "actor-visibility":
      case "actor-transformed":
      case "component-changed":
      case "component-assets-changed":
      case "actor-overridden":
      case "component-overridden":
      case "environment-changed":
        return sceneWriteRefs(command) ?? [];
    }
  }

  writtenRefs(
    tree: Pick<SceneTreeReader, "ancestorIds">
  ): SceneValueRef[] {
    const containers = this.#containers
      .flatMap((id) => (id === null ? [] : [id, ...tree.ancestorIds(id)]))
      .map((id) => SceneValueRef.subtree(id));

    return [...this.conflictRefs(), ...containers];
  }

  guardRefs(): SceneValueRef[] {
    const command = this.#command;

    return command.action === "actor-removed" ?
      [...this.conflictRefs(), SceneValueRef.subtree(command.id)] :
      this.conflictRefs();
  }
}

function actorRefs(
  id: string
): SceneValueRef[] {
  return [
    SceneValueRef.actorName(id),
    SceneValueRef.actorVisibility(id),
    SceneValueRef.actorParent(id),
    ...transformRefs(id),
    SceneValueRef.actorComponents(id)
  ];
}

function componentRefs(
  component: SceneComponentView
): SceneValueRef[] {
  return [
    ...Object.keys(component.data).map(
      (field) => SceneValueRef.componentField(component.id, field)
    ),
    ...Object.keys(component.assets).map(
      (slot) => SceneValueRef.componentAsset(component.id, slot)
    )
  ];
}

function transformRefs(
  id: string
): SceneValueRef[] {
  return SceneTransform.FIELDS.map((field) => SceneValueRef.transform(id, field));
}
