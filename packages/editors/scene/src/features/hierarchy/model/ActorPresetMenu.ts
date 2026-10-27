// Import Third-party Dependencies
import type { SceneActorPresetEntry } from "@jolly-pixel/editor.host/scene";
import type { MenuEntry } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { SceneComponents } from "../../../components/SceneComponents.ts";
import {
  ActorPreset,
  type ActorPresetRegistry,
  type AddActorAction
} from "./ActorPreset.ts";
import { ActorPresetSubmenu } from "./ActorPresetSubmenu.ts";

export class ActorPresetMenu {
  static #entry(
    entry: SceneActorPresetEntry,
    registry: ActorPresetRegistry
  ): ActorPreset | ActorPresetSubmenu {
    return "presets" in entry ?
      new ActorPresetSubmenu(
        entry.label,
        entry.presets.map((preset) => new ActorPreset(preset, registry))
      ) :
      new ActorPreset(entry, registry);
  }

  readonly entries: readonly MenuEntry<AddActorAction>[];
  readonly #presets: ReadonlyMap<AddActorAction, ActorPreset>;

  constructor(
    components: ActorPresetRegistry & Pick<SceneComponents, "presetSections">
  ) {
    const sections = components.presetSections.map(
      (section) => section.map(
        (entry) => ActorPresetMenu.#entry(entry, components)
      )
    );
    this.entries = sections.flatMap((section, index) => [
      ...index === 0 ? [] : ["separator" as const],
      ...section.map(({ menuEntry }) => menuEntry)
    ]);
    this.#presets = new Map(
      sections
        .flat()
        .flatMap(({ presets }) => presets)
        .map((preset) => [preset.action, preset])
    );
  }

  find(
    action: AddActorAction
  ): ActorPreset | undefined {
    return this.#presets.get(action);
  }
}
