// Import Third-party Dependencies
import {
  SCENE_COMPONENT_CATEGORIES,
  type SceneComponentKind
} from "@jolly-pixel/editor.host/scene";
import type {
  MenuEntry,
  MenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { SceneComponents } from "./SceneComponents.ts";

// CONSTANTS
const kPrefix = "add-component:";

export type AddComponentAction = `${typeof kPrefix}${string}`;

type MenuComponents = Pick<SceneComponents, "kinds" | "icon" | "picksAssets">;

export function addComponentEntries(
  components: MenuComponents
): MenuEntry<AddComponentAction>[] {
  const byCategory = Map.groupBy(components.kinds, ({ category }) => category);

  return SCENE_COMPONENT_CATEGORIES.flatMap(({ id, label }): MenuEntry<AddComponentAction>[] => {
    const items = (byCategory.get(id) ?? []).map(
      (kind) => componentItem(kind, components)
    );
    if (items.length < 2) {
      return items;
    }

    return [{
      id: `category:${id}`,
      label,
      icon: items[0].icon,
      items
    }];
  });
}

export function isAddComponentAction(
  action: string
): action is AddComponentAction {
  return action.startsWith(kPrefix);
}

export function addedComponentType(
  action: AddComponentAction
): string {
  return action.slice(kPrefix.length);
}

function componentItem(
  { definition: { type }, label }: SceneComponentKind,
  components: MenuComponents
): MenuItem<AddComponentAction> {
  return {
    id: `${kPrefix}${type}`,
    label: components.picksAssets(type) ? `${label}…` : label,
    icon: components.icon(type)
  };
}
