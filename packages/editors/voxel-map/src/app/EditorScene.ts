// Import Third-party Dependencies
import {
  Systems,
  OrbitFlyCamera
} from "@jolly-pixel/engine";
import {
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer/plugins/engine/index.ts";
import {
  type VoxelEngine,
  blocksFromTileset,
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  type TilesetSource,
  type VoxelCommand,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/asset.voxel-map/network/client.ts";
import type * as network from "@jolly-pixel/network";
import * as THREE from "three";
import type { PeerIdentity } from "@jolly-pixel/ui";
import { PeerRoster } from "@jolly-pixel/ui/network";
import { PeerFrustums } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  GridRenderer,
  SceneLighting,
  spawnPose,
  viewFocusPoint,
  ViewFocus
} from "../scene/index.ts";
import { PerformanceMonitor } from "../features/performance/index.ts";
import {
  BrushShortcuts,
  HistoryShortcuts,
  LocalBrush,
  PeerBrushes
} from "../features/painting/index.ts";
import {
  ObjectLayerRenderer,
  VoxelLayerGizmo
} from "../features/layers/index.ts";
import { BlockSelectionPresence } from "../features/blocks/collaboration/BlockSelectionPresence.ts";
import { LayerSelectionPresence } from "../features/layers/collaboration/LayerSelectionPresence.ts";
import type { EditorState } from "./state/index.ts";
import { installTransparency } from "../scene/installTransparency.ts";
import {
  TilesetDirectory,
  type TilesetCatalog
} from "../features/tilesets/TilesetDirectory.ts";
import {
  TilesetActions,
  type TilesetCatalogWriter
} from "../features/tilesets/TilesetActions.ts";

// CONSTANTS
const kDefaultBlockLimit = 32;
const kExitOrbitFocusKey = "Escape";

export interface EditorSceneOptions {
  defaultLayerName?: string;
  tilesets: TilesetSource[];
  voxelRoom?: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
  catalog?: TilesetCatalog & TilesetCatalogWriter;
  identity?: PeerIdentity;
  viewFocus?: ViewFocus;
  /**
   * MSAA sample count of the scene compositor.
   * @default 4
   */
  samples?: number;
}

export interface EditorSceneHandles {
  engine: VoxelEngine;
  gridRenderer: GridRenderer;
  lighting: SceneLighting;
  localBrush: LocalBrush;
  tilesetActions: TilesetActions | null;
}

export class EditorScene extends Systems.Scene {
  #tilesets: TilesetSource[];
  #defaultLayerName: string;
  #voxelRoom: network.Room<VoxelNetworkCommand, VoxelServerMessage> | undefined;
  #identity: PeerIdentity | undefined;
  #samples: number | undefined;
  #voxelSyncClient: VoxelSyncClient | undefined;
  #catalog: (TilesetCatalog & TilesetCatalogWriter) | undefined;
  #tilesetDirectory: TilesetDirectory | undefined;
  #tilesetActions: TilesetActions | null = null;
  #peerRoster: PeerRoster | undefined;
  #blockSelections: BlockSelectionPresence | undefined;
  #layerSelections: LayerSelectionPresence | undefined;
  #peerFrustums: PeerFrustums | undefined;
  #orbitFlyCamera: OrbitFlyCamera | undefined;
  #viewFocus: ViewFocus;
  #handles = Promise.withResolvers<EditorSceneHandles>();
  #subscriptions: Array<() => void> = [];

  #orbiting = false;
  #spawnPending = false;

  #onExitOrbitFocusKey = (): void => {
    this.#orbitFlyCamera?.exitOrbitFocus();
    this.#announceCameraMode();
  };

  #onVoxelCommand = (command: VoxelCommand): void => {
    if (isVoxelLayerCommand(command)) {
      this.editorState.world.emit("layerUpdated", command);
    }
    else if (isVoxelBlockCommand(command)) {
      this.editorState.world.emit("blockRegistryChanged");
    }
    else {
      this.#tilesetDirectory?.refresh();
    }
  };

  #announceCameraMode(): void {
    const orbiting = this.#orbitFlyCamera?.isOrbiting ?? false;
    if (orbiting === this.#orbiting) {
      return;
    }

    this.#orbiting = orbiting;
    this.editorState.log.push(
      orbiting
        ? "Camera switched to pivot"
        : "Camera switched to free fly"
    );
  }

  editorState: EditorState;

  engine: VoxelEngine;
  gridRenderer: GridRenderer;
  lighting: SceneLighting;
  localBrush: LocalBrush;

  get ready(): Promise<EditorSceneHandles> {
    return this.#handles.promise;
  }

  get camera(): OrbitFlyCamera | undefined {
    return this.#orbitFlyCamera;
  }

  constructor(
    editorState: EditorState,
    options: EditorSceneOptions
  ) {
    super("editor");

    const {
      defaultLayerName = "Ground",
      tilesets,
      voxelRoom,
      catalog,
      identity,
      viewFocus = new ViewFocus(),
      samples
    } = options;

    this.#defaultLayerName = defaultLayerName;
    this.#catalog = catalog;
    this.#tilesets = tilesets;
    this.#voxelRoom = voxelRoom;
    this.#identity = identity;
    this.#samples = samples;
    this.#viewFocus = viewFocus;
    this.editorState = editorState;
    this.editorState.world.blocksReady = voxelRoom === undefined;
  }

  override awake() {
    const scene = this.world.sceneManager.getSource();

    scene.background = new THREE.Color("#262627");
    const world = this.world;
    this.lighting = new SceneLighting(
      world.renderer.getSource()
    );
    scene.add(...this.lighting.lights);
    this.#subscriptions.push(
      installTransparency(world.renderer, this.#samples)
    );

    const orbitFlyCamera = world
      .createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "lock"
      });
    this.#orbitFlyCamera = orbitFlyCamera;
    orbitFlyCamera.teleport(spawnPose([]));
    this.#subscriptions.push(
      this.editorState.selection.watch("gizmoDraggingChange", (dragging) => {
        orbitFlyCamera.enabled = !dragging;
      })
    );

    const { keyboard } = world.input;
    keyboard.on(kExitOrbitFocusKey, this.#onExitOrbitFocusKey);
    this.#subscriptions.push(
      () => keyboard.off(kExitOrbitFocusKey, this.#onExitOrbitFocusKey)
    );

    const vr = world
      .createActor("map")
      .addComponentAndGet(VoxelRenderer, {
        chunkSize: 16,
        layers: this.#voxelRoom ? [] : [this.#defaultLayerName],
        blocks: [],
        material: "lambert",
        onCommand: this.#onVoxelCommand,
        tilesets: this.#tilesets,
        history: {
          enabled: true
        }
      });
    const { engine } = vr;
    const { world: voxelWorld } = engine;
    this.engine = engine;
    this.editorState.usage.attach(engine.inspector.blocks);

    this.#viewFocus.provider = () => viewFocusPoint(
      orbitFlyCamera.camera,
      engine.root
    );

    if (this.#voxelRoom) {
      this.#spawnPending = true;
      this.#voxelSyncClient = new VoxelSyncClient({
        room: this.#voxelRoom,
        engine
      });
    }

    this.#tilesetDirectory = new TilesetDirectory({
      store: this.editorState.tilesets,
      tilesets: engine.tilesets,
      catalog: this.#catalog
    });
    if (this.#voxelSyncClient && this.#catalog) {
      this.#tilesetActions = new TilesetActions({
        engine,
        catalog: this.#catalog,
        store: this.editorState.tilesets
      });
    }

    if (this.#voxelSyncClient) {
      this.#voxelSyncClient.on("snapshot", () => {
        this.#tilesetDirectory?.refresh();
        let layers = voxelWorld.getLayers();
        if (layers.length === 0) {
          voxelWorld.addLayer(this.#defaultLayerName);
          layers = voxelWorld.getLayers();
        }

        const selected = this.editorState.selection.voxelLayer;
        const currentSelectionStillExists = selected !== null &&
          layers.some((layer) => layer.name === selected);
        if (!currentSelectionStillExists) {
          this.editorState.selection.selectVoxelLayer(layers[0].name);
        }

        this.editorState.world.blocksReady = true;
        this.editorState.world.emit("blockRegistryChanged");
        this.editorState.world.emit("reset");
        this.#spawnCamera();
      });
    }
    else {
      this.editorState.selection.selectVoxelLayer(this.#defaultLayerName);
    }

    this.gridRenderer = world
      .createActor("grid")
      .addComponentAndGet(GridRenderer, {
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
      });

    if (!this.#voxelRoom) {
      this.#registerDefaultBlocks();
      this.editorState.world.emit("blockRegistryChanged");
    }

    if (this.#voxelRoom && this.#identity) {
      this.#peerRoster = new PeerRoster({
        room: this.#voxelRoom,
        identity: this.#identity,
        publish: (peers) => {
          this.editorState.presence.peers = peers;
        },
        log: this.editorState.log
      });
      this.#blockSelections = new BlockSelectionPresence({
        room: this.#voxelRoom,
        brush: this.editorState.brush,
        presence: this.editorState.presence
      });
      this.#layerSelections = new LayerSelectionPresence({
        room: this.#voxelRoom,
        selection: this.editorState.selection,
        presence: this.editorState.presence
      });
    }

    this.#voxelRoom?.join();

    const brush = world.createActor("brush")
      .addComponentAndGet(LocalBrush, {
        engine,
        camera: orbitFlyCamera.camera,
        brush: this.editorState.brush,
        selection: this.editorState.selection,
        color: this.#identity?.color
      });
    brush.onFocusRequest = (point) => {
      orbitFlyCamera.enterOrbitFocus(point);
      this.#announceCameraMode();
    };

    this.localBrush = brush;

    const shortcuts = new BrushShortcuts({
      keyboard,
      brush: this.editorState.brush,
      selection: this.editorState.selection
    });
    this.#subscriptions.push(() => shortcuts.dispose());

    const historyShortcuts = new HistoryShortcuts({
      keyboard,
      history: engine.history
    });
    this.#subscriptions.push(() => historyShortcuts.dispose());

    if (this.#voxelRoom) {
      const peerBrushes = world.createActor("peer-brushes")
        .addComponentAndGet(PeerBrushes, {
          room: this.#voxelRoom,
          brush: this.editorState.brush
        });
      brush.onCursorChange = (cursor) => {
        peerBrushes.publishLocalCursor(cursor);
      };

      this.#peerFrustums = world.createActor("peer-frustums")
        .addComponentAndGet(PeerFrustums, {
          room: this.#voxelRoom,
          camera: orbitFlyCamera.camera
        });
    }

    world.createActor("gizmo")
      .addComponent(VoxelLayerGizmo, {
        world: voxelWorld,
        camera: orbitFlyCamera.camera,
        selection: this.editorState.selection,
        worldStore: this.editorState.world
      });

    world.createActor("object-layer-renderer")
      .addComponent(ObjectLayerRenderer, {
        world: voxelWorld,
        camera: orbitFlyCamera.camera,
        selection: this.editorState.selection,
        worldStore: this.editorState.world
      });

    world.createActor("performance")
      .addComponent(PerformanceMonitor, { engine });

    this.#handles.resolve({
      engine,
      gridRenderer: this.gridRenderer,
      lighting: this.lighting,
      localBrush: this.localBrush,
      tilesetActions: this.#tilesetActions
    });
  }

  teleportToPeer(
    clientId: string
  ): boolean {
    const pose = this.#peerFrustums?.poseOf(clientId);
    if (pose === undefined || this.#orbitFlyCamera === undefined) {
      return false;
    }

    this.#orbitFlyCamera.teleport(pose);

    return true;
  }

  loadWorld(
    data: VoxelWorldJSON
  ): void {
    if (this.#voxelSyncClient) {
      this.#spawnPending = true;
      this.#voxelSyncClient.replaceWorld(data);
    }
    else {
      this.engine.load(data, { tilesets: this.#tilesets });
      this.#tilesetDirectory?.refresh();
      this.#registerDefaultBlocks();

      const layers = this.engine.world.getLayers();
      this.editorState.selection.selectVoxelLayer(
        layers.length > 0 ? layers[0].name : null
      );
      this.editorState.world.emit("blockRegistryChanged");
      this.editorState.world.emit("reset");
      this.#spawnPending = true;
      this.#spawnCamera();
    }
  }

  #spawnCamera(): void {
    const camera = this.#orbitFlyCamera;
    if (!this.#spawnPending || camera === undefined) {
      return;
    }

    this.#spawnPending = false;
    camera.exitOrbitFocus();
    camera.teleport(
      spawnPose(this.engine.world.getLayers(), {
        fov: camera.camera.fov
      })
    );
    this.#announceCameraMode();
  }

  override destroy(): void {
    this.#handles.reject(
      new Error("The editor scene was destroyed before it awoke.")
    );
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }

    this.#viewFocus.provider = null;
    this.editorState.usage.attach(null);
    this.#tilesetDirectory?.dispose();
    this.#tilesetDirectory = undefined;
    this.#tilesetActions = null;
    this.#voxelSyncClient?.destroy();
    this.#voxelSyncClient = undefined;
    this.#peerRoster?.dispose();
    this.#peerRoster = undefined;
    this.#blockSelections?.dispose();
    this.#blockSelections = undefined;
    this.#layerSelections?.dispose();
    this.#layerSelections = undefined;
    this.#peerFrustums = undefined;
    this.#orbitFlyCamera = undefined;
  }

  #registerDefaultBlocks(): void {
    const {
      blockRegistry,
      tilesetManager
    } = this.engine;
    const atlas = tilesetManager.get();
    if (!atlas) {
      return;
    }

    const blocks = blocksFromTileset(atlas.def, {
      limit: kDefaultBlockLimit
    });

    blockRegistry.registerMany(
      blocks,
      { skipExisting: true }
    );
  }
}
