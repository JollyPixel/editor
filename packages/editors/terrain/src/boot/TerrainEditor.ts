// Import Third-party Dependencies
import {
  describeSkippedStep,
  type HistoryStepInfo
} from "@jolly-pixel/history";
import type { Runtime } from "@jolly-pixel/runtime";
import {
  TERRAIN_KIND,
  terrainDocumentKind,
  type TerrainDocument
} from "@jolly-pixel/asset.terrain/client";
import {
  bindPresenceStack,
  EditorRuntime,
  type AssetLease,
  type EditorSession,
  type HostLogger,
  type RuntimeEditorContext
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";
import {
  LocalStorageAdapter,
  LogQueue
} from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import { RoomGrants } from "@jolly-pixel/network/client";

import type { TerrainView } from "@jolly-pixel/terrain.renderer";
import { TEXTURE_ASSET } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  TERRAIN_CAPABILITIES,
  type TerrainAccess,
  type TerrainGrants
} from "../access/TerrainAccess.ts";
import { TerrainExchange } from "../features/importExport/model/TerrainExchange.ts";
import { downloadFile } from "../features/importExport/panel/downloadFile.ts";
import "../features/importExport/panel/ExchangePanel.ts";
import { MaterialPalette } from "../features/materials/model/MaterialPalette.ts";
import { MaterialSelection } from "../features/materials/model/MaterialSelection.ts";
import { MaterialThumbnails } from "../features/materials/model/MaterialThumbnails.ts";
import { textureDocumentKind } from "../features/materials/model/TextureDocument.ts";
import { TextureLeases } from "../features/materials/model/TextureLeases.ts";
import { parentFolder } from "../features/materials/model/textureNames.ts";
import "../features/materials/panel/MaterialPalettePanel.ts";
import { PoiEditor } from "../features/poi/model/PoiEditor.ts";
import { PoiSelection } from "../features/poi/model/PoiSelection.ts";
import "../features/poi/panel/PoiPanel.ts";
import { SculptSettings } from "../features/sculpt/model/SculptSettings.ts";
import "../features/sculpt/toolbar/SculptToolbar.ts";
import { OverlaySettings } from "../features/overlays/model/OverlaySettings.ts";
import "../features/overlays/toolbar/OverlayToolbar.ts";
import { TerrainEditorScene } from "../scene/TerrainEditorScene.ts";
import { PresenceStore } from "../shared/PresenceStore.ts";
import {
  createTerrainHistory,
  TERRAIN_REFUSAL_WORDING,
  type TerrainHistory
} from "../shared/terrainHistory.ts";

// CONSTANTS
const kCanvas = "#game-container canvas";
const kTerrainKind = terrainDocumentKind();
const kTextureKind = textureDocumentKind();
const kTextureFolder = "textures";
const kViewOnlyRefused = "You can only view this terrain, so the change was not saved";
const kAccessElements = [
  "terrain-sculpt-toolbar",
  "terrain-material-palette",
  "terrain-poi-panel",
  "terrain-exchange-panel"
].join(",");

export interface TerrainEditorParts {
  runtime: Runtime;
  scene: TerrainEditorScene;
  session: EditorSession;
  target: AssetLease<TerrainDocument>;
  disposables: Array<() => void>;
}

export class TerrainEditor {
  static readonly accepts = TERRAIN_KIND;
  static readonly identity = {
    title: "Join terrain"
  };
  static readonly kinds = [kTerrainKind];

  static createRuntime(
    logger: HostLogger
  ): Promise<EditorRuntime> {
    return EditorRuntime.create(kCanvas, {
      includePerformanceStats: {
        position: "top-right"
      },
      focusCanvas: false,
      viewHelper: true,
      logger
    });
  }

  static async mount(
    context: RuntimeEditorContext
  ): Promise<TerrainEditor> {
    const {
      session,
      runtime: editorRuntime
    } = context;
    const target = session.targetLease(kTerrainKind);
    const disposables: Array<() => void> = [];
    try {
      const scene = await mountScene(context, target, disposables);

      return new TerrainEditor({
        runtime: editorRuntime.runtime,
        scene,
        session,
        target,
        disposables
      });
    }
    catch (error) {
      disposeAll(disposables);

      throw error;
    }
  }

  #target: AssetLease<TerrainDocument>;
  #disposables: Array<() => void>;

  readonly ready: Promise<void>;
  readonly runtime: Runtime;
  readonly scene: TerrainEditorScene;
  readonly session: EditorSession;

  constructor(
    parts: TerrainEditorParts
  ) {
    this.runtime = parts.runtime;
    this.scene = parts.scene;
    this.session = parts.session;
    this.#target = parts.target;
    this.#disposables = parts.disposables;
    this.ready = parts.target.ready;
  }

  get view(): TerrainView {
    return this.scene.view;
  }

  get document(): TerrainDocument {
    return this.#target.document;
  }

  dispose(): void {
    disposeAll(this.#disposables);
  }
}

async function mountScene(
  context: RuntimeEditorContext,
  target: AssetLease<TerrainDocument>,
  disposables: Array<() => void>
): Promise<TerrainEditorScene> {
  const toolbar = document.querySelector("jolly-editor-toolbar");
  if (toolbar !== null) {
    toolbar.sources = context.toolbar;
  }

  const sculpt = new SculptSettings(new LocalStorageAdapter());
  const history = createTerrainHistory(target.document);
  disposables.push(() => history.dispose());
  const log = new LogQueue();
  function onSkipped(
    _scope: string,
    step: HistoryStepInfo
  ): void {
    log.push(describeSkippedStep(step, TERRAIN_REFUSAL_WORDING));
  }
  history.on("skipped", onSkipped);
  disposables.push(() => history.off("skipped", onSkipped));
  const activityLog = document.querySelector("jolly-log");
  if (activityLog !== null) {
    disposables.push(log.subscribe((entries) => {
      activityLog.entries = entries;
    }));
  }
  const sculptToolbar = document.querySelector("terrain-sculpt-toolbar");
  if (sculptToolbar !== null) {
    sculptToolbar.settings = sculpt;
    sculptToolbar.history = history;
    disposables.push(() => {
      sculptToolbar.settings = null;
      sculptToolbar.history = null;
    });
  }

  const overlaySettings = new OverlaySettings(new LocalStorageAdapter());
  const overlayToolbar = document.querySelector("terrain-overlay-toolbar");
  if (overlayToolbar !== null) {
    overlayToolbar.settings = overlaySettings;
    disposables.push(() => {
      overlayToolbar.settings = null;
    });
  }

  const access = new RoomGrants(target.room, TERRAIN_CAPABILITIES);
  disposables.push(() => access.dispose());
  disposables.push(access.subscribe("denied", () => log.push(kViewOnlyRefused)));

  const selection = new MaterialSelection(target.document);
  disposables.push(() => selection.dispose());
  const poiSelection = new PoiSelection(target.document);
  disposables.push(() => poiSelection.dispose());
  const leases = new TextureLeases((assetId) => context.session.lease(kTextureKind, assetId));
  const scene = new TerrainEditorScene({
    document: target.document,
    sculpt,
    overlaySettings,
    history,
    room: target.room,
    leases,
    selection,
    poiSelection,
    access
  });
  const { sceneManager } = context.runtime.runtime.world;
  disposables.push(() => sceneManager.unloadScene(scene));
  await context.runtime.load(scene);
  mountMaterialPalette(
    context,
    target,
    { history, selection, leases, overlay: overlaySettings },
    disposables
  );
  mountPoiPanel(target.document, { history, selection: poiSelection }, disposables);
  mountExchangePanel(context, target.document, history, disposables);
  disposables.push(publishAccess(access));

  const presence = new PresenceStore();
  const roster = new PeerRoster({
    room: target.room,
    publish: (peers) => {
      presence.peers = peers;
    },
    log
  });
  disposables.push(() => roster.dispose());
  const presenceStack = document.querySelector("jolly-presence-stack");
  if (presenceStack !== null) {
    disposables.push(bindPresenceStack(
      presenceStack,
      presence,
      (clientId) => scene.teleportToPeer(clientId)
    ));
  }

  return scene;
}

function mountMaterialPalette(
  context: RuntimeEditorContext,
  target: AssetLease<TerrainDocument>,
  shared: {
    history: TerrainHistory;
    selection: MaterialSelection;
    leases: TextureLeases;
    overlay: OverlaySettings;
  },
  disposables: Array<() => void>
): void {
  const element = document.querySelector("terrain-material-palette");
  if (element === null) {
    return;
  }

  const { session } = context;
  const { history, selection, leases } = shared;
  const terrain = target.document;
  const thumbnails = new MaterialThumbnails({
    document: terrain,
    leases,
    createUrl: (bytes) => URL.createObjectURL(new Blob([bytes.slice()])),
    revokeUrl: (url) => URL.revokeObjectURL(url)
  });
  const terrainFolder = parentFolder(session.target.record.path);
  const palette = new MaterialPalette({
    document: terrain,
    selection,
    history,
    catalog: session.catalog,
    importFolder: terrainFolder === "" ? kTextureFolder : `${terrainFolder}/${kTextureFolder}`,
    pickTexture: (title) => session.pickAsset({ kinds: [TEXTURE_ASSET], title }),
    askConflict: async(paths) => {
      const { askTextureConflict } = await import("../features/materials/panel/askTextureConflict.ts");

      return askTextureConflict(paths);
    }
  });
  element.context = { document: terrain, palette, selection, thumbnails, overlay: shared.overlay };
  disposables.push(() => {
    element.context = null;
    thumbnails.dispose();
  });
}

function mountPoiPanel(
  terrain: TerrainDocument,
  shared: {
    history: TerrainHistory;
    selection: PoiSelection;
  },
  disposables: Array<() => void>
): void {
  const element = document.querySelector("terrain-poi-panel");
  if (element === null) {
    return;
  }

  const editor = new PoiEditor({ document: terrain, ...shared });
  element.context = { document: terrain, editor, selection: shared.selection };
  disposables.push(() => {
    element.context = null;
  });
}

function mountExchangePanel(
  { session }: RuntimeEditorContext,
  terrain: TerrainDocument,
  history: TerrainHistory,
  disposables: Array<() => void>
): void {
  const element = document.querySelector("terrain-exchange-panel");
  if (element === null) {
    return;
  }

  const baseName = session.target.record.path.split("/").at(-1)!.split(".")[0];
  element.context = {
    document: terrain,
    exchange: new TerrainExchange({ document: terrain, history, baseName }),
    download: downloadFile
  };
  disposables.push(() => {
    element.context = null;
  });
}

function publishAccess(
  access: TerrainGrants
): () => void {
  const elements = document.querySelectorAll<HTMLElement & { access: TerrainAccess; }>(kAccessElements);
  function publish(): void {
    for (const element of elements) {
      element.access = access.current;
    }
  }
  publish();

  return access.subscribe("change", publish);
}

function disposeAll(
  disposables: Array<() => void>
): void {
  for (const dispose of disposables.splice(0).reverse()) {
    dispose();
  }
}
