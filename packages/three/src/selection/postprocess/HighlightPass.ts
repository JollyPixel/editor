// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  float,
  vec4,
  uniform,
  texture,
  pass
} from "three/tsl";

// Import Internal Dependencies
import type { SelectableObject } from "../SelectionManager.ts";
import { MAX_BLUR_RADIUS, buildSeparableBlur } from "./tsl/gaussianBlur.ts";
import { buildEdgeDetection } from "./tsl/edgeDetection.ts";
import { buildHighlightComposite } from "./tsl/composite.ts";
import { InstancedHighlightMask } from "./InstancedHighlightMask.ts";

interface HighlightEntryBase {
  color: THREE.ColorRepresentation;
  /**
   * Renders last so the outline wins silhouette overlaps.
   * @default false
   */
  priority?: boolean;
}

export type HighlightEntry =
  | (HighlightEntryBase & {
    target: SelectableObject;
    /**
     * Isolates the outline from other entries.
     * @default false
     */
    isolated?: boolean;
    instanceId?: undefined;
  })
  | (HighlightEntryBase & {
    /**
     * Outlined one instance at a time, never as a whole object.
     */
    target: THREE.InstancedMesh;
    /**
     * Selects one `THREE.InstancedMesh` instance.
     */
    instanceId: number;
    isolated?: never;
  });

export interface HighlightPassOptions {
  /**
   * Edge thickness in downsampled pixels.
   * @default 1
   */
  edgeThickness?: number;
  /**
   * Outer-ring glow multiplier.
   * @default 0
   */
  edgeGlow?: number;
  /**
   * Edge-detection and blur resolution divisor.
   * @default 2
   */
  downSampleRatio?: number;
}

/**
 * Draws colored post-process outlines with `THREE.WebGPURenderer`.
 * Owns the scene pipeline and ignores scene occlusion.
 */
export class HighlightPass {
  readonly pipeline: THREE.RenderPipeline;

  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;
  #downSampleRatio: number;

  #entryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #entries: HighlightEntry[] = [];
  #priorityMeshes = new Set<THREE.Mesh>();
  #isolatedEntryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #instancedMask = new InstancedHighlightMask();
  #lastEntryCount = 0;

  #edgeThickness: number;
  #edgeGlow: number;
  #edgeThicknessUniform;
  #edgeGlowUniform;

  #blurDirection = new THREE.Vector2();
  #invSize = new THREE.Vector2();
  #maskColor = new THREE.Color();
  #blurDirectionUniform;
  #invSizeUniform;
  #maskColorUniform;

  #renderTargetMask: THREE.RenderTarget;
  #renderTargetMaskDownSample: THREE.RenderTarget;
  #renderTargetEdge1: THREE.RenderTarget;
  #renderTargetEdge2: THREE.RenderTarget;
  #renderTargetBlur1: THREE.RenderTarget;
  #renderTargetBlur2: THREE.RenderTarget;
  #renderTargetComposite: THREE.RenderTarget;

  #renderTargetPriorityMask: THREE.RenderTarget;
  #renderTargetPriorityMaskDownSample: THREE.RenderTarget;
  #renderTargetPriorityEdge1: THREE.RenderTarget;
  #renderTargetPriorityEdge2: THREE.RenderTarget;
  #renderTargetPriorityBlur1: THREE.RenderTarget;
  #renderTargetPriorityBlur2: THREE.RenderTarget;

  #renderTargetIsolatedMask: THREE.RenderTarget;
  #renderTargetIsolatedMaskDownSample: THREE.RenderTarget;
  #renderTargetIsolatedEdge1: THREE.RenderTarget;
  #renderTargetIsolatedEdge2: THREE.RenderTarget;
  #renderTargetIsolatedBlur1: THREE.RenderTarget;
  #renderTargetIsolatedBlur2: THREE.RenderTarget;

  #maskTexture: ReturnType<typeof texture>;
  #maskDownSampleTexture: ReturnType<typeof texture>;
  #blurSourceTexture: ReturnType<typeof texture>;
  #edge1Texture: ReturnType<typeof texture>;
  #edge2Texture: ReturnType<typeof texture>;
  #compositeTexture: ReturnType<typeof texture>;

  #priorityMaskTexture: ReturnType<typeof texture>;
  #priorityMaskDownSampleTexture: ReturnType<typeof texture>;
  #priorityEdge1Texture: ReturnType<typeof texture>;
  #priorityEdge2Texture: ReturnType<typeof texture>;

  #isolatedMaskTexture: ReturnType<typeof texture>;
  #isolatedMaskDownSampleTexture: ReturnType<typeof texture>;
  #isolatedEdge1Texture: ReturnType<typeof texture>;
  #isolatedEdge2Texture: ReturnType<typeof texture>;

  #maskMaterial: THREE.NodeMaterial;
  #priorityMaskMaterial: THREE.NodeMaterial;
  #copyMaterial: THREE.NodeMaterial;
  #edgeDetectionMaterial: THREE.NodeMaterial;
  #blurMaterial1: THREE.NodeMaterial;
  #blurMaterial2: THREE.NodeMaterial;
  #compositeMaterial: THREE.NodeMaterial;

  #priorityCopyMaterial: THREE.NodeMaterial;
  #priorityEdgeDetectionMaterial: THREE.NodeMaterial;

  #isolatedCopyMaterial: THREE.NodeMaterial;
  #isolatedEdgeDetectionMaterial: THREE.NodeMaterial;

  #quad: THREE.QuadMesh;

  constructor(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: HighlightPassOptions = {}
  ) {
    const { edgeThickness = 1, edgeGlow = 0, downSampleRatio = 2 } = options;

    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;
    this.#downSampleRatio = downSampleRatio;
    this.#edgeThickness = edgeThickness;
    this.#edgeGlow = edgeGlow;

    this.#edgeThicknessUniform = uniform(edgeThickness);
    this.#edgeGlowUniform = uniform(edgeGlow);
    this.#blurDirectionUniform = uniform(this.#blurDirection);
    this.#invSizeUniform = uniform(this.#invSize);
    this.#maskColorUniform = uniform(this.#maskColor);

    const edgeThicknessNode = this.#edgeThicknessUniform;
    const edgeGlowNode = this.#edgeGlowUniform;
    const blurDirectionNode = this.#blurDirectionUniform;
    const invSizeNode = this.#invSizeUniform;
    const maskColorNode = this.#maskColorUniform;

    this.#renderTargetMask = new THREE.RenderTarget(1, 1);
    this.#renderTargetMaskDownSample = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetEdge1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetEdge2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetBlur1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetBlur2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetComposite = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    this.#renderTargetPriorityMask = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityMaskDownSample = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityEdge1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityEdge2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityBlur1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityBlur2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    this.#renderTargetIsolatedMask = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedMaskDownSample = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedEdge1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedEdge2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedBlur1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedBlur2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    this.#maskTexture = texture(this.#renderTargetMask.texture);
    this.#maskDownSampleTexture = texture(this.#renderTargetMaskDownSample.texture);
    this.#blurSourceTexture = texture(this.#renderTargetEdge1.texture);
    this.#edge1Texture = texture(this.#renderTargetEdge1.texture);
    this.#edge2Texture = texture(this.#renderTargetEdge2.texture);
    this.#compositeTexture = texture(this.#renderTargetComposite.texture);

    this.#priorityMaskTexture = texture(this.#renderTargetPriorityMask.texture);
    this.#priorityMaskDownSampleTexture = texture(this.#renderTargetPriorityMaskDownSample.texture);
    this.#priorityEdge1Texture = texture(this.#renderTargetPriorityEdge1.texture);
    this.#priorityEdge2Texture = texture(this.#renderTargetPriorityEdge2.texture);

    this.#isolatedMaskTexture = texture(this.#renderTargetIsolatedMask.texture);
    this.#isolatedMaskDownSampleTexture = texture(this.#renderTargetIsolatedMaskDownSample.texture);
    this.#isolatedEdge1Texture = texture(this.#renderTargetIsolatedEdge1.texture);
    this.#isolatedEdge2Texture = texture(this.#renderTargetIsolatedEdge2.texture);

    const scenePassNode = pass(scene, camera);

    this.#maskMaterial = new THREE.NodeMaterial();
    this.#maskMaterial.name = "HighlightPass.mask";
    this.#maskMaterial.colorNode = vec4(maskColorNode, 1);

    this.#priorityMaskMaterial = new THREE.NodeMaterial();
    this.#priorityMaskMaterial.name = "HighlightPass.priorityMask";
    this.#priorityMaskMaterial.colorNode = vec4(maskColorNode, 1);
    this.#priorityMaskMaterial.depthTest = false;

    this.#copyMaterial = new THREE.NodeMaterial();
    this.#copyMaterial.name = "HighlightPass.copy";
    this.#copyMaterial.fragmentNode = this.#maskTexture;

    this.#priorityCopyMaterial = new THREE.NodeMaterial();
    this.#priorityCopyMaterial.name = "HighlightPass.priorityCopy";
    this.#priorityCopyMaterial.fragmentNode = this.#priorityMaskTexture;

    this.#isolatedCopyMaterial = new THREE.NodeMaterial();
    this.#isolatedCopyMaterial.name = "HighlightPass.isolatedCopy";
    this.#isolatedCopyMaterial.fragmentNode = this.#isolatedMaskTexture;

    this.#edgeDetectionMaterial = new THREE.NodeMaterial();
    this.#edgeDetectionMaterial.name = "HighlightPass.edgeDetection";
    this.#edgeDetectionMaterial.fragmentNode = buildEdgeDetection(this.#maskDownSampleTexture, invSizeNode);

    this.#priorityEdgeDetectionMaterial = new THREE.NodeMaterial();
    this.#priorityEdgeDetectionMaterial.name = "HighlightPass.priorityEdgeDetection";
    this.#priorityEdgeDetectionMaterial.fragmentNode = buildEdgeDetection(
      this.#priorityMaskDownSampleTexture, invSizeNode
    );

    this.#isolatedEdgeDetectionMaterial = new THREE.NodeMaterial();
    this.#isolatedEdgeDetectionMaterial.name = "HighlightPass.isolatedEdgeDetection";
    this.#isolatedEdgeDetectionMaterial.fragmentNode = buildEdgeDetection(
      this.#isolatedMaskDownSampleTexture, invSizeNode
    );

    this.#blurMaterial1 = new THREE.NodeMaterial();
    this.#blurMaterial1.name = "HighlightPass.blur1";
    this.#blurMaterial1.fragmentNode = buildSeparableBlur(
      this.#blurSourceTexture, blurDirectionNode, invSizeNode, edgeThicknessNode
    );

    this.#blurMaterial2 = new THREE.NodeMaterial();
    this.#blurMaterial2.name = "HighlightPass.blur2";
    this.#blurMaterial2.fragmentNode = buildSeparableBlur(
      this.#blurSourceTexture, blurDirectionNode, invSizeNode, float(MAX_BLUR_RADIUS)
    );

    this.#compositeMaterial = new THREE.NodeMaterial();
    this.#compositeMaterial.name = "HighlightPass.composite";
    this.#compositeMaterial.fragmentNode = buildHighlightComposite(
      { edge1: this.#edge1Texture, edge2: this.#edge2Texture, mask: this.#maskTexture },
      { edge1: this.#priorityEdge1Texture, edge2: this.#priorityEdge2Texture, mask: this.#priorityMaskTexture },
      { edge1: this.#isolatedEdge1Texture, edge2: this.#isolatedEdge2Texture, mask: this.#isolatedMaskTexture },
      edgeGlowNode
    );

    this.#quad = new THREE.QuadMesh();

    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = this.#compositeTexture.add(scenePassNode);
  }

  get edgeThickness(): number {
    return this.#edgeThickness;
  }

  set edgeThickness(
    edgeThickness: number
  ) {
    this.#edgeThickness = edgeThickness;
    this.#edgeThicknessUniform.value = edgeThickness;
  }

  get edgeGlow(): number {
    return this.#edgeGlow;
  }

  set edgeGlow(
    edgeGlow: number
  ) {
    this.#edgeGlow = edgeGlow;
    this.#edgeGlowUniform.value = edgeGlow;
  }

  /**
   * Replaces all outlined entries.
   */
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

      if (isolated) {
        target.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            this.#isolatedEntryByMesh.set(object, threeColor);
          }
        });
        continue;
      }

      target.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          this.#entryByMesh.set(object, threeColor);
          if (priority) {
            this.#priorityMeshes.add(object);
          }
        }
      });
    }

    this.#instancedMask.sync();
  }

  render(): void {
    this.#renderMask();
    this.pipeline.render();
  }

  dispose(): void {
    this.#entries = [];
    this.#entryByMesh.clear();
    this.#priorityMeshes.clear();
    this.#isolatedEntryByMesh.clear();
    this.#instancedMask.dispose();

    this.#renderTargetMask.dispose();
    this.#renderTargetMaskDownSample.dispose();
    this.#renderTargetEdge1.dispose();
    this.#renderTargetEdge2.dispose();
    this.#renderTargetBlur1.dispose();
    this.#renderTargetBlur2.dispose();
    this.#renderTargetComposite.dispose();
    this.#renderTargetPriorityMask.dispose();
    this.#renderTargetPriorityMaskDownSample.dispose();
    this.#renderTargetPriorityEdge1.dispose();
    this.#renderTargetPriorityEdge2.dispose();
    this.#renderTargetPriorityBlur1.dispose();
    this.#renderTargetPriorityBlur2.dispose();
    this.#renderTargetIsolatedMask.dispose();
    this.#renderTargetIsolatedMaskDownSample.dispose();
    this.#renderTargetIsolatedEdge1.dispose();
    this.#renderTargetIsolatedEdge2.dispose();
    this.#renderTargetIsolatedBlur1.dispose();
    this.#renderTargetIsolatedBlur2.dispose();

    this.#maskMaterial.dispose();
    this.#priorityMaskMaterial.dispose();
    this.#copyMaterial.dispose();
    this.#edgeDetectionMaterial.dispose();
    this.#blurMaterial1.dispose();
    this.#blurMaterial2.dispose();
    this.#compositeMaterial.dispose();
    this.#priorityCopyMaterial.dispose();
    this.#priorityEdgeDetectionMaterial.dispose();
    this.#isolatedCopyMaterial.dispose();
    this.#isolatedEdgeDetectionMaterial.dispose();

    this.pipeline.dispose();
  }

  #renderMask(): void {
    const renderer = this.#renderer;
    const scene = this.#scene;
    const camera = this.#camera;

    if (this.#entryByMesh.size === 0 && this.#instancedMask.size === 0 && this.#isolatedEntryByMesh.size === 0) {
      if (this.#lastEntryCount > 0) {
        this.#clearComposite();
        this.#lastEntryCount = 0;
      }

      return;
    }
    this.#lastEntryCount = this.#entryByMesh.size + this.#instancedMask.size + this.#isolatedEntryByMesh.size;

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousRenderObjectFunction = renderer.getRenderObjectFunction();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    const previousBackground = scene.background;

    scene.background = null;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.#setSize(size.width, size.height);

    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);

    renderer.setRenderObjectFunction((
      object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
      // eslint-disable-next-line max-params -- external callback contract
    ) => {
      if (object instanceof THREE.InstancedMesh) {
        const instanced = this.#instancedMask.materialsFor(object);
        if (instanced) {
          renderer.renderObject(
            object, objectScene, objectCamera, geometry, instanced.material, group, lightsNode, clippingContext
          );

          return;
        }
      }

      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      const color = this.#entryByMesh.get(object);
      if (color === undefined) {
        return;
      }

      this.#maskColor.copy(color);
      renderer.renderObject(object, objectScene, objectCamera, geometry, this.#maskMaterial, group, lightsNode, clippingContext);
    });

    renderer.setRenderTarget(this.#renderTargetMask);
    renderer.render(scene, camera);

    const hasPriority = this.#priorityMeshes.size > 0 || this.#instancedMask.size > 0;

    if (hasPriority) {
      renderer.autoClear = false;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract
      ) => {
        if (object instanceof THREE.InstancedMesh) {
          const instanced = this.#instancedMask.materialsFor(object);
          if (instanced) {
            renderer.renderObject(
              object, objectScene, objectCamera, geometry, instanced.priorityMaterial, group, lightsNode, clippingContext
            );

            return;
          }
        }

        if (!(object instanceof THREE.Mesh) || !this.#priorityMeshes.has(object)) {
          return;
        }

        const color = this.#entryByMesh.get(object);
        if (color === undefined) {
          return;
        }

        this.#maskColor.copy(color);
        renderer.renderObject(
          object, objectScene, objectCamera, geometry, this.#priorityMaskMaterial, group, lightsNode, clippingContext
        );
      });
      renderer.render(scene, camera);

      renderer.autoClear = true;
      renderer.setRenderTarget(this.#renderTargetPriorityMask);
      renderer.render(scene, camera);
    }
    else {
      renderer.setRenderTarget(this.#renderTargetPriorityEdge1);
      renderer.clear();
      renderer.setRenderTarget(this.#renderTargetPriorityEdge2);
      renderer.clear();
    }

    const hasIsolated = this.#isolatedEntryByMesh.size > 0;

    if (hasIsolated) {
      renderer.autoClear = true;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract
      ) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }
        const color = this.#isolatedEntryByMesh.get(object);
        if (color === undefined) {
          return;
        }

        this.#maskColor.copy(color);
        renderer.renderObject(
          object, objectScene, objectCamera, geometry, this.#priorityMaskMaterial, group, lightsNode, clippingContext
        );
      });
      renderer.setRenderTarget(this.#renderTargetIsolatedMask);
      renderer.render(scene, camera);
    }
    else {
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge1);
      renderer.clear();
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge2);
      renderer.clear();
    }

    renderer.setRenderObjectFunction(previousRenderObjectFunction);

    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    scene.background = previousBackground;

    this.#quad.material = this.#copyMaterial;
    renderer.setRenderTarget(this.#renderTargetMaskDownSample);
    this.#quad.render(renderer);

    this.#quad.material = this.#edgeDetectionMaterial;
    renderer.setRenderTarget(this.#renderTargetEdge1);
    this.#quad.render(renderer);

    this.#blurSourceTexture.value = this.#renderTargetEdge1.texture;
    this.#blurDirection.set(1, 0);
    this.#quad.material = this.#blurMaterial1;
    renderer.setRenderTarget(this.#renderTargetBlur1);
    this.#quad.render(renderer);

    this.#blurSourceTexture.value = this.#renderTargetBlur1.texture;
    this.#blurDirection.set(0, 1);
    renderer.setRenderTarget(this.#renderTargetEdge1);
    this.#quad.render(renderer);

    this.#blurSourceTexture.value = this.#renderTargetEdge1.texture;
    this.#blurDirection.set(1, 0);
    this.#quad.material = this.#blurMaterial2;
    renderer.setRenderTarget(this.#renderTargetBlur2);
    this.#quad.render(renderer);

    this.#blurSourceTexture.value = this.#renderTargetBlur2.texture;
    this.#blurDirection.set(0, 1);
    renderer.setRenderTarget(this.#renderTargetEdge2);
    this.#quad.render(renderer);

    if (hasPriority) {
      this.#quad.material = this.#priorityCopyMaterial;
      renderer.setRenderTarget(this.#renderTargetPriorityMaskDownSample);
      this.#quad.render(renderer);

      this.#quad.material = this.#priorityEdgeDetectionMaterial;
      renderer.setRenderTarget(this.#renderTargetPriorityEdge1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetPriorityEdge1.texture;
      this.#blurDirection.set(1, 0);
      this.#quad.material = this.#blurMaterial1;
      renderer.setRenderTarget(this.#renderTargetPriorityBlur1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetPriorityBlur1.texture;
      this.#blurDirection.set(0, 1);
      renderer.setRenderTarget(this.#renderTargetPriorityEdge1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetPriorityEdge1.texture;
      this.#blurDirection.set(1, 0);
      this.#quad.material = this.#blurMaterial2;
      renderer.setRenderTarget(this.#renderTargetPriorityBlur2);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetPriorityBlur2.texture;
      this.#blurDirection.set(0, 1);
      renderer.setRenderTarget(this.#renderTargetPriorityEdge2);
      this.#quad.render(renderer);
    }

    if (hasIsolated) {
      this.#quad.material = this.#isolatedCopyMaterial;
      renderer.setRenderTarget(this.#renderTargetIsolatedMaskDownSample);
      this.#quad.render(renderer);

      this.#quad.material = this.#isolatedEdgeDetectionMaterial;
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetIsolatedEdge1.texture;
      this.#blurDirection.set(1, 0);
      this.#quad.material = this.#blurMaterial1;
      renderer.setRenderTarget(this.#renderTargetIsolatedBlur1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetIsolatedBlur1.texture;
      this.#blurDirection.set(0, 1);
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetIsolatedEdge1.texture;
      this.#blurDirection.set(1, 0);
      this.#quad.material = this.#blurMaterial2;
      renderer.setRenderTarget(this.#renderTargetIsolatedBlur2);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetIsolatedBlur2.texture;
      this.#blurDirection.set(0, 1);
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge2);
      this.#quad.render(renderer);
    }

    this.#quad.material = this.#compositeMaterial;
    renderer.setRenderTarget(this.#renderTargetComposite);
    this.#quad.render(renderer);

    renderer.setRenderTarget(previousTarget);
  }

  #clearComposite(): void {
    const renderer = this.#renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();

    renderer.setRenderTarget(this.#renderTargetComposite);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();

    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
  }

  #setSize(
    width: number,
    height: number
  ): void {
    this.#renderTargetMask.setSize(width, height);
    this.#renderTargetComposite.setSize(width, height);
    this.#renderTargetPriorityMask.setSize(width, height);
    this.#renderTargetIsolatedMask.setSize(width, height);

    let resx = Math.round(width / this.#downSampleRatio);
    let resy = Math.round(height / this.#downSampleRatio);
    this.#renderTargetMaskDownSample.setSize(resx, resy);
    this.#renderTargetEdge1.setSize(resx, resy);
    this.#renderTargetBlur1.setSize(resx, resy);
    this.#renderTargetPriorityMaskDownSample.setSize(resx, resy);
    this.#renderTargetPriorityEdge1.setSize(resx, resy);
    this.#renderTargetPriorityBlur1.setSize(resx, resy);
    this.#renderTargetIsolatedMaskDownSample.setSize(resx, resy);
    this.#renderTargetIsolatedEdge1.setSize(resx, resy);
    this.#renderTargetIsolatedBlur1.setSize(resx, resy);
    this.#invSize.set(1 / resx, 1 / resy);

    resx = Math.round(resx / 2);
    resy = Math.round(resy / 2);
    this.#renderTargetEdge2.setSize(resx, resy);
    this.#renderTargetBlur2.setSize(resx, resy);
    this.#renderTargetPriorityEdge2.setSize(resx, resy);
    this.#renderTargetPriorityBlur2.setSize(resx, resy);
    this.#renderTargetIsolatedEdge2.setSize(resx, resy);
    this.#renderTargetIsolatedBlur2.setSize(resx, resy);
  }
}
