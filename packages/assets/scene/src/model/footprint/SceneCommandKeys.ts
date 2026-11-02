// Import Internal Dependencies
import { ComponentChange } from "../changes/ComponentChange.ts";
import { OverrideChange } from "../changes/OverrideChange.ts";
import { SceneEnvironment } from "../changes/SceneEnvironment.ts";
import { SceneTransform } from "../changes/SceneTransform.ts";
import { SceneValueRef } from "./SceneValueRef.ts";
import type {
  SceneCommand,
  SceneNetworkCommand
} from "../../network/types.ts";

export function sceneWriteRefs(
  command: SceneCommand | SceneNetworkCommand
): SceneValueRef[] | null {
  switch (command.action) {
    case "actor-renamed":
      return [SceneValueRef.actorName(command.id)];
    case "actor-visibility":
      return [SceneValueRef.actorVisibility(command.id)];
    case "actor-transformed":
      return SceneTransform.patch(command.transform).fields().map(
        (field) => SceneValueRef.transform(command.id, field)
      );
    case "component-changed":
      return new ComponentChange(command).fields().map(
        (field) => SceneValueRef.componentField(command.id, field)
      );
    case "component-assets-changed":
      return Object.keys(command.assets).map(
        (slot) => SceneValueRef.componentAsset(command.id, slot)
      );
    case "actor-overridden":
    case "component-overridden": {
      const change = OverrideChange.from(command);

      return change.fields().map(
        (field) => SceneValueRef.override(
          command.id,
          change.group,
          command.path,
          field
        )
      );
    }
    case "environment-changed":
      return SceneEnvironment.patch(command.environment).fields().map(
        (field) => SceneValueRef.environment(field)
      );
    case "actor-added":
    case "actor-removed":
    case "actor-moved":
    case "component-added":
    case "component-removed":
    case "component-moved":
      return null;
  }
}

export function sceneWriteKeys(
  command: SceneCommand | SceneNetworkCommand
): string[] | null {
  return sceneWriteRefs(command)?.map((ref) => ref.key) ?? null;
}
