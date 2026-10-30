// Import Internal Dependencies
import {
  FieldEdit,
  keysIn
} from "./FieldEdit.ts";
import type {
  ActorOverriddenCommand,
  ActorOverrideFields,
  ComponentOverriddenCommand,
  OverrideEdit
} from "./OverrideChange.ts";
import type {
  JSONObject,
  SceneActorOverrideJSON,
  SceneComponentOverrideJSON,
  SceneOverridesJSON,
  SceneOverridesView
} from "../network/types.ts";

type ComponentAssets = NonNullable<SceneComponentOverrideJSON["assets"]>;
type ActorOverrideView = NonNullable<SceneOverridesView["actors"]>[string];
type ComponentOverrideView = NonNullable<SceneOverridesView["components"]>[string];

export class ActorEdit implements OverrideEdit {
  static from(
    command: ActorOverriddenCommand
  ): ActorEdit {
    return new ActorEdit(new FieldEdit(ActorEdit.#fields(command.set), command.unset));
  }

  static clearing(
    entry: ActorOverrideView | undefined
  ): ActorEdit {
    return new ActorEdit(new FieldEdit({}, keysIn(ActorEdit.#fields(entry))));
  }

  static value(
    entry: ActorOverrideView | undefined,
    field: string
  ): unknown {
    return new Map<string, unknown>(Object.entries(ActorEdit.#fields(entry))).get(field);
  }

  static #fields(
    entry: ActorOverrideView | undefined
  ): Partial<ActorOverrideFields> {
    const { transform, ...fields } = entry ?? {};

    return {
      ...fields,
      ...transform
    };
  }

  static #entry(
    fields: Partial<ActorOverrideFields>
  ): SceneActorOverrideJSON | undefined {
    const { name, visible, ...transform } = fields;
    const entry: SceneActorOverrideJSON = {
      ...name === undefined ? {} : { name },
      ...visible === undefined ? {} : { visible },
      ...hasKeys(transform) ? { transform } : {}
    };

    return hasKeys(entry) ? entry : undefined;
  }

  readonly group = "actors";
  readonly #edit: FieldEdit<ActorOverrideFields>;

  constructor(
    edit: FieldEdit<ActorOverrideFields>
  ) {
    this.#edit = edit;
  }

  get contradicts(): boolean {
    return this.#edit.contradicts;
  }

  fields(): string[] {
    return this.#edit.fields();
  }

  applyTo(
    overrides: SceneOverridesJSON,
    path: string
  ): SceneOverridesJSON {
    const current = ActorEdit.#fields(entryIn(overrides.actors, path));

    return {
      ...overrides,
      actors: withEntry(overrides.actors, path, ActorEdit.#entry(this.#edit.applyTo(current)))
    };
  }

  revert(
    overrides: SceneOverridesJSON,
    path: string
  ): ActorEdit {
    return new ActorEdit(this.#edit.revert(ActorEdit.#fields(entryIn(overrides.actors, path))));
  }

  toCommand(
    id: string,
    path: string
  ): ActorOverriddenCommand {
    const set = ActorEdit.#entry(this.#edit.set);
    const { unset } = this.#edit;

    return {
      action: "actor-overridden",
      id,
      path,
      ...set === undefined ? {} : { set },
      ...unset.length === 0 ? {} : { unset: [...unset] }
    };
  }
}

export class ComponentEdit implements OverrideEdit {
  static from(
    command: ComponentOverriddenCommand
  ): ComponentEdit {
    return new ComponentEdit(
      new FieldEdit(command.set?.data, command.unset?.data),
      new FieldEdit(command.set?.assets, command.unset?.assets)
    );
  }

  static clearing(
    entry: ComponentOverrideView | undefined
  ): ComponentEdit {
    return new ComponentEdit(
      new FieldEdit({}, keysIn(entry?.data ?? {})),
      new FieldEdit({}, keysIn(entry?.assets ?? {}))
    );
  }

  static value(
    entry: ComponentOverrideView | undefined,
    field: string
  ): unknown {
    const dot = field.indexOf(".");
    const key = field.slice(dot + 1);
    const values = new Map([
      ["data", entry?.data],
      ["assets", entry?.assets]
    ]).get(field.slice(0, dot));

    return values !== undefined && Object.hasOwn(values, key) ? values[key] : undefined;
  }

  static #entry(
    data: Partial<JSONObject>,
    assets: Partial<ComponentAssets>
  ): SceneComponentOverrideJSON | undefined {
    const entry: SceneComponentOverrideJSON = {
      ...hasKeys(data) ? { data: definedValues(data) } : {},
      ...hasKeys(assets) ? { assets: definedValues(assets) } : {}
    };

    return hasKeys(entry) ? entry : undefined;
  }

  readonly group = "components";
  readonly #data: FieldEdit<JSONObject>;
  readonly #assets: FieldEdit<ComponentAssets>;

  constructor(
    data: FieldEdit<JSONObject>,
    assets: FieldEdit<ComponentAssets>
  ) {
    this.#data = data;
    this.#assets = assets;
  }

  get contradicts(): boolean {
    return this.#data.contradicts || this.#assets.contradicts;
  }

  fields(): string[] {
    return [
      ...this.#data.fields().map((key) => `data.${key}`),
      ...this.#assets.fields().map((key) => `assets.${key}`)
    ];
  }

  applyTo(
    overrides: SceneOverridesJSON,
    path: string
  ): SceneOverridesJSON {
    const entry = entryIn(overrides.components, path);
    const next = ComponentEdit.#entry(
      this.#data.applyTo(entry?.data ?? {}),
      this.#assets.applyTo(entry?.assets ?? {})
    );

    return {
      ...overrides,
      components: withEntry(overrides.components, path, next)
    };
  }

  revert(
    overrides: SceneOverridesJSON,
    path: string
  ): ComponentEdit {
    const entry = entryIn(overrides.components, path);

    return new ComponentEdit(
      this.#data.revert(entry?.data ?? {}),
      this.#assets.revert(entry?.assets ?? {})
    );
  }

  toCommand(
    id: string,
    path: string
  ): ComponentOverriddenCommand {
    const set = ComponentEdit.#entry(this.#data.set, this.#assets.set);
    const data = this.#data.unset;
    const assets = this.#assets.unset;
    const unset = {
      ...data.length === 0 ? {} : { data: [...data] },
      ...assets.length === 0 ? {} : { assets: [...assets] }
    };

    return {
      action: "component-overridden",
      id,
      path,
      ...set === undefined ? {} : { set },
      ...hasKeys(unset) ? { unset } : {}
    };
  }
}

export function entryIn<TEntry>(
  entries: Readonly<Record<string, TEntry>> | undefined,
  path: string
): TEntry | undefined {
  return entries !== undefined && Object.hasOwn(entries, path) ? entries[path] : undefined;
}

function withEntry<TEntry>(
  entries: Record<string, TEntry> | undefined,
  path: string,
  entry: TEntry | undefined
): Record<string, TEntry> | undefined {
  const next = { ...entries };
  if (entry === undefined) {
    delete next[path];
  }
  else {
    next[path] = entry;
  }

  return hasKeys(next) ? next : undefined;
}

function definedValues<TValue>(
  record: Partial<Record<string, TValue>>
): Record<string, TValue> {
  const defined: Record<string, TValue> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      defined[key] = value;
    }
  }

  return defined;
}

function hasKeys(
  value: object
): boolean {
  return Object.keys(value).length > 0;
}
