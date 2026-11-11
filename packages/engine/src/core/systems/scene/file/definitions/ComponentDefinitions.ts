// Import Third-party Dependencies
import {
  AssetReference,
  type AssetReferenceData
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { Actor } from "../../../../actor/Actor.ts";
import type { LoadableAssets } from "../../Scene.ts";
import type { Component } from "../../../../components/types.ts";
import { randomPersistentId } from "../../../generators/randomPersistentId.ts";
import {
  type ComponentAssetResolver,
  type ComponentDefinition,
  type SceneMode,
  ComponentAssets
} from "./ComponentDefinition.ts";
import type { ComponentAnchors } from "./ComponentAnchors.ts";
import type {
  JSONObject,
  SceneComponentFile,
  SceneFile
} from "../SceneFile.ts";

export type AnyComponentDefinition = ComponentDefinition<any, any, any>;

export interface MissingComponentAsset {
  readonly slot: string;
  readonly reference: AssetReferenceData;
}

interface FilledSlot {
  readonly slot: string;
  readonly data: AssetReferenceData;
  readonly reference: AssetReference<unknown> | null;
}

export interface ComponentBuildOptions {
  readonly mode: SceneMode;
  readonly resolver: ComponentAssetResolver;
}

export class ComponentDefinitions {
  #definitions = new Map<string, AnyComponentDefinition>();
  #built = new WeakMap<Component, SceneComponentFile>();

  register(
    ...definitions: AnyComponentDefinition[]
  ): this {
    for (const definition of definitions) {
      if (this.#definitions.has(definition.type)) {
        throw new Error(
          `Component type "${definition.type}" is already registered.`
        );
      }
      this.#definitions.set(definition.type, definition);
    }

    return this;
  }

  find(
    type: string
  ): AnyComponentDefinition | null {
    return this.#definitions.get(type) ?? null;
  }

  create(
    actor: Actor<any>,
    entry: SceneComponentFile,
    options: ComponentBuildOptions
  ): Component | null {
    const definition = this.#definitions.get(
      entry.type
    );
    if (definition === undefined) {
      return null;
    }

    const component: Component | null = definition.create(
      actor,
      definition.parse(entry.data),
      {
        mode: options.mode,
        assets: new ComponentAssets(
          definition.assets ?? {},
          entry.assets,
          options.resolver
        )
      }
    );
    if (component !== null) {
      this.#built.set(component, entry);
    }

    return component;
  }

  apply(
    component: Component,
    type: string,
    data: Readonly<JSONObject>
  ): boolean {
    const definition = this.#definitions.get(type);
    if (
      definition?.apply === undefined ||
      definition.apply(component, definition.parse(data)) === false
    ) {
      return false;
    }

    const built = this.#built.get(component);
    if (built !== undefined) {
      this.#built.set(component, {
        ...built,
        data: { ...data }
      });
    }

    return true;
  }

  anchors(
    component: Component
  ): ComponentAnchors | null {
    const built = this.#built.get(component);
    if (built === undefined) {
      return null;
    }

    return this.#definitions.get(
      built.type
    )?.anchors?.(component) ?? null;
  }

  capture(
    component: Component
  ): SceneComponentFile | null {
    const built = this.#built.get(component);
    if (built !== undefined) {
      const definition = this.#definitions.get(built.type);

      return {
        id: built.id,
        type: built.type,
        data: definition?.capture?.(component, built.data) ?? built.data,
        assets: { ...built.assets }
      };
    }

    for (const definition of this.#definitions.values()) {
      if (
        definition.capture !== undefined &&
        definition.owns?.(component)
      ) {
        return {
          id: randomPersistentId(),
          type: definition.type,
          data: definition.capture(component, {}),
          assets: {}
        };
      }
    }

    return null;
  }

  * assets(
    file: Readonly<Pick<SceneFile, "actors">>
  ): IterableIterator<AssetReference<unknown>> {
    for (const actor of file.actors) {
      for (const entry of actor.components) {
        for (const { reference } of this.#slots(entry)) {
          if (reference !== null) {
            yield reference;
          }
        }
      }
    }
  }

  missingAsset(
    entry: Readonly<Pick<SceneComponentFile, "type" | "assets">>,
    loadable: LoadableAssets
  ): MissingComponentAsset | null {
    for (const { slot, data, reference } of this.#slots(entry)) {
      if (reference === null || !loadable.canLoad(reference)) {
        return {
          slot,
          reference: data
        };
      }
    }

    return null;
  }

  * #slots(
    entry: Readonly<Pick<SceneComponentFile, "type" | "assets">>
  ): IterableIterator<FilledSlot> {
    const slots = this.#definitions.get(entry.type)?.assets ?? {};
    for (const [slot, type] of Object.entries(slots)) {
      const data = entry.assets[slot] ?? null;
      if (data !== null) {
        yield {
          slot,
          data,
          reference: data.kind === type.kind.value ?
            AssetReference.parse(data, type) :
            null
        };
      }
    }
  }
}
