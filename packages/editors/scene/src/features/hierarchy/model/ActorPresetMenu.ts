// Import Third-party Dependencies
import { SCENE_ACTOR_CATEGORIES } from "@jolly-pixel/editor.host/scene";
import type { MenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  EMPTY_PRESET,
  type SceneComponents
} from "../../../components/SceneComponents.ts";
import {
  ActorPreset,
  type ActorPresetRegistry,
  type AddActorAction
} from "./ActorPreset.ts";
import { ActorPresetFolder } from "./ActorPresetFolder.ts";

export class ActorPresetMenu {
  readonly entries: readonly MenuEntry<AddActorAction>[];
  readonly #presets: ReadonlyMap<AddActorAction, ActorPreset>;

  constructor(
    components: ActorPresetRegistry & Pick<SceneComponents, "presetSections">
  ) {
    const empty = new ActorPreset(EMPTY_PRESET, components);
    const folders = SCENE_ACTOR_CATEGORIES.flatMap((category) => {
      const sections = components.presetSections(category.id).map(
        ({ presets }) => presets.map(
          (preset) => new ActorPreset(preset, components)
        )
      );

      return sections.length === 0 ?
        [] :
        [new ActorPresetFolder(category, sections)];
    });

    this.entries = [
      empty.menuEntry,
      ...folders.length === 0 ? [] : ["separator" as const],
      ...folders.map(({ menuEntry }) => menuEntry)
    ];
    this.#presets = new Map(
      [empty, ...folders.flatMap(({ presets }) => presets)]
        .map((preset) => [preset.action, preset])
    );
  }

  find(
    action: AddActorAction
  ): ActorPreset | undefined {
    return this.#presets.get(action);
  }
}
