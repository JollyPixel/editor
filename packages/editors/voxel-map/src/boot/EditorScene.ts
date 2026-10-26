// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import {
  Grid,
  type BakedRoomEnvironment,
  type GridOptions
} from "@jolly-pixel/three";
import type { MaterialGroup } from "@jolly-pixel/voxel.renderer";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer/engine";
import {
  DocumentTheme,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import { RoomGrants } from "@jolly-pixel/network/client";
import { describeSkippedStep } from "@jolly-pixel/history";
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
import { EditorMap } from "../map/EditorMap.ts";
import { historyShortcuts } from "../shared/historyShortcuts.ts";
import {
  createMapHistory,
  MAP_REFUSAL_WORDING
} from "../shared/mapHistory.ts";
import { MapSteps } from "../shared/MapSteps.ts";
import {
  bindToolExit,
  toolShortcuts
} from "../shared/toolShortcuts.ts";
import type {
  EditorState,
  ViewSettings
} from "../state/index.ts";
import type { VoxelMapEditing } from "../editing/VoxelMapEditing.ts";
import { BlockUsageStore } from "../features/blocks/usage/BlockUsageStore.ts";
import { BlockRenderSources } from "../features/blocks/rendering/BlockRenderSources.ts";
import { PreviewStage } from "../features/preview/PreviewStage.ts";
import { LayerVisibilityStore } from "../features/layers/LayerVisibilityStore.ts";
import { LocalLayerVisibility } from "../features/layers/LocalLayerVisibility.ts";
import { MapLayers } from "../features/layers/MapLayers.ts";
import { ObjectLayerRenderer } from "../features/layers/objects/ObjectLayerRenderer.ts";
import { trackBlockPresence } from "../features/blocks/collaboration/blockPresence.ts";
import { trackLayerPresence } from "../features/layers/collaboration/layerPresence.ts";
import {
  LocalBrush,
  type MissingPaintSource
} from "../features/painting/LocalBrush.ts";
import { PeerBrushes } from "../features/painting/collaboration/PeerBrushes.ts";
import {
  brushResizeShortcuts,
  brushShortcuts
} from "../features/painting/interaction/brushShortcuts.ts";
import { MarqueeTool } from "../features/marquee/MarqueeTool.ts";
import { marqueeShortcuts } from "../features/marquee/marqueeShortcuts.ts";
import { MapHistory } from "../features/placement/MapHistory.ts";
import { MapMaterials } from "../features/materials/MapMaterials.ts";
import { MapPlacement } from "../features/placement/MapPlacement.ts";
import { PlacementClick } from "../features/placement/PlacementClick.ts";
import { PlacementGizmo } from "../features/placement/PlacementGizmo.ts";
import { PeerPlacements } from "../features/placement/collaboration/PeerPlacements.ts";
import { bindPlacementShortcuts } from "../features/placement/placementShortcuts.ts";
import { clipboardShortcuts } from "../features/placement/clipboardShortcuts.ts";
import { MapTemplates } from "../features/templates/MapTemplates.ts";
import { TemplateEditing } from "../features/templates/editing/TemplateEditing.ts";
import { PeerEditContext } from "../features/templates/editing/PeerEditContext.ts";
import {
  MapBlocksets,
  type BlocksetCatalog
} from "../features/blocksets/MapBlocksets.ts";
import { openBlockset } from "../viewer/openBlockset.ts";
import { SceneLighting } from "../scene/environment/SceneLighting.ts";
import { SceneEnvironment } from "../scene/environment/SceneEnvironment.ts";
import { EditorCamera } from "../scene/camera/EditorCamera.ts";
import { PivotClick } from "../scene/camera/PivotClick.ts";
import { viewShortcuts } from "../scene/viewShortcuts.ts";
import { MAP_CAPABILITIES } from "../access/MapAccess.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kMaxAccessListeners = 32;
const kMapRefusedMessage = "You can only view this map, so the change was not saved";
const kBlocksetRefusedMessage = "You can only view this blockset, so the change was not saved";
const kPaintBlockedMessages: Readonly<Record<MissingPaintSource, string>> = {
  layer: "No voxel layer to paint on: add one in the Layers panel",
  block: "No block to paint with: create one in the Block Library"
};
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
  roomEnvironment: BakedRoomEnvironment | null;
}

export class EditorScene extends Systems.Scene {
  #options: EditorSceneOptions;
  #editing = Promise.withResolvers<VoxelMapEditing>();
  #disposables: Array<() => void> = [];
  #camera: EditorCamera | undefined;
  #environment: SceneEnvironment | undefined;

  get ready(): Promise<VoxelMapEditing> {
    return this.#editing.promise;
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
      samples,
      roomEnvironment
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
      samples,
      preferences: state.preferences
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

    const pageTheme = new DocumentTheme();
    const environment = new SceneEnvironment({
      renderer: world.renderer,
      scene,
      lighting,
      roomEnvironment,
      chunks: view.lighting,
      casters: view,
      theme: pageTheme.mode
    });
    const { materialGroups } = session.map.voxels;
    function applyGlow(
      enabled: boolean
    ): void {
      camera.glow = enabled && anyGlows(materialGroups);
    }
    const viewport = world.renderer.getSource().domElement.parentElement;
    function applyBackdrop(): void {
      if (viewport !== null) {
        viewport.dataset.backdrop = environment.backdrop;
      }
    }
    const grid = new Grid(kGrid);
    world
      .createActor("grid")
      .addChildren(grid);
    function applyView(
      settings: ViewSettings
    ): void {
      environment.apply(settings);
      applyGlow(settings.glow);
      applyBackdrop();
      grid.enabled = settings.grid;
      view.inspector.mode = settings.inspector;
      view.inspector.chunkBounds = settings.chunkBounds;
    }
    applyView(state.view.settings);
    this.#environment = environment;
    function invalidateShadows(): void {
      environment.invalidateShadows();
    }
    world.renderer.on("compiled", invalidateShadows);

    const blockSources = BlockRenderSources.fromView(view);
    const previewStage = new PreviewStage({
      renderer: world.renderer,
      environmentMap: () => environment.environmentMap
    });
    const access = new RoomGrants(session.room, MAP_CAPABILITIES)
      .setMaxListeners(kMaxAccessListeners);
    const editorMap = new EditorMap({
      map: session.map,
      defaultLayerName: kDefaultLayerName,
      access
    });
    const templates = new MapTemplates({
      world: view.document.world,
      editorMap,
      access,
      log: state.log
    });
    const localVisibility = new LocalLayerVisibility({
      world: view.document.world,
      layers: view.layerVisibility,
      editorMap,
      visibility: layerVisibility
    });
    const { editContext } = state;
    const layers = new MapLayers({
      world: view.document.world,
      selection: state.selection,
      editorMap,
      access,
      editContext
    });
    const mapHistory = createMapHistory(session.map.edits);
    mapHistory.on("skipped", (_scope, step) => {
      state.log.push(describeSkippedStep(step, MAP_REFUSAL_WORDING));
    });
    const steps = new MapSteps(mapHistory, editContext);
    const placement = new MapPlacement({
      world: view.document.world,
      history: steps,
      selection: state.selection,
      editorMap,
      conceal: (layerName) => localVisibility.conceal(layerName),
      access
    });
    const history = new MapHistory({
      history: mapHistory,
      placement,
      access,
      context: editContext
    });
    const templateEditing = new TemplateEditing({
      world: view.document.world,
      context: editContext,
      selection: state.selection,
      editorMap,
      access,
      isolate: (layerName) => localVisibility.isolate(layerName),
      camera,
      history: mapHistory,
      placement,
      presence: state.presence,
      log: state.log
    });
    const usage = new BlockUsageStore({
      editorMap,
      source: view.inspector.blocks
    });
    const blocksets = new MapBlocksets({
      view,
      catalog: session.catalog,
      editorMap,
      open: (assetId) => openBlockset(session.assets, assetId)
    });
    const materials = new MapMaterials({
      sources: editorMap,
      blocksets
    });

    const roster = new PeerRoster({
      room: session.room,
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
    const peers = new PeerEditContext({
      world: view.document.world,
      context: editContext,
      presence: state.presence
    });
    const peerBrushes = world
      .createActor("peer-brushes")
      .addComponentAndGet(PeerBrushes, {
        room: session.room,
        peers
      });
    const peerPlacements = world
      .createActor("peer-placements")
      .addComponentAndGet(PeerPlacements, {
        room: session.room,
        world: view.document.world,
        blockRegistry: view.document.blocks,
        sources: blockSources,
        editorMap,
        blocksets,
        peers
      });
    const frustums = world
      .createActor("peer-frustums")
      .addComponentAndGet(PeerFrustums, {
        room: session.room,
        camera: camera.camera
      });
    const { brush } = state;
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
        history: steps,
        color: session.identity.color,
        onCursorChange: (cursor) => peerBrushes.publishLocalCursor(cursor),
        onPaintBlocked: (missing) => {
          state.log.push(kPaintBlockedMessages[missing]);
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
        editorMap,
        blocksets,
        color: session.identity.color
      })
      .addComponent(PlacementClick, {
        placement,
        pointer: state.pointer
      });
    const objectLayers = world.createActor("object-layer-renderer");
    objectLayers
      .addComponent(ObjectLayerRenderer, {
        world: view.document.world,
        camera: camera.camera,
        selection: state.selection,
        pointer: state.pointer,
        editorMap,
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
    state.block.reconcile(editorMap.blocks);
    this.#disposables.push(
      editorMap.subscribe("blockRegistryChanged", () => {
        state.block.reconcile(editorMap.blocks);
      }),
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
      editorMap.subscribe("reset", () => {
        camera.spawn(EditorMap.layers(view.document.world));
      }),
      editContext.subscribe("change", (draft) => {
        objectLayers.object3D.visible = draft === null;
        world.invalidate();
      }),
      state.view.subscribe("change", (settings) => {
        applyView(settings);
        world.invalidate();
      }),
      pageTheme.follow((theme) => {
        environment.theme = theme;
        applyBackdrop();
        world.invalidate();
      }),
      editorMap.subscribe("materialGroupsChanged", () => {
        applyGlow(state.view.settings.glow);
        world.invalidate();
      }),
      state.mapKeyBindings.bind(keyboard, {
        ...toolShortcuts({ tool: state.tool }),
        ...historyShortcuts({ history }),
        ...clipboardShortcuts({
          placement,
          aimPoint: () => camera.aimPoint(view.root)
        }),
        ...marqueeShortcuts({
          world: view.document.world,
          tool: state.tool,
          selection: state.selection,
          placement
        }),
        ...brushShortcuts({
          brush,
          selection: state.selection,
          rotation: () => localBrush.orientation.rotation
        }),
        ...viewShortcuts({
          view: state.view,
          camera,
          world: view.document.world,
          layers,
          selection: state.selection
        })
      }),
      state.mapKeyBindings.bind(keyboard, brushResizeShortcuts({
        brush,
        selection: state.selection
      }), { repeat: true }),
      bindPlacementShortcuts({
        keyboard,
        keyBindings: state.mapKeyBindings,
        placement,
        rightAxis: () => camera.rightAxis()
      }),
      bindToolExit(keyboard, state.tool),
      () => camera.dispose(),
      () => environment.dispose(),
      () => world.renderer.off("compiled", invalidateShadows),
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
      () => templateEditing.dispose(),
      () => peers.dispose(),
      () => layers.dispose(),
      () => templates.dispose(),
      () => localVisibility.dispose(),
      () => editorMap.dispose(),
      () => access.dispose()
    );

    if (editorMap.ready) {
      camera.spawn(EditorMap.layers(view.document.world));
    }

    this.#editing.resolve({
      state,
      access,
      editorMap,
      usage,
      blockSources,
      previewStage,
      templates,
      templateEditing,
      placement,
      history,
      layerVisibility,
      layers,
      view,
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
        editorMap.load(data);
      },
      teleportToPeer: (clientId) => {
        const pose = frustums.peerPose(clientId);
        if (pose !== undefined) {
          camera.teleport(pose);
        }
      },
      frame: (bounds) => camera.frame(bounds)
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
    this.#editing.reject(
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
