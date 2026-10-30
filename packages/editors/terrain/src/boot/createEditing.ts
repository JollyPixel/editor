// Import Third-party Dependencies
import type { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
import { ShortcutLabels } from "@jolly-pixel/controls";
import {
  followKeyBindings,
  type AssetLease,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import {
  describeSkippedStep,
  type HistoryStepInfo
} from "@jolly-pixel/history";
import { RoomGrants } from "@jolly-pixel/network/client";
import {
  LocalStorageAdapter,
  LogQueue
} from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import { TERRAIN_CAPABILITIES } from "../access/TerrainAccess.ts";
import type { TerrainEditing } from "../editing/TerrainEditing.ts";
import { textureDocumentKind } from "../features/materials/model/TextureDocument.ts";
import { TextureLeases } from "../features/materials/model/TextureLeases.ts";
import { PoiSelection } from "../features/poi/model/PoiSelection.ts";
import { TERRAIN_KEYBINDINGS } from "../preferences.ts";
import {
  createTerrainHistory,
  TERRAIN_REFUSAL_WORDING
} from "../shared/terrainHistory.ts";
import { MaterialSelection } from "../state/MaterialSelection.ts";
import { OverlaySettings } from "../state/OverlaySettings.ts";
import { PresenceStore } from "../state/PresenceStore.ts";
import { SculptSettings } from "../state/SculptSettings.ts";

// CONSTANTS
const kTextureKind = textureDocumentKind();
const kViewOnlyRefused = "You can only view this terrain, so the change was not saved";

export function createEditing(
  context: RuntimeEditorContext,
  target: AssetLease<TerrainDocument>,
  disposables: Array<() => void>
): TerrainEditing {
  const { document, room } = target;
  const log = new LogQueue();

  const history = createTerrainHistory(document);
  disposables.push(() => history.dispose());
  function onSkipped(
    _scope: string,
    step: HistoryStepInfo
  ): void {
    log.push(describeSkippedStep(step, TERRAIN_REFUSAL_WORDING));
  }
  history.on("skipped", onSkipped);
  disposables.push(() => history.off("skipped", onSkipped));

  const access = new RoomGrants(room, TERRAIN_CAPABILITIES);
  disposables.push(
    () => access.dispose(),
    access.subscribe("denied", () => log.push(kViewOnlyRefused))
  );

  const selection = new MaterialSelection(document);
  disposables.push(() => selection.dispose());
  const poiSelection = new PoiSelection(document);
  disposables.push(() => poiSelection.dispose());

  const presence = new PresenceStore();
  const roster = new PeerRoster({
    room,
    publish: (peers) => {
      presence.peers = peers;
    },
    log
  });
  disposables.push(() => roster.dispose());

  const keyBindings = followKeyBindings(
    context.preferences,
    TERRAIN_KEYBINDINGS,
    (message) => console.warn(message)
  );

  return {
    document,
    room,
    access,
    history,
    log,
    sculpt: new SculptSettings(new LocalStorageAdapter()),
    overlaySettings: new OverlaySettings(new LocalStorageAdapter()),
    selection,
    poiSelection,
    leases: new TextureLeases((assetId) => context.session.lease(kTextureKind, assetId)),
    presence,
    keyBindings,
    shortcuts: new ShortcutLabels(context.keyboardLayout, keyBindings)
  };
}
