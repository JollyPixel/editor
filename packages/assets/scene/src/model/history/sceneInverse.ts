// Import Third-party Dependencies
import {
  InvalidEntryError,
  withBefore
} from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import { ComponentChange } from "../ComponentChange.ts";
import { OverrideChange } from "../OverrideChange.ts";
import { ownedCopy } from "../ownedCopy.ts";
import { SceneEnvironment } from "../SceneEnvironment.ts";
import { SceneTransform } from "../SceneTransform.ts";
import type { SceneTreeReader } from "../SceneTree.ts";
import type { SceneCommand } from "../../network/types.ts";

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
        actors: ownedCopy(tree.subtree(command.id)),
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

      return [{
        action: "actor-transformed",
        id: command.id,
        transform: SceneTransform.patch(command.transform).revert(transform)
      }];
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
        component: ownedCopy(existing(tree.component(command.id), "component", command.id)),
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

      return [new ComponentChange(command).revert(data).toCommand(command.id)];
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

    case "actor-overridden":
    case "component-overridden": {
      const { overrides } = existing(tree.actor(command.id), "actor", command.id);

      return [OverrideChange.from(command).revert(overrides).toCommand()];
    }

    case "environment-changed":
      return [{
        action: "environment-changed",
        environment: SceneEnvironment.patch(command.environment).revert(tree.environment)
      }];
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
