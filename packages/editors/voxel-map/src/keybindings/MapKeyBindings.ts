// Import Third-party Dependencies
import {
  KeyBindingSettings,
  type KeyBindingDefaults,
  type KeyBindingSettingsOptions
} from "@jolly-pixel/controls";

// CONSTANTS
export const KEY_BINDINGS_STORAGE_KEY = "voxel-map:keybindings";
export const MAP_KEY_BINDINGS = Object.freeze({
  "tool.brush": "b",
  "tool.select": "m",
  "edit.undo": "Mod+z",
  "edit.redo": ["Mod+y", "Mod+Shift+z"],
  "edit.copy": "Mod+c",
  "edit.cut": "Mod+x",
  "edit.paste": "Mod+v",
  "edit.delete": ["Delete", "Backspace"],
  "edit.selectLayer": "Mod+a",
  "brush.mode": "r",
  "brush.pattern": "c",
  "brush.ghost": "g",
  "brush.shrink": "BracketLeft",
  "brush.grow": "BracketRight",
  "orient.rotateCounterClockwise": "KeyQ",
  "orient.rotateClockwise": "KeyE",
  "orient.flipVertical": "v",
  "orient.mirrorHorizontal": "h",
  "orient.autoRotation": "t",
  "view.frame": "f",
  "view.grid": [],
  "view.glow": [],
  "view.chunkBounds": [],
  "view.inspector": []
} as const satisfies KeyBindingDefaults<string>);

export type MapAction = keyof typeof MAP_KEY_BINDINGS;
export type MapActionGroup = MapAction extends `${infer TGroup}.${string}` ?
  TGroup :
  never;
export type MapGroupAction<TGroup extends MapActionGroup> = Extract<
  MapAction,
  `${TGroup}.${string}`
>;

export type MapKeyBindingSettingsOptions = Omit<
  KeyBindingSettingsOptions<MapAction>,
  "defaults" | "storageKey"
>;

export class MapKeyBindingSettings extends KeyBindingSettings<MapAction> {
  constructor(
    options: MapKeyBindingSettingsOptions
  ) {
    super({
      ...options,
      defaults: MAP_KEY_BINDINGS,
      storageKey: KEY_BINDINGS_STORAGE_KEY
    });
  }
}
