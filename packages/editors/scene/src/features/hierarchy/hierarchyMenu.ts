// Import Third-party Dependencies
import type {
  MenuEntry,
  MenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { picksAssets } from "../../components/sceneComponents.ts";
import {
  ACTOR_PRESETS,
  presetIcon,
  type ActorPreset,
  type ActorPresetGroup
} from "./model/actorPresets.ts";

// CONSTANTS
const kSections: readonly (readonly ActorPresetGroup[])[] = [
  ["Actor"],
  ["Light", "Primitive"],
  ["Asset"]
];
const kSubmenus: ReadonlySet<ActorPresetGroup> = new Set(["Light", "Primitive"]);

export function addEntries(): MenuEntry<string>[] {
  function item(preset: ActorPreset): MenuItem<string> {
    const type = preset.component?.type;

    return {
      id: `add:${preset.id}`,
      label: type !== undefined && picksAssets(type) ?
        `${preset.label}…` :
        preset.label,
      icon: presetIcon(preset)
    };
  }
  function groupEntries(group: ActorPresetGroup): MenuEntry<string>[] {
    const presets = ACTOR_PRESETS.filter((preset) => preset.group === group);
    if (!kSubmenus.has(group)) {
      return presets.map(item);
    }

    return [
      {
        id: `group:${group}`,
        label: group,
        icon: presetIcon(presets[0]),
        items: presets.map(item)
      }
    ];
  }

  return kSections.flatMap((groups, index): MenuEntry<string>[] => [
    ...index === 0 ? [] : ["separator" as const],
    ...groups.flatMap(groupEntries)
  ]);
}

export function rowEntries(): MenuEntry<string>[] {
  return [
    {
      id: "group:add-child",
      label: "Add child",
      icon: "plus",
      items: addEntries()
    },
    "separator",
    {
      id: "rename",
      label: "Rename",
      icon: "action-rename"
    },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: "action-duplicate"
    },
    "separator",
    {
      id: "delete",
      label: "Delete",
      icon: "action-delete",
      intent: "danger"
    }
  ];
}

export function presetOfAction(
  action: string
): ActorPreset | null {
  return ACTOR_PRESETS.find((preset) => `add:${preset.id}` === action) ?? null;
}
