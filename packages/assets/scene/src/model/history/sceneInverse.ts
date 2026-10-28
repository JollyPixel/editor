// Import Third-party Dependencies
import {
  InvalidEntryError,
  withBefore
} from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import { SceneTransform } from "../SceneTransform.ts";
import { SCENE_ENVIRONMENT_FIELDS } from "../sceneEnvironment.ts";
import type { SceneTreeReader } from "../SceneTree.ts";
import type {
  JSONObject,
  SceneCommand,
  SceneEnvironmentPatch,
  SceneTransformPatch
} from "../../network/types.ts";

export function invert(
  tree: SceneTreeReader,
  command: SceneCommand
): SceneCommand[] {
  switch (command.action) {
    case "actor-added": {
      const [root] = command.actors;

      return root === undefined ? [] : [{ action: "actor-removed", id: root.id }];
    }

    case "actor-removed":
      return [{
        action: "actor-added",
        actors: tree.subtreeFrom(command.id),
        ...withBefore(tree.findNextSibling(command.id))
      }];

    case "actor-moved": {
      const actor = existing(tree.actor(command.id), "actor", command.id);

      return [{
        action: "actor-moved",
        id: actor.id,
        parentId: actor.parentId,
        transform: actor.transform,
        ...actor.anchor === undefined ? {} : { anchor: actor.anchor },
        ...withBefore(tree.findNextSibling(actor.id))
      }];
    }

    case "actor-renamed": {
      const actor = existing(tree.actor(command.id), "actor", command.id);

      return [{ action: "actor-renamed", id: actor.id, name: actor.name }];
    }

    case "actor-visibility": {
      const actor = existing(tree.actor(command.id), "actor", command.id);

      return [{ action: "actor-visibility", id: actor.id, visible: actor.visible }];
    }

    case "actor-transformed": {
      const { transform } = existing(tree.actor(command.id), "actor", command.id);
      const patch: SceneTransformPatch = Object.fromEntries(
        SceneTransform.FIELDS
          .filter((field) => Object.hasOwn(command.transform, field))
          .map((field) => [field, transform[field]])
      );

      return [{ action: "actor-transformed", id: command.id, transform: patch }];
    }

    case "component-added":
      return [{
        action: "component-removed",
        actorId: command.actorId,
        id: command.component.id
      }];

    case "component-removed":
      return [{
        action: "component-added",
        actorId: command.actorId,
        component: existing(tree.component(command.id), "component", command.id),
        ...withBefore(tree.findNextComponent(command.id))
      }];

    case "component-moved":
      return [{
        action: "component-moved",
        actorId: command.actorId,
        id: command.id,
        ...withBefore(tree.findNextComponent(command.id))
      }];

    case "component-changed": {
      const { data } = existing(tree.component(command.id), "component", command.id);
      const previous: JSONObject = {};
      const unset: string[] = [];
      for (const key of [...Object.keys(command.data), ...command.unset ?? []]) {
        if (Object.hasOwn(data, key)) {
          previous[key] = data[key];
        }
        else {
          unset.push(key);
        }
      }

      return [{
        action: "component-changed",
        id: command.id,
        data: previous,
        ...unset.length === 0 ? {} : { unset }
      }];
    }

    case "component-assets-changed": {
      const { assets } = existing(tree.component(command.id), "component", command.id);

      return [{
        action: "component-assets-changed",
        id: command.id,
        assets: Object.fromEntries(
          Object.keys(command.assets).map((slot) => [slot, assets[slot] ?? null])
        )
      }];
    }

    case "environment-changed": {
      const environment = tree.environment;
      const patch: SceneEnvironmentPatch = Object.fromEntries(
        SCENE_ENVIRONMENT_FIELDS
          .filter((field) => Object.hasOwn(command.environment, field))
          .map((field) => [field, environment[field]])
      );

      return [{ action: "environment-changed", environment: patch }];
    }
  }
}

function existing<T>(
  value: T | undefined,
  entry: string,
  id: string
): T {
  if (value === undefined) {
    throw new InvalidEntryError(entry, id, "is missing for a command the tree accepted");
  }

  return value;
}
