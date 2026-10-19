// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { HighlightEntry } from "#src/index.ts";

export interface MaskDraw {
  target: THREE.RenderTarget | null;
  object: THREE.Object3D;
  material: THREE.Material;
}

type RenderObjectFunction = Parameters<
  THREE.WebGPURenderer["setRenderObjectFunction"]
>[0];

export class RecordingRenderer {
  toneMapping = THREE.NoToneMapping;
  outputColorSpace = THREE.SRGBColorSpace;
  autoClear = true;
  clearColor = new THREE.Color(0x123456);
  clearAlpha = 1;
  draws: MaskDraw[] = [];
  clears: Array<THREE.RenderTarget | null> = [];

  #target: THREE.RenderTarget | null = null;
  #renderObject: RenderObjectFunction = null;

  getRenderTarget = (): THREE.RenderTarget | null => this.#target;

  setRenderTarget = (
    target: THREE.RenderTarget | null
  ): void => {
    this.#target = target;
  };

  getRenderObjectFunction = (): RenderObjectFunction => this.#renderObject;

  setRenderObjectFunction = (
    renderObject: RenderObjectFunction
  ): void => {
    this.#renderObject = renderObject;
  };

  getClearColor = (
    target: THREE.Color
  ): THREE.Color => target.copy(this.clearColor);

  getClearAlpha = (): number => this.clearAlpha;

  setClearColor = (
    color: THREE.ColorRepresentation,
    alpha: number
  ): void => {
    this.clearColor.set(color);
    this.clearAlpha = alpha;
  };

  getDrawingBufferSize = (
    target: THREE.Vector2
  ): THREE.Vector2 => target.set(64, 32);

  clear(): void {
    this.clears.push(this.#target);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.Camera
  ): void {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        this.#renderObject?.(
          object,
          scene,
          camera,
          object.geometry,
          object.material,
          null,
          null as never,
          null as never
        );
      }
    });
  }

  renderObject(
    object: THREE.Object3D,
    _scene: THREE.Scene,
    _camera: THREE.Camera,
    _geometry: THREE.BufferGeometry,
    material: THREE.Material
  ): void {
    this.draws.push({
      target: this.#target,
      object,
      material
    });
  }
}

export function createRendererStub(): THREE.WebGPURenderer {
  return new RecordingRenderer() as unknown as THREE.WebGPURenderer;
}

export function createMesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
}

export function createInstancedMesh(): THREE.InstancedMesh {
  return new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
    10
  );
}

export function createEntriesOfEveryShape(): HighlightEntry[] {
  const group = new THREE.Group();
  group.add(createMesh());
  group.add(createMesh());

  return [
    {
      target: createMesh(),
      color: "#ff0000"
    },
    {
      target: group,
      color: "#00ff00",
      priority: true
    },
    {
      target: createMesh(),
      color: "#0000ff",
      isolated: true
    },
    {
      target: createInstancedMesh(),
      instanceId: 3,
      color: "#ffffff",
      priority: true
    }
  ];
}
