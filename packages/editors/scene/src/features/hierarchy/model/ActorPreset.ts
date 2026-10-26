// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  randomId,
  type JSONObject,
  type SceneComponentJSON
} from "@jolly-pixel/asset.scene/client";
import type { MenuItem } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  actorIcon,
  picksAssets
} from "../../../components/sceneComponents.ts";

export type AddActorAction = `add:${string}`;

export type PickedAssets = Record<string, AssetReferenceData>;

export interface ActorComponentSeed {
  type: string;
  data: JSONObject;
}

export interface ActorPresetOptions {
  id: string;
  label: string;
  components: readonly ActorComponentSeed[];
}

export class ActorPreset {
  readonly action: AddActorAction;
  readonly label: string;
  readonly #components: readonly ActorComponentSeed[];

  constructor(
    options: ActorPresetOptions
  ) {
    this.action = `add:${options.id}`;
    this.label = options.label;
    this.#components = options.components;
  }

  get icon(): string {
    return actorIcon(this.#components.map(({ type }) => type));
  }

  get presets(): readonly ActorPreset[] {
    return [this];
  }

  get menuEntry(): MenuItem<AddActorAction> {
    const picks = this.#components.some(({ type }) => picksAssets(type));

    return {
      id: this.action,
      label: picks ? `${this.label}…` : this.label,
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
