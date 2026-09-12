// Import Third-party Dependencies
import {
  Systems
} from "@jolly-pixel/engine";
import {
  type VoxelEngine,
  VoxelRenderer,
  blocksFromTileset,
  type TilesetSource,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";
import type * as network from "@jolly-pixel/network";
import * as THREE from "three";

// Import Internal Dependencies
import {
  FreeFlyCamera,
  GridRenderer,
  viewFocusPoint,
  ViewFocus
} from "../scene/index.ts";
import { PerformanceMonitor } from "../features/performance/index.ts";
import {
  LocalBrush,
  PeerBrushes
} from "../features/painting/index.ts";
import {
  ObjectLayerRenderer,
  VoxelLayerGizmo
} from "../features/layers/index.ts";
import { BlockSelectionPresence } from "../features/blocks/collaboration/BlockSelectionPresence.ts";
import { PeerRoster } from "../collaboration/PeerRoster.ts";
import { PeerFrustums } from "../collaboration/PeerFrustums.ts";
import type { EditorIdentity } from "../collaboration/identity.ts";
import type { EditorState } from "./state/index.ts";
import { installTransparency } from "../scene/installTransparency.ts";

// CONSTANTS
const kDefaultBlockLimit = 32;
const kExitOrbitFocusKey = "Escape";

export interface EditorSceneOptions {
  /**
   * @default "Ground"
   */
  defaultLayerName?: string;
  tilesets: TilesetSource[];
  voxelRoom?: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
  /**
   * Local identity; absent offline, leaving the default brush tint.
   */
  identity?: EditorIdentity;
  viewFocus?: ViewFocus;
}

export interface EditorSceneHandles {
  engine: VoxelEngine;
  gridRenderer: GridRenderer;
  localBrush: LocalBrush;
}

export class EditorScene extends Systems.Scene {
  #tilesets: TilesetSource[];
  #defaultLayerName: string;
  #voxelRoom: network.Room<VoxelNetworkCommand, VoxelServerMessage> | undefined;
  #identity: EditorIdentity | undefined;
  #voxelSyncClient: VoxelSyncClient | undefined;
  #peerRoster: PeerRoster | undefined;
  #blockSelections: BlockSelectionPresence | undefined;
  #peerFrustums: PeerFrustums | undefined;
  #freeFlyCamera: FreeFlyCamera | undefined;
  #viewFocus: ViewFocus;
  #handles = Promise.withResolvers<EditorSceneHandles>();
  #subscriptions: Array<() => void> = [];

  #orbiting = false;

  #onExitOrbitFocusKey = (): void => {
    this.#freeFlyCamera?.exitOrbitFocus();
    this.#announceCameraMode();
  };

  #announceCameraMode(): void {
    const orbiting = this.#freeFlyCamera?.isOrbiting ?? false;
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
  localBrush: LocalBrush;

  get ready(): Promise<EditorSceneHandles> {
    return this.#handles.promise;
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
      identity,
      viewFocus = new ViewFocus()
    } = options;

    this.#defaultLayerName = defaultLayerName;
    this.#tilesets = tilesets;
    this.#voxelRoom = voxelRoom;
    this.#identity = identity;
    this.#viewFocus = viewFocus;
    this.editorState = editorState;
    // A networked registry stays a placeholder until its snapshot lands.
    this.editorState.world.blocksReady = voxelRoom === undefined;
  }

  override awake() {
    const scene = this.world.sceneManager.getSource();

    scene.background = new THREE.Color("#262627");
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 20, 10);
    scene.add(
      new THREE.AmbientLight("#ffffff", 0.6),
      dirLight
    );

    const world = this.world;
    this.#subscriptions.push(
      installTransparency(world.renderer)
    );

    const freeFlyCamera = world
      .createActor("camera")
      .addComponentAndGet(FreeFlyCamera, {
        position: { x: 8, y: 12, z: 32 },
        focusMode: "lock"
      });
    this.#freeFlyCamera = freeFlyCamera;
    this.#subscriptions.push(
      this.editorState.selection.watch("gizmoDraggingChange", (dragging) => {
        freeFlyCamera.enabled = !dragging;
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
        onLayerUpdated: (evt) => this.editorState.world.emit("layerUpdated", evt),
        onBlockUpdated: () => this.editorState.world.emit("blockRegistryChanged"),
        tilesets: this.#tilesets
      });
    const { engine } = vr;
    const { world: voxelWorld } = engine;
    this.engine = engine;

    // Provide an in-view spawn point for new objects.
    this.#viewFocus.provider = () => viewFocusPoint(
      freeFlyCamera.camera,
      engine.root
    );

    if (this.#voxelRoom) {
      this.#voxelSyncClient = new VoxelSyncClient({ room: this.#voxelRoom });
      this.#voxelSyncClient.attach(engine);
      // Snapshots bypass hooks that normally update mirrored UI state.
      this.#voxelSyncClient.on("snapshot", () => {
        let layers = voxelWorld.getLayers();
        if (layers.length === 0) {
          // The attached client broadcasts this default layer.
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

    // Online snapshots supply block definitions.
    if (!this.#voxelRoom) {
      this.#registerDefaultBlocks();
      this.editorState.world.emit("blockRegistryChanged");
    }

    if (this.#voxelRoom && this.#identity) {
      this.#peerRoster = new PeerRoster({
        room: this.#voxelRoom,
        identity: this.#identity,
        shell: this.editorState.shell
      });
      this.#blockSelections = new BlockSelectionPresence({
        room: this.#voxelRoom,
        brush: this.editorState.brush,
        shell: this.editorState.shell
      });
    }

    this.#voxelRoom?.join();

    const brush = world.createActor("brush")
      .addComponentAndGet(LocalBrush, {
        engine,
        camera: freeFlyCamera.camera,
        brush: this.editorState.brush,
        selection: this.editorState.selection,
        color: this.#identity?.color
      });
    brush.onFocusRequest = (point) => {
      freeFlyCamera.enterOrbitFocus(point);
      this.#announceCameraMode();
    };

    this.localBrush = brush;

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
          camera: freeFlyCamera.camera
        });
    }

    world.createActor("gizmo")
      .addComponent(VoxelLayerGizmo, {
        world: voxelWorld,
        camera: freeFlyCamera.camera,
        selection: this.editorState.selection,
        worldStore: this.editorState.world
      });

    world.createActor("object-layer-renderer")
      .addComponent(ObjectLayerRenderer, {
        world: voxelWorld,
        camera: freeFlyCamera.camera,
        selection: this.editorState.selection,
        worldStore: this.editorState.world
      });

    world.createActor("performance")
      .addComponent(PerformanceMonitor, { engine });

    this.#handles.resolve({
      engine,
      gridRenderer: this.gridRenderer,
      localBrush: this.localBrush
    });
  }

  teleportToPeer(
    clientId: string
  ): boolean {
    const pose = this.#peerFrustums?.poseOf(clientId);
    if (pose === undefined || this.#freeFlyCamera === undefined) {
      return false;
    }

    this.#freeFlyCamera.teleport(pose);

    return true;
  }

  loadWorld(
    data: VoxelWorldJSON
  ): void {
    if (this.#voxelSyncClient) {
      this.#voxelSyncClient.replaceWorld(data);
    }
    else {
      this.engine.load(data);
      this.#registerDefaultBlocks();

      const layers = this.engine.world.getLayers();
      this.editorState.selection.selectVoxelLayer(
        layers.length > 0 ? layers[0].name : null
      );
      this.editorState.world.emit("blockRegistryChanged");
      this.editorState.world.emit("reset");
    }
  }

  override destroy(): void {
    this.#handles.reject(
      new Error("The editor scene was destroyed before it awoke.")
    );
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }

    this.#viewFocus.provider = null;
    this.#voxelSyncClient?.destroy();
    this.#voxelSyncClient = undefined;
    this.#peerRoster?.dispose();
    this.#peerRoster = undefined;
    this.#blockSelections?.dispose();
    this.#blockSelections = undefined;
    this.#peerFrustums = undefined;
    this.#freeFlyCamera = undefined;
  }

  #registerDefaultBlocks(): void {
    const {
      blockRegistry,
      tilesetManager
    } = this.engine;

    const blocks = blocksFromTileset(tilesetManager.atlas().def, {
      limit: kDefaultBlockLimit
    });

    blockRegistry.registerMany(
      blocks,
      { skipExisting: true }
    );
  }
}
