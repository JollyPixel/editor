// Import Third-party Dependencies
import {
  KeyedGuard,
  type CommandChange,
  type HistoryKeys,
  type KeyedGuardEntry
} from "@jolly-pixel/history";

// Import Internal Dependencies
import type { SceneTreeReader } from "../SceneTree.ts";
import type { SceneImage } from "./sceneImages.ts";
import type {
  SceneActorJSON,
  SceneCommand
} from "../../network/types.ts";
import {
  sceneConflictKeys,
  sceneConflictRefs,
  sceneValueKey,
  type SceneValueRef
} from "../../network/SceneCommandKeys.ts";

export function sceneHistoryKeys(
  tree: SceneTreeReader
): HistoryKeys<SceneCommand, SceneImage> {
  return {
    written: (change) => [...new Set([
      ...sceneConflictKeys(change.command, change.image.before.actors),
      ...containerKeys(tree, change)
    ])],
    guard: (commands) => new KeyedGuard(commands.flatMap((command) => [
      ...sceneConflictRefs(command, tree.erasedBy(command))
        .map((ref) => createValueGuard(tree, ref)),
      ...removedSubtreeGuards(tree, command)
    ]))
  };
}

function createValueGuard(
  tree: SceneTreeReader,
  ref: SceneValueRef
): KeyedGuardEntry {
  return {
    key: sceneValueKey(ref),
    read: () => readValue(tree, ref)
  };
}

function readValue(
  tree: SceneTreeReader,
  ref: SceneValueRef
): unknown {
  switch (ref.kind) {
    case "name":
      return tree.peekActor(ref.id)?.name;
    case "visible":
      return tree.peekActor(ref.id)?.visible;
    case "parent":
      return tree.peekActor(ref.id)?.parentId;
    case "transform":
      return tree.peekActor(ref.id)?.transform[ref.field];
    case "components":
      return tree.peekActor(ref.id)?.components.map(({ id }) => id);
    case "component":
      return tree.peekComponent(ref.id)?.data[ref.field];
    case "component-asset":
      return tree.peekComponent(ref.id)?.assets[ref.slot];
    case "environment":
      return tree.environment[ref.field];
  }
}

function removedSubtreeGuards(
  tree: SceneTreeReader,
  command: SceneCommand
): KeyedGuardEntry[] {
  if (command.action !== "actor-removed") {
    return [];
  }

  return [{
    key: subtreeKey(command.id),
    read: () => tree.erasedBy(command)
  }];
}

function containerKeys(
  tree: SceneTreeReader,
  change: CommandChange<SceneCommand, SceneImage>
): string[] {
  const { command, image: { before } } = change;
  const parents = [
    ...before.actors.map(({ parentId }) => parentId),
    ...touchedContainers(command, before.actors)
  ];

  return parents
    .flatMap((parentId) => ancestorChain(tree, parentId))
    .map(subtreeKey);
}

function touchedContainers(
  command: SceneCommand,
  before: readonly SceneActorJSON[]
): (string | null)[] {
  switch (command.action) {
    case "actor-added":
      return command.actors.slice(0, 1).map(({ parentId }) => parentId);
    case "actor-moved":
      return [command.parentId];
    case "component-added":
    case "component-removed":
    case "component-moved":
      return [command.actorId];
    case "component-changed":
    case "component-assets-changed":
      return before.map(({ id }) => id);
    default:
      return [];
  }
}

function subtreeKey(
  id: string
): string {
  return `subtree:${id}`;
}

function ancestorChain(
  tree: SceneTreeReader,
  id: string | null
): string[] {
  const chain: string[] = [];
  for (
    let current = id;
    current !== null && !chain.includes(current);
    current = tree.peekActor(current)?.parentId ?? null
  ) {
    chain.push(current);
  }

  return chain;
}
