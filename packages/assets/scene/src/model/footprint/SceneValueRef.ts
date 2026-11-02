// Import Internal Dependencies
import {
  overrideFieldValue,
  type OverrideGroup
} from "../changes/OverrideChange.ts";
import type { SceneTreeReader } from "../tree/SceneTree.ts";
import type {
  SceneEnvironmentField,
  SceneTransformField
} from "../../network/types.ts";

type ValueReader = (tree: SceneTreeReader) => unknown;

export class SceneValueRef {
  static actorName(
    id: string
  ): SceneValueRef {
    return new SceneValueRef(`name:${id}`, (tree) => tree.actor(id)?.name);
  }

  static actorVisibility(
    id: string
  ): SceneValueRef {
    return new SceneValueRef(`visible:${id}`, (tree) => tree.actor(id)?.visible);
  }

  static actorParent(
    id: string
  ): SceneValueRef {
    return new SceneValueRef(`parent:${id}`, (tree) => tree.actor(id)?.parentId);
  }

  static actorComponents(
    id: string
  ): SceneValueRef {
    return new SceneValueRef(
      `components:${id}`,
      (tree) => tree.actor(id)?.components.map((component) => component.id)
    );
  }

  static transform(
    id: string,
    field: SceneTransformField
  ): SceneValueRef {
    return new SceneValueRef(
      `transform:${id}:${field}`,
      (tree) => tree.actor(id)?.transform[field]
    );
  }

  static componentField(
    id: string,
    field: string
  ): SceneValueRef {
    return new SceneValueRef(
      `component:${id}:${field}`,
      (tree) => tree.component(id)?.data[field]
    );
  }

  static componentAsset(
    id: string,
    slot: string
  ): SceneValueRef {
    return new SceneValueRef(
      `component-asset:${id}:${slot}`,
      (tree) => tree.component(id)?.assets[slot]
    );
  }

  static environment(
    field: SceneEnvironmentField
  ): SceneValueRef {
    return new SceneValueRef(`environment:${field}`, (tree) => tree.environment[field]);
  }

  static override(
    id: string,
    group: OverrideGroup,
    path: string,
    field: string
  ): SceneValueRef {
    return new SceneValueRef(
      `override:${id}:${group}:${path}:${field}`,
      (tree) => overrideFieldValue(tree.actor(id)?.overrides, group, path, field)
    );
  }

  static subtree(
    id: string
  ): SceneValueRef {
    return new SceneValueRef(`subtree:${id}`, (tree) => tree.subtree(id));
  }

  readonly key: string;
  readonly #read: ValueReader;

  constructor(
    key: string,
    read: ValueReader
  ) {
    this.key = key;
    this.#read = read;
  }

  read(
    tree: SceneTreeReader
  ): unknown {
    return this.#read(tree);
  }
}
