// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { vec4, uniform } from "three/tsl";

// Import Internal Dependencies
import type { HighlightEntry } from "./HighlightPass.ts";
import { InstancedHighlightMask } from "./InstancedHighlightMask.ts";

export interface HighlightMaskTextureOptions {
  magFilter?: THREE.MagnificationTextureFilter;
  minFilter?: THREE.MinificationTextureFilter;
}

type RenderObjectFunction = Parameters<
  THREE.WebGPURenderer["setRenderObjectFunction"]
>[0];

interface MaskLayer {
  meshColor: (mesh: THREE.Mesh) => THREE.Color | undefined;
  material: THREE.NodeMaterial;
  instancedMaterial: (mesh: THREE.InstancedMesh) => THREE.NodeMaterial | undefined;
}

export class HighlightMask {
  readonly shared: THREE.RenderTarget;
  readonly priority: THREE.RenderTarget;
  readonly isolated: THREE.RenderTarget;
  readonly composite: THREE.RenderTarget;

  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;

  #entries: HighlightEntry[] = [];
  #entryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #priorityMeshes = new Set<THREE.Mesh>();
  #isolatedEntryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #instancedMask = new InstancedHighlightMask();
  #drawn = false;

  #maskColor = new THREE.Color();
  #material: THREE.NodeMaterial;
  #onTopMaterial: THREE.NodeMaterial;
  #sharedLayer: MaskLayer;
  #priorityLayer: MaskLayer;
  #isolatedLayer: MaskLayer;

  constructor(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    textureOptions: HighlightMaskTextureOptions = {}
  ) {
    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;

    this.shared = new THREE.RenderTarget(1, 1, textureOptions);
    this.priority = new THREE.RenderTarget(1, 1, {
      depthBuffer: false,
      ...textureOptions
    });
    this.isolated = new THREE.RenderTarget(1, 1, {
      depthBuffer: false,
      ...textureOptions
    });
    this.composite = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    const maskColorNode = uniform(this.#maskColor);
    this.#material = new THREE.NodeMaterial();
    this.#material.name = "HighlightMask.shared";
    this.#material.colorNode = vec4(maskColorNode, 1);

    this.#onTopMaterial = new THREE.NodeMaterial();
    this.#onTopMaterial.name = "HighlightMask.onTop";
    this.#onTopMaterial.colorNode = vec4(maskColorNode, 1);
    this.#onTopMaterial.depthTest = false;

    this.#sharedLayer = {
      meshColor: (mesh) => this.#entryByMesh.get(mesh),
      material: this.#material,
      instancedMaterial: (mesh) => this.#instancedMask.maskMaterials(mesh)?.material
    };
    this.#priorityLayer = {
      meshColor: (mesh) => (
        this.#priorityMeshes.has(mesh) ? this.#entryByMesh.get(mesh) : undefined
      ),
      material: this.#onTopMaterial,
      instancedMaterial: (mesh) => this.#instancedMask.maskMaterials(mesh)?.priorityMaterial
    };
    this.#isolatedLayer = {
      meshColor: (mesh) => this.#isolatedEntryByMesh.get(mesh),
      material: this.#onTopMaterial,
      instancedMaterial: () => undefined
    };
  }

  get entries(): HighlightEntry[] {
    return [...this.#entries];
  }

  set entries(
    entries: HighlightEntry[]
  ) {
    this.#entries = [...entries];
    this.#entryByMesh.clear();
    this.#priorityMeshes.clear();
    this.#isolatedEntryByMesh.clear();
    this.#instancedMask.clear();

    for (const { target, color, priority = false, isolated = false, instanceId } of entries) {
      const threeColor = color instanceof THREE.Color ? color.clone() : new THREE.Color(color);

      if (instanceId !== undefined) {
        this.#instancedMask.add(target, instanceId, threeColor, priority);
        continue;
      }

      target.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }
        if (isolated) {
          this.#isolatedEntryByMesh.set(object, threeColor);

          return;
        }
        this.#entryByMesh.set(object, threeColor);
        if (priority) {
          this.#priorityMeshes.add(object);
        }
      });
    }

    this.#instancedMask.sync();
  }

  get size(): number {
    return this.#entryByMesh.size +
      this.#instancedMask.size +
      this.#isolatedEntryByMesh.size;
  }

  get hasPriority(): boolean {
    return this.#priorityMeshes.size > 0 || this.#instancedMask.size > 0;
  }

  get hasIsolated(): boolean {
    return this.#isolatedEntryByMesh.size > 0;
  }

  resize(
    width: number,
    height: number
  ): void {
    this.shared.setSize(width, height);
    this.priority.setSize(width, height);
    this.isolated.setSize(width, height);
    this.composite.setSize(width, height);
  }

  render(
    includeIsolated = true
  ): boolean {
    if (this.size === 0) {
      if (this.#drawn) {
        this.clear(this.composite);
        this.#drawn = false;
      }

      return false;
    }
    this.#drawn = true;

    const renderer = this.#renderer;
    const scene = this.#scene;
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousRenderObjectFunction = renderer.getRenderObjectFunction();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    const previousBackground = scene.background;

    scene.background = null;
    renderer.setClearColor(0x000000, 0);

    this.#draw(this.shared, this.#sharedLayer);
    if (this.hasPriority) {
      this.#draw(this.shared, this.#priorityLayer, false);
      this.#draw(this.priority, this.#priorityLayer);
    }
    if (this.hasIsolated && includeIsolated) {
      this.#draw(this.isolated, this.#isolatedLayer);
    }

    renderer.setRenderObjectFunction(previousRenderObjectFunction);
    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    scene.background = previousBackground;
    renderer.setRenderTarget(previousTarget);

    return true;
  }

  clear(
    target: THREE.RenderTarget
  ): void {
    const renderer = this.#renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();

    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();

    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
  }

  dispose(): void {
    this.#entries = [];
    this.#entryByMesh.clear();
    this.#priorityMeshes.clear();
    this.#isolatedEntryByMesh.clear();
    this.#instancedMask.dispose();

    this.shared.dispose();
    this.priority.dispose();
    this.isolated.dispose();
    this.composite.dispose();
    this.#material.dispose();
    this.#onTopMaterial.dispose();
  }

  #draw(
    target: THREE.RenderTarget,
    layer: MaskLayer,
    clear = true
  ): void {
    const renderer = this.#renderer;
    // eslint-disable-next-line max-params
    const renderObject: RenderObjectFunction = (
      object,
      objectScene,
      objectCamera,
      geometry,
      _material,
      group,
      lightsNode,
      clippingContext
    ) => {
      const instanced = object instanceof THREE.InstancedMesh ?
        layer.instancedMaterial(object) :
        undefined;
      if (instanced) {
        renderer.renderObject(
          object,
          objectScene,
          objectCamera,
          geometry,
          instanced,
          group,
          lightsNode,
          clippingContext
        );

        return;
      }

      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      const color = layer.meshColor(object);
      if (color === undefined) {
        return;
      }

      this.#maskColor.copy(color);
      renderer.renderObject(
        object,
        objectScene,
        objectCamera,
        geometry,
        layer.material,
        group,
        lightsNode,
        clippingContext
      );
    };

    renderer.autoClear = clear;
    renderer.setRenderObjectFunction(renderObject);
    renderer.setRenderTarget(target);
    renderer.render(this.#scene, this.#camera);
  }
}
