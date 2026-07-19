// Import Third-party Dependencies
import * as THREE from "three";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";

// Import Internal Dependencies
import { CameraBehavior } from "./components/Camera.ts";
import { CubeBehavior } from "./components/Cube.ts";
import { OrbitControlsBehavior } from "./components/OrbitControlsBehavior.ts";
import { type PixelDrawPanel } from "./ui/PixelDrawPanel.ts";

const runtime = await initRuntime();
loadRuntime(runtime, {
  focusCanvas: false
}).catch(console.error);

async function initRuntime(): Promise<Runtime> {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "#canvas-container > canvas"
  )!;

  const runtime = new Runtime(canvas, {
    includePerformanceStats: false
  });

  const { world } = runtime;

  const scene = world.sceneManager.getSource();
  scene.background = new THREE.Color("#eef3f7");

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(5, 10, 7);

  // Cool-toned fill from the opposite side, so faces facing away from the
  // key light aren't flat black — matters now that orbiting lets every
  // face be seen (see OrbitControlsBehavior).
  const fillLight = new THREE.DirectionalLight(0xaeccff, 0.5);
  fillLight.position.set(-6, 3, -4);

  scene.add(
    new THREE.HemisphereLight(0xffffff, 0x3a4750, 1.0),
    keyLight,
    fillLight
  );

  const drawPanel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
  const canvasManager = await drawPanel.initialize({
    texture: {
      size: {
        x: 80,
        y: 80
      }
    },
    defaultMode: "paint",
    backgroundColor: "#263238",
    zoom: {
      // No `default`: PixelArtCanvas computes one that fits the whole
      // texture inside the panel's initial size (see PixelArtCanvas.md).
      min: 1,
      max: 32,
      sensitivity: 1
    },
    brush: {
      size: 1
    },
    history: {
      enabled: true
    }
  });

  const canvasTexture = new THREE.CanvasTexture(canvasManager.textureCanvas());
  canvasTexture.magFilter = THREE.NearestFilter;
  canvasTexture.minFilter = THREE.NearestFilter;

  const cameraBehavior = world.createActor("camera")
    .addComponentAndGet(CameraBehavior);

  // Drag to orbit, scroll to zoom — lets every face of a cube actually be
  // inspected instead of only the two the static camera used to show.
  world.createActor("orbit-controls").addComponentAndGet(OrbitControlsBehavior, {
    camera: cameraBehavior.camera,
    target: new THREE.Vector3(0, 0, 0),
    minDistance: 3,
    maxDistance: 30
  });

  // One test cube per UV region, so placement/move can be visually verified.
  // Face assignment is out of scope for this version: a region's rect is
  // applied uniformly to all 6 faces (see CubeBehavior.applyRegionUV).
  const cubes = new Map<string, CubeBehavior>();

  // Recomputes every cube's target position as a centered, near-square
  // grid — re-run on every create/delete so the cluster (1 cube or many)
  // always sits centered on the origin, not just column-centered against
  // a fixed column count. CubeBehavior eases toward the new target itself
  // (see setTargetPosition), so a reflow reads as a smooth glide.
  const kGridSpacing = 2.4;

  function relayoutCubes(): void {
    const entries = [...cubes.values()];
    if (entries.length === 0) {
      return;
    }

    const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
    const rows = Math.ceil(entries.length / columns);
    const centerCol = (columns - 1) / 2;
    const centerRow = (rows - 1) / 2;

    entries.forEach((cube, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      cube.setTargetPosition(new THREE.Vector3(
        (col - centerCol) * kGridSpacing,
        (centerRow - row) * kGridSpacing,
        0
      ));
    });
  }

  canvasManager.uv.on("region-created", ({ region }) => {
    const cube = world.createActor(`uv-cube-${region.id}`).addComponentAndGet(CubeBehavior, {
      canvasTexture,
      region,
      textureSize: canvasManager.textureSize
    });
    cubes.set(region.id, cube);
    relayoutCubes();
  });
  canvasManager.uv.on("region-deleted", ({ region }) => {
    cubes.get(region.id)?.actor.destroy();
    cubes.delete(region.id);
    relayoutCubes();
  });
  canvasManager.uv.on("region-moved", ({ region }) => {
    cubes.get(region.id)?.updateRect(region.rect, canvasManager.textureSize);
  });
  // Fires continuously while a drag is in progress (never recorded to
  // history or broadcast — see UVMap.previewMove), so the cube's texture
  // mapping updates live instead of only snapping into place on drop.
  canvasManager.uv.on("region-dragging", ({ id, rect }) => {
    cubes.get(id)?.updateRect(rect, canvasManager.textureSize);
  });
  canvasManager.uv.on("selection-changed", ({ selectedRegionId }) => {
    for (const [regionId, cube] of cubes) {
      cube.setSelected(regionId === selectedRegionId);
    }
  });

  // Seed one region (and its cube) so there's something to see/test
  // immediately, instead of starting from an empty scene.
  const initialRegion = canvasManager.uv.create({ width: 16, height: 16 });
  canvasManager.uv.select(initialRegion.id);

  // Clicking a cube in the 3D scene reveals its UV region on the 2D canvas,
  // regardless of the canvas's current mode (see uv/UVMap.md — visibility
  // is independent of mode). Clicking empty space in the 3D scene deselects,
  // mirroring a miss-click on the 2D canvas in "uv" mode.
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  canvas.addEventListener("click", (event) => {
    const bounds = canvas.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    raycaster.setFromCamera(pointerNdc, cameraBehavior.camera);
    const meshes = [...cubes.values()].map((cube) => cube.mesh);
    const [hit] = raycaster.intersectObjects(meshes);
    canvasManager.uv.select(hit ? hit.object.userData.regionId as string : null);
  });

  world.renderer.on("resize", () => {
    drawPanel.onResize();
  });

  const resizeHandle = new ResizeHandle(drawPanel, { direction: "left" });
  resizeHandle.addEventListener("drag", () => {
    drawPanel.onResize();
  });
  resizeHandle.addEventListener("dragEnd", () => {
    drawPanel.onResize();
  });

  return runtime;
}
