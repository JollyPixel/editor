// Import Internal Dependencies
import {
  ActorEdit,
  ComponentEdit,
  entryIn
} from "./OverrideEdits.ts";
import { ownedCopy } from "../ownedCopy.ts";
import type {
  SceneActorJSON,
  SceneCommand,
  SceneOverridesJSON,
  SceneOverridesView,
  SceneTransformJSON
} from "../../network/types.ts";

export type ActorOverriddenCommand = Extract<SceneCommand, { action: "actor-overridden"; }>;
export type ComponentOverriddenCommand = Extract<SceneCommand, { action: "component-overridden"; }>;
export type OverrideCommand = ActorOverriddenCommand | ComponentOverriddenCommand;
export type OverrideGroup = keyof SceneOverridesJSON;
export type ActorOverrideFields = Pick<SceneActorJSON, "name" | "visible"> & SceneTransformJSON;

export interface OverrideField {
  group: OverrideGroup;
  path: string;
  field: string;
}

export interface OverrideEdit {
  readonly group: OverrideGroup;
  readonly contradicts: boolean;
  fields(): string[];
  applyTo(overrides: SceneOverridesJSON, path: string): SceneOverridesJSON;
  revert(overrides: SceneOverridesJSON, path: string): OverrideEdit;
  toCommand(id: string, path: string): OverrideCommand;
}

export class OverrideChange {
  static actor(
    command: Omit<ActorOverriddenCommand, "action">
  ): OverrideChange {
    return OverrideChange.from({
      action: "actor-overridden",
      ...command
    });
  }

  static component(
    command: Omit<ComponentOverriddenCommand, "action">
  ): OverrideChange {
    return OverrideChange.from({
      action: "component-overridden",
      ...command
    });
  }

  static clear(
    instance: { id: string; overrides?: SceneOverridesView; },
    group: OverrideGroup,
    path: string
  ): OverrideChange | null {
    const edit = group === "actors" ?
      ActorEdit.clearing(entryIn(instance.overrides?.actors, path)) :
      ComponentEdit.clearing(entryIn(instance.overrides?.components, path));

    return edit.fields().length === 0
      ? null
      : new OverrideChange(instance.id, path, edit);
  }

  static from(
    command: OverrideCommand
  ): OverrideChange {
    const edit = command.action === "actor-overridden" ?
      ActorEdit.from(command) :
      ComponentEdit.from(command);

    return new OverrideChange(
      command.id,
      command.path,
      edit
    );
  }

  readonly id: string;
  readonly path: string;
  readonly #edit: OverrideEdit;

  constructor(
    id: string,
    path: string,
    edit: OverrideEdit
  ) {
    this.id = id;
    this.path = path;
    this.#edit = edit;
  }

  get group(): OverrideGroup {
    return this.#edit.group;
  }

  get touchesNothing(): boolean {
    return this.fields().length === 0;
  }

  get contradicts(): boolean {
    return this.#edit.contradicts;
  }

  fields(): string[] {
    return this.#edit.fields();
  }

  applyTo(
    overrides: SceneOverridesView | undefined
  ): SceneOverridesJSON | undefined {
    return compact(
      this.#edit.applyTo(
        ownedOverrides(overrides),
        this.path
      )
    );
  }

  revert(
    overrides: SceneOverridesView | undefined
  ): OverrideChange {
    return new OverrideChange(
      this.id,
      this.path,
      this.#edit.revert(
        ownedOverrides(overrides),
        this.path
      )
    );
  }

  toCommand(): OverrideCommand {
    return this.#edit.toCommand(
      this.id,
      this.path
    );
  }
}

export function overrideFieldValue(
  overrides: SceneOverridesView | undefined,
  group: OverrideGroup,
  path: string,
  field: string
): unknown {
  return group === "actors" ?
    ActorEdit.value(entryIn(overrides?.actors, path), field) :
    ComponentEdit.value(entryIn(overrides?.components, path), field);
}

export function overrideFields(
  overrides: SceneOverridesView | undefined
): OverrideField[] {
  const edits = [
    ...Object.entries(overrides?.actors ?? {}).map(
      ([path, entry]) => [path, ActorEdit.clearing(entry)] as const
    ),
    ...Object.entries(overrides?.components ?? {}).map(
      ([path, entry]) => [path, ComponentEdit.clearing(entry)] as const
    )
  ];

  return edits.flatMap(([path, edit]) => edit.fields().map((field) => {
    return {
      group: edit.group,
      path,
      field
    };
  }));
}

function ownedOverrides(
  overrides: SceneOverridesView | undefined
): SceneOverridesJSON {
  return ownedCopy<SceneOverridesJSON>(overrides ?? {});
}

function compact(
  overrides: SceneOverridesJSON
): SceneOverridesJSON | undefined {
  const { actors, components } = overrides;
  if (actors === undefined && components === undefined) {
    return undefined;
  }

  return {
    ...actors === undefined ? {} : { actors },
    ...components === undefined ? {} : { components }
  };
}
