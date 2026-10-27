// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { randomId } from "@jolly-pixel/asset.common";
import type { SceneComponentJSON } from "@jolly-pixel/asset.scene/client";
import type {
  SceneActorPreset,
  SceneComponentSeed
} from "@jolly-pixel/editor.host/scene";
import type { MenuItem } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { SceneComponents } from "../../../components/SceneComponents.ts";

export type AddActorAction = `add:${string}`;

export type PickedAssets = Record<string, AssetReferenceData>;

export type ActorPresetRegistry = Pick<
  SceneComponents,
  "actorIcon" | "picksAssets"
>;

export class ActorPreset {
  readonly action: AddActorAction;
  readonly label: string;
  readonly icon: string;
  readonly #components: readonly SceneComponentSeed[];
  readonly #picksAssets: boolean;

  constructor(
    options: SceneActorPreset,
    registry: ActorPresetRegistry
  ) {
    const types = options.components.map(({ type }) => type);

    this.action = `add:${options.id}`;
    this.label = options.label;
    this.icon = registry.actorIcon(types);
    this.#components = options.components;
    this.#picksAssets = types.some((type) => registry.picksAssets(type));
  }

  get presets(): readonly ActorPreset[] {
    return [this];
  }

  get menuEntry(): MenuItem<AddActorAction> {
    return {
      id: this.action,
      label: this.#picksAssets ? `${this.label}…` : this.label,
      icon: this.icon
    };
  }

  async createComponents(
    pickAssets: (type: string) => Promise<PickedAssets | null>
  ): Promise<SceneComponentJSON[] | null> {
    const components: SceneComponentJSON[] = [];
    for (const { type, data } of this.#components) {
      const assets = await pickAssets(type);
      if (assets === null) {
        return null;
      }
      components.push({
        id: randomId(),
        type,
        data: structuredClone(data),
        assets
      });
    }

    return components;
  }
}
