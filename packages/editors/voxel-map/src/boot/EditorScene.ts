// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import {
  Grid,
  type GridOptions
} from "@jolly-pixel/three";
import type { MaterialGroup } from "@jolly-pixel/voxel.renderer";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer/engine";
import type { PeerIdentity } from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import { RoomGrants } from "@jolly-pixel/network/client";
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
import {
  createMapHistory,
  skippedMessage
} from "../shared/mapHistory.ts";
import { bindToolShortcuts } from "../shared/toolShortcuts.ts";
import type {
  EditorState,
  ViewSettings
} from "../state/index.ts";
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
import { MarqueeTool } from "../features/marquee/MarqueeTool.ts";
import { bindMarqueeShortcuts } from "../features/marquee/marqueeShortcuts.ts";
import { MapHistory } from "../features/placement/MapHistory.ts";
import { MapMaterials } from "../features/materials/MapMaterials.ts";
import { MapPlacement } from "../features/placement/MapPlacement.ts";
import { PlacementClick } from "../features/placement/PlacementClick.ts";
import { PlacementGizmo } from "../features/placement/PlacementGizmo.ts";
import { PeerPlacements } from "../features/placement/collaboration/PeerPlacements.ts";
import { bindPlacementShortcuts } from "../features/placement/placementShortcuts.ts";
import { bindClipboardShortcuts } from "../features/placement/clipboardShortcuts.ts";
import { MapTemplates } from "../features/templates/MapTemplates.ts";
import {
  MapBlocksets,
  type BlocksetCatalog
} from "../features/blocksets/MapBlocksets.ts";
import { openBlockset } from "../features/blocksets/BlocksetBinding.ts";
import { SceneLighting } from "../scene/environment/SceneLighting.ts";
import { SceneEnvironment } from "../scene/environment/SceneEnvironment.ts";
import { EditorCamera } from "../scene/camera/EditorCamera.ts";
import { PivotClick } from "../scene/camera/PivotClick.ts";
import { MAP_CAPABILITIES } from "../access/MapAccess.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kMaxAccessListeners = 32;
const kMapRefusedMessage = "You can only view this map, so the change was not saved";
const kBlocksetRefusedMessage = "You can only view this blockset, so the change was not saved";
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
  catalog: BlocksetCatalog;
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
        blocksets: [],
        requestFrame: () => this.#environment?.invalidateShadows()
      });

    const environment = new SceneEnvironment({
      renderer: world.renderer.getSource(),
      scene,
      lighting,
      chunks: view.lighting,
      casters: view
    });
    const { materialGroups } = session.map.voxels;
    function applyGlow(
      enabled: boolean
    ): void {
      camera.glow = enabled && anyGlows(materialGroups);
    }
    function applyView(
      settings: ViewSettings
    ): void {
      environment.apply(settings);
      applyGlow(settings.glow);
    }
    applyView(state.view.settings);
    this.#environment = environment;

    const blockSources = BlockRenderSources.fromView(view);
    const access = new RoomGrants(session.room, MAP_CAPABILITIES)
      .setMaxListeners(kMaxAccessListeners);
    const mapDocument = new MapDocument({
      map: session.map,
      defaultLayerName: kDefaultLayerName,
      access
    });
    const templates = new MapTemplates({
      world: view.document.world,
      mapDocument,
      access
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
      mapDocument,
      access
    });
    const mapHistory = createMapHistory(session.map.edits);
    mapHistory.on("skipped", (_scope, step) => {
      state.log.push(skippedMessage(step));
    });
    const placement = new MapPlacement({
      world: view.document.world,
      history: mapHistory,
      selection: state.selection,
      mapDocument,
      conceal: (layerName) => localVisibility.conceal(layerName),
      access
    });
    const history = new MapHistory({
      history: mapHistory,
      placement,
      access
    });
    const usage = new BlockUsageStore({
      mapDocument,
      source: view.inspector.blocks
    });
    const blocksets = new MapBlocksets({
      view,
      catalog: session.catalog,
      mapDocument,
      open: (assetId) => openBlockset(session.assets, assetId)
    });
    const materials = new MapMaterials({
      document: mapDocument,
      blocksets
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
        history: mapHistory,
        color: session.identity.color,
        onCursorChange: (cursor) => peerBrushes.publishLocalCursor(cursor),
        onPaintBlocked: () => {
          state.log.push("No voxel layer to paint on: add one in the Layers panel");
        }
      });
    world.createActor("pivot-click")
      .addComponent(PivotClick, {
        camera,
        solid: view.root,
        pointer: state.pointer
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
      })
      .addComponent(PlacementClick, {
        placement,
        pointer: state.pointer
      });
    world.createActor("object-layer-renderer")
      .addComponent(ObjectLayerRenderer, {
        world: view.document.world,
        camera: camera.camera,
        selection: state.selection,
        pointer: state.pointer,
        mapDocument,
        visibility: layerVisibility,
        access
      });
    function publishPlacement(): void {
      peerPlacements.publishLocal(
        placement.current?.placement ?? marquee.presence
      );
    }
    function suspendBrush(): void {
      brush.suspended = placement.placing ||
        state.tool.selecting ||
        !access.current.has("voxels");
    }

    const marquee = world.createActor("marquee")
      .addComponentAndGet(MarqueeTool, {
        view,
        camera: camera.camera,
        tool: state.tool,
        selection: state.selection,
        placement,
        pointer: state.pointer,
        color: session.identity.color,
        onChange: publishPlacement
      });
    suspendBrush();
    this.#disposables.push(
      placement.subscribe("change", suspendBrush),
      state.tool.subscribe("change", suspendBrush),
      access.subscribe("change", suspendBrush),
      access.subscribe("denied", () => {
        state.log.push(kMapRefusedMessage);
      }),
      blocksets.subscribe("denied", () => {
        state.log.push(kBlocksetRefusedMessage);
      }),
      () => {
        brush.suspended = false;
      },
      mapDocument.subscribe("reset", () => {
        camera.spawn(view.document.world.getLayers());
      }),
      state.view.subscribe("change", (settings) => {
        applyView(settings);
        world.invalidate();
      }),
      mapDocument.subscribe("materialGroupsChanged", () => {
        applyGlow(state.view.settings.glow);
        world.invalidate();
      }),
      bindBrushShortcuts({
        keyboard,
        brush,
        selection: state.selection
      }),
      bindHistoryShortcuts({
        keyboard,
        history
      }),
      bindPlacementShortcuts({
        keyboard,
        placement
      }),
      bindClipboardShortcuts({
        keyboard,
        placement,
        aimPoint: () => camera.aimPoint(view.root)
      }),
      bindToolShortcuts({
        keyboard,
        tool: state.tool
      }),
      bindMarqueeShortcuts({
        keyboard,
        world: view.document.world,
        tool: state.tool,
        selection: state.selection,
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
        publishPlacement
      ),
      () => blocksets.dispose(),
      () => usage.dispose(),
      () => placement.dispose(),
      () => mapHistory.dispose(),
      () => layers.dispose(),
      () => templates.dispose(),
      () => localVisibility.dispose(),
      () => mapDocument.dispose(),
      () => access.dispose()
    );

    if (mapDocument.ready) {
      camera.spawn(view.document.world.getLayers());
    }

    this.#workspace.resolve({
      state,
      access,
      brush,
      mapDocument,
      usage,
      blockSources,
      templates,
      placement,
      history,
      layerVisibility,
      layers,
      view,
      grid,
      localBrush,
      blocksets,
      materials,
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

function anyGlows(
  groups: Iterable<MaterialGroup>
): boolean {
  for (const group of groups) {
    if (group.glows) {
      return true;
    }
  }

  return false;
}
