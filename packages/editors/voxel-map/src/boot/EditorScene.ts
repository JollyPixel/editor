// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import {
  Grid,
  type GridOptions
} from "@jolly-pixel/three";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer/engine";
import type { PeerIdentity } from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import {
  PeerFrustums,
  type AssetLeases,
  type EditorArchives
} from "@jolly-pixel/editor.host";
import type {
  SyncedVoxelMap,
  VoxelMapRoom
} from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import { MapDocument } from "../document/MapDocument.ts";
import { bindHistoryShortcuts } from "../shared/historyShortcuts.ts";
import type { EditorState } from "../state/index.ts";
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import { BlockUsageStore } from "../features/blocks/usage/BlockUsageStore.ts";
import { BlockRenderSources } from "../features/blocks/rendering/BlockRenderSources.ts";
import { LayerVisibilityStore } from "../features/layers/LayerVisibilityStore.ts";
import { LocalLayerVisibility } from "../features/layers/LocalLayerVisibility.ts";
import { MapLayers } from "../features/layers/MapLayers.ts";
import { ObjectLayerRenderer } from "../features/layers/objects/ObjectLayerRenderer.ts";
import { trackBlockPresence } from "../features/blocks/collaboration/blockPresence.ts";
import { trackLayerPresence } from "../features/layers/collaboration/layerPresence.ts";
import { BrushStore } from "../features/painting/BrushStore.ts";
import { LocalBrush } from "../features/painting/LocalBrush.ts";
import { PeerBrushes } from "../features/painting/collaboration/PeerBrushes.ts";
import { bindBrushShortcuts } from "../features/painting/interaction/brushShortcuts.ts";
import { MapPlacement } from "../features/placement/MapPlacement.ts";
import { PlacementGizmo } from "../features/placement/PlacementGizmo.ts";
import { PeerPlacements } from "../features/placement/collaboration/PeerPlacements.ts";
import { bindPlacementShortcuts } from "../features/placement/placementShortcuts.ts";
import { MapTemplates } from "../features/templates/MapTemplates.ts";
import {
  MapTilesets,
  type TilesetCatalog
} from "../features/tilesets/MapTilesets.ts";
import { openTileset } from "../features/tilesets/TilesetBinding.ts";
import { SceneLighting } from "../scene/environment/SceneLighting.ts";
import { SceneEnvironment } from "../scene/environment/SceneEnvironment.ts";
import { EditorCamera } from "../scene/camera/EditorCamera.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kGrid: GridOptions = {
  extent: 400,
  infiniteGrid: true,
  fade: {
    from: "camera",
    distance: 50
  },
  cell: {
    style: "lines"
  },
  section: {
    size: 16,
    color: "#4b4b4b"
  },
  hideCellOnSection: true,
  hideCellOnSectionFadeWidth: 1,
  axes: {
    show: false
  }
};

export interface EditorSceneSession {
  room: VoxelMapRoom;
  map: SyncedVoxelMap;
  identity: PeerIdentity;
  catalog: TilesetCatalog;
  assets: AssetLeases;
  archives: EditorArchives;
}

export interface EditorSceneOptions {
  state: EditorState;
  session: EditorSceneSession;
  samples?: number;
}

export class EditorScene extends Systems.Scene {
  #options: EditorSceneOptions;
  #workspace = Promise.withResolvers<VoxelMapWorkspace>();
  #disposables: Array<() => void> = [];
  #camera: EditorCamera | undefined;
  #environment: SceneEnvironment | undefined;

  get ready(): Promise<VoxelMapWorkspace> {
    return this.#workspace.promise;
  }

  get camera(): EditorCamera | undefined {
    return this.#camera;
  }

  constructor(
    options: EditorSceneOptions
  ) {
    super("editor");
    this.#options = options;
  }

  override awake(): void {
    const {
      state,
      session,
      samples
    } = this.#options;
    const world = this.world;
    const scene = world.sceneManager.getSource();
    const layerVisibility = new LayerVisibilityStore();

    const lighting = new SceneLighting(world.renderer.getSource());
    scene.add(...lighting.lights);

    const camera = new EditorCamera({
      world,
      pointer: state.pointer,
      log: state.log,
      samples
    });
    this.#camera = camera;

    const { keyboard } = world.input;

    const { view } = world
      .createActor("map")
      .addComponentAndGet(VoxelRenderer, {
        document: session.map.voxels,
        rendering: {
          material: "lambert"
        },
        tilesets: []
      });

    const environment = new SceneEnvironment({
      renderer: world.renderer.getSource(),
      scene,
      lighting,
      chunks: view.lighting
    });
    environment.apply(state.view.settings);
    this.#environment = environment;

    const blockSources = BlockRenderSources.of(view);
    const mapDocument = new MapDocument({
      map: session.map,
      defaultLayerName: kDefaultLayerName
    });
    const templates = new MapTemplates({
      world: view.document.world,
      mapDocument
    });
    const localVisibility = new LocalLayerVisibility({
      world: view.document.world,
      layers: view.layerVisibility,
      mapDocument,
      visibility: layerVisibility
    });
    const layers = new MapLayers({
      world: view.document.world,
      selection: state.selection,
      mapDocument
    });
    const placement = new MapPlacement({
      world: view.document.world,
      history: view.document.history,
      selection: state.selection,
      mapDocument,
      conceal: (layerName) => localVisibility.conceal(layerName)
    });
    const usage = new BlockUsageStore({
      mapDocument,
      source: view.inspector.blocks
    });
    const tilesets = new MapTilesets({
      view,
      catalog: session.catalog,
      mapDocument,
      open: (assetId) => openTileset(session.assets, assetId)
    });

    const grid = new Grid(kGrid);
    world
      .createActor("grid")
      .addChildren(grid);
    const roster = new PeerRoster({
      room: session.room,
      identity: session.identity,
      publish: (peers) => {
        state.presence.peers = peers;
      },
      log: state.log
    });
    const releaseBlockPresence = trackBlockPresence({
      room: session.room,
      block: state.block,
      presence: state.presence
    });
    const releaseLayerPresence = trackLayerPresence({
      room: session.room,
      selection: state.selection,
      presence: state.presence
    });
    const peerBrushes = world
      .createActor("peer-brushes")
      .addComponentAndGet(PeerBrushes, {
        room: session.room
      });
    const peerPlacements = world
      .createActor("peer-placements")
      .addComponentAndGet(PeerPlacements, {
        room: session.room,
        world: view.document.world,
        blockRegistry: view.document.blocks,
        sources: blockSources,
        mapDocument
      });
    const frustums = world
      .createActor("peer-frustums")
      .addComponentAndGet(PeerFrustums, {
        room: session.room,
        camera: camera.camera
      });
    const brush = new BrushStore();
    const localBrush = world
      .createActor("brush")
      .addComponentAndGet(LocalBrush, {
        view,
        sources: blockSources,
        camera: camera.camera,
        brush,
        block: state.block,
        selection: state.selection,
        pointer: state.pointer,
        color: session.identity.color,
        onCursorChange: (cursor) => peerBrushes.publishLocalCursor(cursor),
        onFocusRequest: (point) => camera.focus(point),
        onPaintBlocked: () => {
          state.log.push("No voxel layer to paint on: add one in the Layers panel");
        }
      });

    world.createActor("placement")
      .addComponent(PlacementGizmo, {
        view,
        sources: blockSources,
        camera: camera.camera,
        placement,
        pointer: state.pointer,
        mapDocument,
        color: session.identity.color
      });
    world.createActor("object-layer-renderer")
      .addComponent(ObjectLayerRenderer, {
        world: view.document.world,
        camera: camera.camera,
        selection: state.selection,
        pointer: state.pointer,
        mapDocument,
        visibility: layerVisibility
      });
    this.#disposables.push(
      placement.subscribe("change", (current) => {
        brush.suspended = current !== null;
      }),
      () => {
        brush.suspended = false;
      },
      mapDocument.subscribe("reset", () => {
        camera.spawn(view.document.world.getLayers());
      }),
      state.view.subscribe("change", (settings) => {
        environment.apply(settings);
        world.invalidate();
      }),
      bindBrushShortcuts({
        keyboard,
        brush,
        selection: state.selection
      }),
      bindHistoryShortcuts({
        keyboard,
        history: view.document.history
      }),
      bindPlacementShortcuts({
        keyboard,
        placement
      }),
      state.keyboardLayout.watch(window),
      () => camera.dispose(),
      () => environment.dispose(),
      releaseBlockPresence,
      releaseLayerPresence,
      () => roster.dispose(),
      placement.subscribe(
        "change",
        (current) => peerPlacements.publishLocal(current?.placement ?? null)
      ),
      () => tilesets.dispose(),
      () => usage.dispose(),
      () => placement.dispose(),
      () => layers.dispose(),
      () => templates.dispose(),
      () => localVisibility.dispose(),
      () => mapDocument.dispose()
    );

    if (mapDocument.ready) {
      camera.spawn(view.document.world.getLayers());
    }

    this.#workspace.resolve({
      state,
      brush,
      mapDocument,
      usage,
      blockSources,
      templates,
      placement,
      layerVisibility,
      layers,
      view,
      grid,
      localBrush,
      tilesets,
      archives: session.archives,
      focusPoint: () => camera.focusPoint(view.root),
      pointAt: (clientX, clientY) => camera.pointAt(
        view.root,
        clientX,
        clientY
      ),
      loadWorld: (data) => {
        camera.requestSpawn();
        mapDocument.load(data);
      },
      teleportToPeer: (clientId) => {
        const pose = frustums.poseOf(clientId);
        if (pose !== undefined) {
          camera.teleport(pose);
        }
      }
    });
  }

  override update(): void {
    if (this.#camera !== undefined) {
      this.#environment?.follow(this.#camera.camera);
    }
  }

  override destroy(): void {
    for (const dispose of this.#disposables.splice(0)) {
      dispose();
    }
    this.#camera = undefined;
    this.#environment = undefined;
    this.#workspace.reject(
      new Error("The editor scene was destroyed before it awoke.")
    );
  }
}
