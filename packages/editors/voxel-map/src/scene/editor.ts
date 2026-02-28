// Import Third-party Dependencies
import {
  Systems,
  type ComponentInitializeContext
} from "@jolly-pixel/engine";
import {
  VoxelRenderer,
  type TilesetDefinition,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import {
  FreeFlyCamera,
  GridRenderer,
  VoxelBrush,
  LayerGizmo,
  ObjectLayerRenderer
} from "../components/index.ts";
import type { EditorState } from "../EditorState.ts";
import { LocalStoragePersistence } from "../lib/LocalStoragePersistence.ts";

export interface EditorSceneOptions {
  /**
   * The name of the default layer to create when the scene awakes. This can be
   * @default "Ground"
   */
  defaultLayerName?: string;
  defaultTileset: TilesetDefinition;
}

export class EditorScene extends Systems.Scene {
  #texture: THREE.Texture<HTMLImageElement>;
  #defaultLayerName: string;
  #defaultTileset: TilesetDefinition;
  #pendingLoad: VoxelWorldJSON | null = null;

  editorState: EditorState;

  vr: VoxelRenderer;
  gridRenderer: GridRenderer;

  override async initialize(
    context: ComponentInitializeContext
  ): Promise<void> {
    const { assetManager } = context;

    const textureLoader = new THREE.TextureLoader(
      assetManager.context.manager
    );
    const texture = await textureLoader.loadAsync(
      this.#defaultTileset.src
    );

    this.#texture = texture;
    this.#pendingLoad = LocalStoragePersistence.load();
  }

  constructor(
    editorState: EditorState,
    options: EditorSceneOptions
  ) {
    super("editor");

    const {
      defaultLayerName = "Ground",
      defaultTileset
    } = options;

    this.#defaultLayerName = defaultLayerName;
    this.#defaultTileset = defaultTileset;
    this.editorState = editorState;
  }

  override awake() {
    const scene = this.world.sceneManager.getSource();

    scene.background = new THREE.Color(0x1e2a30);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 20, 10);
    scene.add(
      new THREE.AmbientLight(0xffffff, 1.2),
      dirLight
    );

    const world = this.world;

    const freeFlyCamera = world
      .createActor("camera")
      .addComponentAndGet(FreeFlyCamera, {
        position: { x: 8, y: 12, z: 32 }
      });

    const vr = world
      .createActor("map")
      .addComponentAndGet(VoxelRenderer, {
        chunkSize: 16,
        layers: [this.#defaultLayerName],
        blocks: [],
        material: "lambert",
        materialCustomizer: (material) => {
          material.transparent = true;
        },
        alphaTest: 0,
        onLayerUpdated: (evt) => this.editorState.dispatchLayerUpdated(evt)
      });
    this.vr = vr;
    this.editorState.setSelectedLayer(this.#defaultLayerName);

    vr.loadTilesetSync(this.#defaultTileset, this.#texture);
    for (const block of vr.tilesetManager.getDefaultBlocks(void 0, { limit: 32 })) {
      vr.blockRegistry.register(block);
    }
    this.editorState.dispatchBlockRegistryChanged();

    const persistence = new LocalStoragePersistence(vr, this.editorState);
    persistence.start();

    if (this.#pendingLoad !== null) {
      vr.load(this.#pendingLoad)
        .then(() => {
          this.editorState.dispatchBlockRegistryChanged();
          const layers = vr.world.getLayers();
          if (layers.length > 0) {
            this.editorState.setSelectedLayer(layers[0].name);
          }
        })
        .catch(console.error);
      this.#pendingLoad = null;
    }

    this.gridRenderer = world
      .createActor("grid")
      .addComponentAndGet(GridRenderer, {
        extent: 64
      });

    world.createActor("brush")
      .addComponent(VoxelBrush, {
        vr,
        camera: freeFlyCamera.camera
      });

    world.createActor("gizmo")
      .addComponent(LayerGizmo, {
        vr,
        camera: freeFlyCamera.camera
      });

    world.createActor("object-layer-renderer")
      .addComponent(ObjectLayerRenderer, {
        vr,
        camera: freeFlyCamera.camera
      });
  }
}
