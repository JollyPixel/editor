// Import Third-party Dependencies
import {
  Systems,
  OrbitFlyCamera
} from "@jolly-pixel/engine";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer/engine";
import {
  voxelTransparencyPass,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { PeerIdentity } from "@jolly-pixel/ui";
import type {
  AssetLeases,
  EditorArchives
} from "@jolly-pixel/editor.host";
import type {
  SyncedVoxelMap,
  VoxelMapRoom
} from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import {
  MapDocument,
  LeasedWorldSource
} from "../document/index.ts";
import type { EditorState } from "../state/index.ts";
import type { VoxelMapWorkspace } from "../workspace/VoxelMapWorkspace.ts";
import { BlockUsageStore } from "../features/blocks/usage/BlockUsageStore.ts";
import { BlockRenderSources } from "../features/blocks/rendering/BlockRenderSources.ts";
import { LayerVisibilityStore } from "../features/layers/LayerVisibilityStore.ts";
import { LocalLayerVisibility } from "../features/layers/LocalLayerVisibility.ts";
import { MapLayers } from "../features/layers/MapLayers.ts";
import { ObjectLayerRenderer } from "../features/layers/objects/ObjectLayerRenderer.ts";
import { layerSelectionsOf } from "../features/layers/layerTree.ts";
import { MapCollaboration } from "../collaboration/MapCollaboration.ts";
import { LocalBrush } from "../features/painting/LocalBrush.ts";
import { bindBrushShortcuts } from "../features/painting/interaction/brushShortcuts.ts";
import { MapPlacement } from "../features/placement/MapPlacement.ts";
import { PlacementGizmo } from "../features/placement/PlacementGizmo.ts";
import { bindPlacementShortcuts } from "../features/placement/placementShortcuts.ts";
import { MapTemplates } from "../features/templates/MapTemplates.ts";
import {
  MapTilesets,
  type TilesetCatalog
} from "../features/tilesets/MapTilesets.ts";
import { openTileset } from "../features/tilesets/TilesetBinding.ts";
import {
  GridRenderer,
  type GridRendererOptions
} from "./GridRenderer.ts";
import { bindHistoryShortcuts } from "./historyShortcuts.ts";
import { bindKeyChain } from "../shared/keyBindings.ts";
import { SceneLighting } from "../shared/SceneLighting.ts";
import { SceneEnvironment } from "./SceneEnvironment.ts";
import { spawnPose } from "./spawnPose.ts";
import { viewFocusPoint } from "../shared/viewRay.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kGrid: GridRendererOptions = {
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
  #camera: OrbitFlyCamera | undefined;
  #environment: SceneEnvironment | undefined;

  #orbiting = false;
  #spawnPending = true;

  get ready(): Promise<VoxelMapWorkspace> {
    return this.#workspace.promise;
  }

  get camera(): OrbitFlyCamera | undefined {
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

    const camera = world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "lock",
        postProcessing: (context) => voxelTransparencyPass(
          context.scene,
          context.camera,
          samples === undefined ? {} : { samples }
        )
      });
    this.#camera = camera;
    camera.teleport(spawnPose([]));

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
    const templates = new MapTemplates({
      world: view.document.world
    });
    const mapDocument = new MapDocument({
      commands: view.document,
      source: new LeasedWorldSource({
        map: session.map,
        defaultLayerName: kDefaultLayerName
      })
    });
    const localVisibility = new LocalLayerVisibility({
      world: view.document.world,
      layers: view.layerVisibility,
      mapDocument,
      visibility: layerVisibility
    });
    const placement = new MapPlacement({
      world: view.document.world,
      history: view.document.history,
      selection: state.selection,
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

    const gridRenderer = world
      .createActor("grid")
      .addComponentAndGet(GridRenderer, kGrid);
    const collaboration = new MapCollaboration({
      room: session.room,
      identity: session.identity,
      state,
      world,
      camera: camera.camera
    });
    const localBrush = world
      .createActor("brush")
      .addComponentAndGet(LocalBrush, {
        view,
        sources: blockSources,
        camera: camera.camera,
        brush: state.brush,
        selection: state.selection,
        pointer: state.pointer,
        color: session.identity.color,
        onCursorChange: (cursor) => collaboration.publishCursor(cursor),
        onFocusRequest: (point) => {
          camera.enterOrbitFocus(point);
          this.#announceCameraMode();
        },
        onPaintBlocked: () => {
          state.log.push("No voxel layer to paint on: add one in the Layers panel");
        }
      });

    world.createActor("placement")
      .addComponent(PlacementGizmo, {
        view,
        sources: blockSources,
        camera: camera.camera,
        placements: placement.store,
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
    function reconcileTemplates(): void {
      templates.store.reconcile(
        Array.from(view.document.world.templates, (template) => template.id)
      );
      placement.store.reconcile(view.document.world);
    }

    this.#disposables.push(
      bindKeyChain(keyboard, "Escape", [
        () => placement.cancel(),
        () => {
          camera.exitOrbitFocus();
          this.#announceCameraMode();

          return true;
        }
      ]),
      state.pointer.subscribe("change", (captured) => {
        camera.enabled = !captured;
      }),
      placement.store.subscribe("change", (current) => {
        localBrush.suspended = current !== null;
      }),
      mapDocument.subscribe("layerUpdated", () => {
        this.#reconcileSelection(view);
        placement.store.reconcile(view.document.world);
      }),
      mapDocument.subscribe("templatesChanged", () => {
        reconcileTemplates();
      }),
      mapDocument.subscribe("reset", () => {
        this.#reconcileSelection(view);
        reconcileTemplates();
        this.#spawnCamera(view);
      }),
      state.view.subscribe("change", (settings) => {
        environment.apply(settings);
      }),
      bindBrushShortcuts({
        keyboard,
        brush: state.brush,
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
      () => environment.dispose(),
      () => collaboration.dispose(),
      () => tilesets.dispose(),
      () => usage.dispose(),
      () => placement.dispose(),
      () => localVisibility.dispose(),
      () => mapDocument.dispose()
    );

    this.#reconcileSelection(view);
    if (mapDocument.ready) {
      this.#spawnCamera(view);
    }

    this.#workspace.resolve({
      state,
      mapDocument,
      usage,
      blockSources,
      templates,
      placement,
      layerVisibility,
      layers: new MapLayers({
        world: view.document.world,
        selection: state.selection
      }),
      view,
      gridRenderer,
      localBrush,
      tilesets,
      archives: session.archives,
      focusPoint: () => viewFocusPoint(camera.camera, view.root),
      loadWorld: (data) => {
        this.#spawnPending = true;
        mapDocument.load(data);
      },
      teleportToPeer: (clientId) => {
        const pose = collaboration.frustums.poseOf(clientId);
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

  #reconcileSelection(
    view: VoxelView
  ): void {
    this.#options.state.selection.reconcile(
      layerSelectionsOf(view.document.world)
    );
  }

  #spawnCamera(
    view: VoxelView
  ): void {
    const camera = this.#camera;
    if (!this.#spawnPending || camera === undefined) {
      return;
    }

    this.#spawnPending = false;
    camera.exitOrbitFocus();
    camera.teleport(
      spawnPose(view.document.world.getLayers(), {
        fov: camera.camera.fov
      })
    );
    this.#announceCameraMode();
  }

  #announceCameraMode(): void {
    const orbiting = this.#camera?.isOrbiting ?? false;
    if (orbiting === this.#orbiting) {
      return;
    }

    this.#orbiting = orbiting;
    this.#options.state.log.push(
      orbiting
        ? "Camera switched to pivot"
        : "Camera switched to free fly"
    );
  }
}
