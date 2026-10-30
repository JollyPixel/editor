// Import Third-party Dependencies
import type { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
import type {
  KeyBindingSettings,
  ShortcutLabels
} from "@jolly-pixel/controls";
import type { Room } from "@jolly-pixel/network/client";
import type { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { TerrainGrants } from "../access/TerrainAccess.ts";
import type { TextureLeases } from "../features/materials/model/TextureLeases.ts";
import type { PoiSelection } from "../features/poi/model/PoiSelection.ts";
import type { TerrainAction } from "../keybindings/terrainActions.ts";
import type { TerrainHistory } from "../shared/terrainHistory.ts";
import type { MaterialSelection } from "../state/MaterialSelection.ts";
import type { OverlaySettings } from "../state/OverlaySettings.ts";
import type { PresenceStore } from "../state/PresenceStore.ts";
import type { SculptSettings } from "../state/SculptSettings.ts";

export interface TerrainEditing {
  document: TerrainDocument;
  room: Room;
  access: TerrainGrants;
  history: TerrainHistory;
  log: LogQueue;
  sculpt: SculptSettings;
  overlaySettings: OverlaySettings;
  selection: MaterialSelection;
  poiSelection: PoiSelection;
  leases: TextureLeases;
  presence: PresenceStore;
  keyBindings: KeyBindingSettings<TerrainAction>;
  shortcuts: ShortcutLabels<TerrainAction>;
}
