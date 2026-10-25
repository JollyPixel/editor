// Import Internal Dependencies
import { SceneTransform } from "../model/SceneTransform.ts";
import { SCENE_ENVIRONMENT_FIELDS } from "../model/sceneEnvironment.ts";
import type {
  SceneActorJSON,
  SceneCommand,
  SceneComponentJSON,
  SceneEnvironmentField,
  SceneNetworkCommand,
  SceneTransformField
} from "./types.ts";

type KeyedCommand = SceneCommand | SceneNetworkCommand;

export type SceneValueRef =
  | { kind: "name" | "visible" | "parent" | "components"; id: string; }
  | { kind: "transform"; id: string; field: SceneTransformField; }
  | { kind: "component"; id: string; field: string; }
  | { kind: "component-asset"; id: string; slot: string; }
  | { kind: "environment"; field: SceneEnvironmentField; };

export function sceneValueKey(
  ref: SceneValueRef
): string {
  switch (ref.kind) {
    case "transform":
    case "component":
      return `${ref.kind}:${ref.id}:${ref.field}`;
    case "component-asset":
      return `${ref.kind}:${ref.id}:${ref.slot}`;
    case "environment":
      return `${ref.kind}:${ref.field}`;
    default:
      return `${ref.kind}:${ref.id}`;
  }
}

export function sceneConflictRefs(
  command: KeyedCommand,
  erased: readonly Readonly<SceneActorJSON>[]
): SceneValueRef[] {
  switch (command.action) {
    case "actor-removed":
      return erased.length === 0 ?
        actorValueRefs(command.id) :
        erased.flatMap((actor) => [
          ...actorValueRefs(actor.id),
          ...actor.components.flatMap(componentValueRefs)
        ]);
    case "actor-moved":
      return [
        { kind: "parent", id: command.id },
        ...transformRefs(command.id, SceneTransform.FIELDS)
      ];
    case "component-added":
    case "component-moved":
      return [{ kind: "components", id: command.actorId }];
    case "component-removed":
      return [
        { kind: "components", id: command.actorId },
        ...erased
          .flatMap(({ components }) => components)
          .filter(({ id }) => id === command.id)
          .flatMap(componentValueRefs)
      ];
    case "actor-added":
      return [];
    case "actor-renamed":
    case "actor-visibility":
    case "actor-transformed":
    case "component-changed":
    case "component-assets-changed":
    case "environment-changed":
      return sceneWriteRefs(command) ?? [];
  }
}

export function sceneWriteRefs(
  command: KeyedCommand
): SceneValueRef[] | null {
  switch (command.action) {
    case "actor-renamed":
      return [{ kind: "name", id: command.id }];
    case "actor-visibility":
      return [{ kind: "visible", id: command.id }];
    case "actor-transformed":
      return transformRefs(
        command.id,
        SceneTransform.FIELDS.filter((field) => Object.hasOwn(command.transform, field))
      );
    case "component-changed":
      return [...Object.keys(command.data), ...command.unset ?? []].map(
        (field): SceneValueRef => {
          return { kind: "component", id: command.id, field };
        }
      );
    case "component-assets-changed":
      return Object.keys(command.assets).map((slot): SceneValueRef => {
        return { kind: "component-asset", id: command.id, slot };
      });
    case "environment-changed":
      return SCENE_ENVIRONMENT_FIELDS
        .filter((field) => Object.hasOwn(command.environment, field))
        .map((field): SceneValueRef => {
          return { kind: "environment", field };
        });
    case "actor-added":
    case "actor-removed":
    case "actor-moved":
    case "component-added":
    case "component-removed":
    case "component-moved":
      return null;
  }
}

export function sceneConflictKeys(
  command: KeyedCommand,
  erased: readonly Readonly<SceneActorJSON>[]
): string[] {
  return sceneConflictRefs(command, erased).map(sceneValueKey);
}

export function sceneWriteKeys(
  command: KeyedCommand
): string[] | null {
  return sceneWriteRefs(command)?.map(sceneValueKey) ?? null;
}

function actorValueRefs(
  id: string
): SceneValueRef[] {
  return [
    { kind: "name", id },
    { kind: "visible", id },
    { kind: "parent", id },
    ...transformRefs(id, SceneTransform.FIELDS),
    { kind: "components", id }
  ];
}

function componentValueRefs(
  component: SceneComponentJSON
): SceneValueRef[] {
  return [
    ...Object.keys(component.data).map((field): SceneValueRef => {
      return { kind: "component", id: component.id, field };
    }),
    ...Object.keys(component.assets).map((slot): SceneValueRef => {
      return { kind: "component-asset", id: component.id, slot };
    })
  ];
}

function transformRefs(
  id: string,
  fields: readonly SceneTransformField[]
): SceneValueRef[] {
  return fields.map((field): SceneValueRef => {
    return { kind: "transform", id, field };
  });
}
