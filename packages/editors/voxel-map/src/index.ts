// Import Third-party Dependencies
import * as THREE from "three";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import { ResizeHandle } from "@jolly-pixel/resize-handle";

// Import Internal Dependencies
import {
  FreeFlyCamera,
  GridRenderer,
  VoxelBrush,
  LayerGizmo,
  ObjectLayerRenderer
} from "./components/index.ts";
import { editorState } from "./EditorState.ts";

// Side-effect import — registers <editor-sidebar> and all child elements
import { EditorSidebar } from "./ui/EditorSidebar.ts";

// CONSTANTS
const kDefaultLayerName = "Ground";
const kDefaultTilesetId = "default";
const kDefaultTilesetSrc = "textures/tileset.png";
const kDefaultTileSize = 32;

// --- Bootstrap --- //

const runtime = initRuntime();
loadRuntime(runtime, {
  focusCanvas: false
}).catch(console.error);

function initRuntime(): Runtime {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "#game-container > canvas"
  )!;

  const runtime = new Runtime(canvas, {
    includePerformanceStats: true
  });

  const { world } = runtime;

  // --- Scene setup --- //
  const scene = world.sceneManager.getSource();
  scene.background = new THREE.Color(0x1e2a30);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(10, 20, 10);
  scene.add(
    new THREE.AmbientLight(0xffffff, 1.2),
    dirLight
  );

  const freeFlyCamera = world
    .createActor("camera")
    .addComponentAndGet(FreeFlyCamera, {
      position: { x: 8, y: 12, z: 32 }
    });

  const vr = world
    .createActor("map")
    .addComponentAndGet(VoxelRenderer, {
      chunkSize: 16,
      layers: [kDefaultLayerName],
      blocks: [],
      material: "lambert",
      alphaTest: 0,
      onLayerUpdated: (evt) => editorState.dispatchLayerUpdated(evt)
    });

  // Pre-select the default layer in editor state.
  editorState.setSelectedLayer(kDefaultLayerName);

  // Load default tileset concurrently — runtime.start() is deferred ~850 ms
  // by loadRuntime(), so awake() runs reliably after the tileset is ready.
  // Once the texture is registered, getDefaultBlocks() can derive cols/rows
  // from the actual image dimensions instead of speculating a fixed layout.
  vr.loadTileset({
    id: kDefaultTilesetId,
    src: kDefaultTilesetSrc,
    tileSize: kDefaultTileSize
  })
    .then(() => {
      for (const block of vr.tilesetManager.getDefaultBlocks(void 0, { limit: 32 })) {
        vr.blockRegistry.register(block);
      }
      editorState.dispatchBlockRegistryChanged();
    })
    .catch(console.error);

  const gridActor = world.createActor("grid");
  const gridRenderer = gridActor.addComponentAndGet(GridRenderer, {
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

  // --- Wire sidebar --- //
  const sidebar = document.querySelector<EditorSidebar>("#sidebar")!;
  if (sidebar) {
    sidebar.vr = vr;
    sidebar.gridRenderer = gridRenderer;
  }

  const resizeHandle = new ResizeHandle(sidebar, { direction: "left" });
  resizeHandle.addEventListener("drag", () => {
    gridRenderer.setResolution(canvas.clientWidth, canvas.clientHeight);
  });
  resizeHandle.addEventListener("dragEnd", () => {
    gridRenderer.setResolution(canvas.clientWidth, canvas.clientHeight);
  });

  return runtime;
}

