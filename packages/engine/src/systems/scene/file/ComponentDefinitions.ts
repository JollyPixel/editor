// Import Third-party Dependencies
import { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { ComponentDefinition } from "./ComponentDefinition.ts";
import type { SceneFile } from "./SceneFile.ts";

export type AnyComponentDefinition = ComponentDefinition<any, any, any>;

export class ComponentDefinitions {
  #definitions = new Map<string, AnyComponentDefinition>();

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

  * assets(
    file: SceneFile
  ): IterableIterator<AssetReference<unknown>> {
    for (const actor of file.actors) {
      for (const entry of actor.components) {
        const slots = this.#definitions.get(
          entry.type
        )?.assets ?? {};

        for (const [slot, type] of Object.entries(slots)) {
          const reference = entry.assets[slot] ?? null;
          if (reference !== null) {
            yield AssetReference.parse(reference, type);
          }
        }
      }
    }
  }
}
