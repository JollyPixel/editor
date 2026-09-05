// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  vec4,
  uniform,
  texture,
  pass
} from "three/tsl";

// Import Internal Dependencies
import type { HighlightEntry } from "./HighlightPass.ts";
import { InstancedHighlightMask } from "./InstancedHighlightMask.ts";
import { buildJfaSeedInit } from "./tsl/jfa/seed.ts";
import { buildJfaPropagateStep } from "./tsl/jfa/propagate.ts";
import { buildJfaRingComposite, type JfaRingChannel } from "./tsl/jfa/resolve.ts";

// CONSTANTS
const kIsolatedRefreshIntervalBase = 6;
const kIsolatedRefreshIntervalReferencePixels = 1920 * 1080;
const kIsolatedRefreshIntervalMax = 16;

export interface HighlightPassJfaOptions {
  /**
   * Ring thickness in screen pixels.
   * @default 2
   */
  ringThickness?: number;
  /**
   * Black inner-border thickness in screen pixels.
   * @default 1
   */
  borderThickness?: number;
  /**
   * Fill opacity for isolated entries. `0` disables it.
   * @default 0.15
   */
  isolatedFillOpacity?: number;
}

/**
 * Draws pixel-accurate Jump Flood outlines with `THREE.WebGPURenderer`.
 * Owns the scene pipeline and uses `HighlightEntry` semantics.
 */
export class HighlightPassJfa {
  readonly pipeline: THREE.RenderPipeline;

  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;

  #entryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #entries: HighlightEntry[] = [];
  #lastEntryCount = 0;
  #isolatedDirty = true;
  #isolatedFrameCounter = 0;
  #priorityMeshes = new Set<THREE.Mesh>();
  #isolatedEntryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #instancedMask = new InstancedHighlightMask();

  #ringThickness: number;
  #ringThicknessUniform;
  #borderThickness: number;
  #borderThicknessUniform;
  #isolatedFillOpacity: number;
  #isolatedFillOpacityUniform;

  #resolution = new THREE.Vector2();
  #invSize = new THREE.Vector2();
  #resolutionUniform;
  #invSizeUniform;
  #maskColor = new THREE.Color();
  #maskColorUniform;
  #hasPriorityUniform;
  #hasIsolatedUniform;

  #stepSizes: number[] = [];
  #jfaStepUniform;

  #renderTargetMask: THREE.RenderTarget;
  #renderTargetSeedA: THREE.RenderTarget;
  #renderTargetSeedB: THREE.RenderTarget;
  #renderTargetComposite: THREE.RenderTarget;

  #renderTargetPriorityMask: THREE.RenderTarget;
  #renderTargetPrioritySeedA: THREE.RenderTarget;
  #renderTargetPrioritySeedB: THREE.RenderTarget;

  #renderTargetIsolatedMask: THREE.RenderTarget;
  #renderTargetIsolatedSeedA: THREE.RenderTarget;
  #renderTargetIsolatedSeedB: THREE.RenderTarget;

  #maskTexture: ReturnType<typeof texture>;
  #compositeTexture: ReturnType<typeof texture>;
  #jfaPositionSourceTexture: ReturnType<typeof texture>;
  #jfaColorSourceTexture: ReturnType<typeof texture>;
  #finalPositionTexture: ReturnType<typeof texture>;
  #finalColorTexture: ReturnType<typeof texture>;

  #priorityMaskTexture: ReturnType<typeof texture>;
  #jfaPriorityPositionSourceTexture: ReturnType<typeof texture>;
  #jfaPriorityColorSourceTexture: ReturnType<typeof texture>;
  #finalPriorityPositionTexture: ReturnType<typeof texture>;
  #finalPriorityColorTexture: ReturnType<typeof texture>;

  #isolatedMaskTexture: ReturnType<typeof texture>;
  #jfaIsolatedPositionSourceTexture: ReturnType<typeof texture>;
  #jfaIsolatedColorSourceTexture: ReturnType<typeof texture>;
  #finalIsolatedPositionTexture: ReturnType<typeof texture>;
  #finalIsolatedColorTexture: ReturnType<typeof texture>;

  #maskMaterial: THREE.NodeMaterial;
  #seedInitMaterial: THREE.NodeMaterial;
  #jfaStepMaterial: THREE.NodeMaterial;
  #compositeMaterial: THREE.NodeMaterial;

  #priorityMaskMaterial: THREE.NodeMaterial;
  #prioritySeedInitMaterial: THREE.NodeMaterial;
  #jfaPriorityStepMaterial: THREE.NodeMaterial;

  #isolatedSeedInitMaterial: THREE.NodeMaterial;
  #jfaIsolatedStepMaterial: THREE.NodeMaterial;

  #quad: THREE.QuadMesh;

  constructor(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: HighlightPassJfaOptions = {}
  ) {
    const { ringThickness = 2, borderThickness = 1, isolatedFillOpacity = 0.15 } = options;

    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;
    this.#ringThickness = ringThickness;
    this.#borderThickness = borderThickness;
    this.#isolatedFillOpacity = isolatedFillOpacity;

    this.#ringThicknessUniform = uniform(ringThickness);
    this.#borderThicknessUniform = uniform(borderThickness);
    this.#isolatedFillOpacityUniform = uniform(isolatedFillOpacity);
    this.#resolutionUniform = uniform(this.#resolution);
    this.#invSizeUniform = uniform(this.#invSize);
    this.#maskColorUniform = uniform(this.#maskColor);
    this.#jfaStepUniform = uniform(1);
    this.#hasPriorityUniform = uniform(0);
    this.#hasIsolatedUniform = uniform(0);

    const ringThicknessNode = this.#ringThicknessUniform;
    const borderThicknessNode = this.#borderThicknessUniform;
    const isolatedFillOpacityNode = this.#isolatedFillOpacityUniform;
    const resolutionNode = this.#resolutionUniform;
    const invSizeNode = this.#invSizeUniform;
    const maskColorNode = this.#maskColorUniform;
    const jfaStepNode = this.#jfaStepUniform;
    const hasPriorityNode = this.#hasPriorityUniform;
    const hasIsolatedNode = this.#hasIsolatedUniform;

    const nearestFilter = { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter };

    this.#renderTargetMask = new THREE.RenderTarget(1, 1, nearestFilter);
    this.#renderTargetComposite = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    this.#renderTargetSeedA = this.#createSeedRenderTarget(nearestFilter);
    this.#renderTargetSeedB = this.#createSeedRenderTarget(nearestFilter);

    this.#renderTargetPriorityMask = new THREE.RenderTarget(1, 1, { depthBuffer: false, ...nearestFilter });
    this.#renderTargetPrioritySeedA = this.#createSeedRenderTarget(nearestFilter);
    this.#renderTargetPrioritySeedB = this.#createSeedRenderTarget(nearestFilter);

    this.#renderTargetIsolatedMask = new THREE.RenderTarget(1, 1, { depthBuffer: false, ...nearestFilter });
    this.#renderTargetIsolatedSeedA = this.#createSeedRenderTarget(nearestFilter);
    this.#renderTargetIsolatedSeedB = this.#createSeedRenderTarget(nearestFilter);

    this.#maskTexture = texture(this.#renderTargetMask.texture);
    this.#compositeTexture = texture(this.#renderTargetComposite.texture);
    this.#jfaPositionSourceTexture = texture(this.#renderTargetSeedA.textures[0]);
    this.#jfaColorSourceTexture = texture(this.#renderTargetSeedA.textures[1]);
    this.#finalPositionTexture = texture(this.#renderTargetSeedA.textures[0]);
    this.#finalColorTexture = texture(this.#renderTargetSeedA.textures[1]);

    this.#priorityMaskTexture = texture(this.#renderTargetPriorityMask.texture);
    this.#jfaPriorityPositionSourceTexture = texture(this.#renderTargetPrioritySeedA.textures[0]);
    this.#jfaPriorityColorSourceTexture = texture(this.#renderTargetPrioritySeedA.textures[1]);
    this.#finalPriorityPositionTexture = texture(this.#renderTargetPrioritySeedA.textures[0]);
    this.#finalPriorityColorTexture = texture(this.#renderTargetPrioritySeedA.textures[1]);

    this.#isolatedMaskTexture = texture(this.#renderTargetIsolatedMask.texture);
    this.#jfaIsolatedPositionSourceTexture = texture(this.#renderTargetIsolatedSeedA.textures[0]);
    this.#jfaIsolatedColorSourceTexture = texture(this.#renderTargetIsolatedSeedA.textures[1]);
    this.#finalIsolatedPositionTexture = texture(this.#renderTargetIsolatedSeedA.textures[0]);
    this.#finalIsolatedColorTexture = texture(this.#renderTargetIsolatedSeedA.textures[1]);

    const scenePassNode = pass(scene, camera);

    this.#maskMaterial = new THREE.NodeMaterial();
    this.#maskMaterial.name = "HighlightPassJfa.mask";
    this.#maskMaterial.colorNode = vec4(maskColorNode, 1);

    this.#priorityMaskMaterial = new THREE.NodeMaterial();
    this.#priorityMaskMaterial.name = "HighlightPassJfa.priorityMask";
    this.#priorityMaskMaterial.colorNode = vec4(maskColorNode, 1);
    this.#priorityMaskMaterial.depthTest = false;

    this.#seedInitMaterial = new THREE.NodeMaterial();
    this.#seedInitMaterial.name = "HighlightPassJfa.seedInit";
    this.#seedInitMaterial.fragmentNode = buildJfaSeedInit(this.#maskTexture, resolutionNode);

    this.#prioritySeedInitMaterial = new THREE.NodeMaterial();
    this.#prioritySeedInitMaterial.name = "HighlightPassJfa.prioritySeedInit";
    this.#prioritySeedInitMaterial.fragmentNode = buildJfaSeedInit(this.#priorityMaskTexture, resolutionNode);

    this.#isolatedSeedInitMaterial = new THREE.NodeMaterial();
    this.#isolatedSeedInitMaterial.name = "HighlightPassJfa.isolatedSeedInit";
    this.#isolatedSeedInitMaterial.fragmentNode = buildJfaSeedInit(this.#isolatedMaskTexture, resolutionNode);

    this.#jfaStepMaterial = new THREE.NodeMaterial();
    this.#jfaStepMaterial.name = "HighlightPassJfa.jfaStep";
    this.#jfaStepMaterial.fragmentNode = buildJfaPropagateStep(
      this.#jfaPositionSourceTexture, this.#jfaColorSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    this.#jfaPriorityStepMaterial = new THREE.NodeMaterial();
    this.#jfaPriorityStepMaterial.name = "HighlightPassJfa.jfaPriorityStep";
    this.#jfaPriorityStepMaterial.fragmentNode = buildJfaPropagateStep(
      this.#jfaPriorityPositionSourceTexture, this.#jfaPriorityColorSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    this.#jfaIsolatedStepMaterial = new THREE.NodeMaterial();
    this.#jfaIsolatedStepMaterial.name = "HighlightPassJfa.jfaIsolatedStep";
    this.#jfaIsolatedStepMaterial.fragmentNode = buildJfaPropagateStep(
      this.#jfaIsolatedPositionSourceTexture, this.#jfaIsolatedColorSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    const sharedChannel: JfaRingChannel = {
      positionTexture: this.#finalPositionTexture, colorTexture: this.#finalColorTexture, maskTexture: this.#maskTexture
    };
    const priorityChannel: JfaRingChannel = {
      positionTexture: this.#finalPriorityPositionTexture,
      colorTexture: this.#finalPriorityColorTexture,
      maskTexture: this.#priorityMaskTexture
    };
    const isolatedChannel: JfaRingChannel = {
      positionTexture: this.#finalIsolatedPositionTexture,
      colorTexture: this.#finalIsolatedColorTexture,
      maskTexture: this.#isolatedMaskTexture
    };

    this.#compositeMaterial = new THREE.NodeMaterial();
    this.#compositeMaterial.name = "HighlightPassJfa.composite";
    this.#compositeMaterial.fragmentNode = buildJfaRingComposite(
      {
        resolutionNode, ringThicknessNode, borderThicknessNode, isolatedFillOpacityNode, hasPriorityNode, hasIsolatedNode
      },
      sharedChannel,
      priorityChannel,
      isolatedChannel
    );

    this.#quad = new THREE.QuadMesh();

    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = this.#compositeTexture.add(scenePassNode);
  }

  #createSeedRenderTarget(
    nearestFilter: { magFilter: THREE.MagnificationTextureFilter; minFilter: THREE.MinificationTextureFilter; }
  ): THREE.RenderTarget {
    const target = new THREE.RenderTarget(1, 1, {
      depthBuffer: false, type: THREE.FloatType, count: 2, ...nearestFilter
    });
    target.textures[0].name = "position";
    target.textures[1].name = "color";

    return target;
  }

  get ringThickness(): number {
    return this.#ringThickness;
  }

  set ringThickness(
    ringThickness: number
  ) {
    this.#ringThickness = ringThickness;
    this.#ringThicknessUniform.value = ringThickness;
  }

  get borderThickness(): number {
    return this.#borderThickness;
  }

  set borderThickness(
    borderThickness: number
  ) {
    this.#borderThickness = borderThickness;
    this.#borderThicknessUniform.value = borderThickness;
  }

  get isolatedFillOpacity(): number {
    return this.#isolatedFillOpacity;
  }

  set isolatedFillOpacity(
    isolatedFillOpacity: number
  ) {
    this.#isolatedFillOpacity = isolatedFillOpacity;
    this.#isolatedFillOpacityUniform.value = isolatedFillOpacity;
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
    this.#isolatedDirty = true;

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

  /**
   * Renders the scene and outlines through the owned pipeline.
   */
  render(): void {
    this.#renderJumpFlood();
    this.pipeline.render();
  }

  dispose(): void {
    this.#entries = [];
    this.#entryByMesh.clear();
    this.#priorityMeshes.clear();
    this.#isolatedEntryByMesh.clear();
    this.#instancedMask.dispose();

    this.#renderTargetMask.dispose();
    this.#renderTargetSeedA.dispose();
    this.#renderTargetSeedB.dispose();
    this.#renderTargetComposite.dispose();
    this.#renderTargetPriorityMask.dispose();
    this.#renderTargetPrioritySeedA.dispose();
    this.#renderTargetPrioritySeedB.dispose();
    this.#renderTargetIsolatedMask.dispose();
    this.#renderTargetIsolatedSeedA.dispose();
    this.#renderTargetIsolatedSeedB.dispose();

    this.#maskMaterial.dispose();
    this.#priorityMaskMaterial.dispose();
    this.#seedInitMaterial.dispose();
    this.#prioritySeedInitMaterial.dispose();
    this.#jfaStepMaterial.dispose();
    this.#jfaPriorityStepMaterial.dispose();
    this.#isolatedSeedInitMaterial.dispose();
    this.#jfaIsolatedStepMaterial.dispose();
    this.#compositeMaterial.dispose();

    this.pipeline.dispose();
  }

  #renderJumpFlood(): void {
    const renderer = this.#renderer;
    const scene = this.#scene;
    const camera = this.#camera;

    if (this.#entryByMesh.size === 0 && this.#isolatedEntryByMesh.size === 0 && this.#instancedMask.size === 0) {
      if (this.#lastEntryCount > 0) {
        this.#clearComposite();
        this.#lastEntryCount = 0;
      }

      return;
    }
    this.#lastEntryCount = this.#entryByMesh.size + this.#isolatedEntryByMesh.size + this.#instancedMask.size;
    const hasPriority = this.#priorityMeshes.size > 0 || this.#instancedMask.size > 0;
    this.#hasPriorityUniform.value = hasPriority ? 1 : 0;
    const isolatedPresent = this.#isolatedEntryByMesh.size > 0;
    this.#hasIsolatedUniform.value = isolatedPresent ? 1 : 0;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const isolatedResolutionScale = Math.max(1, (size.width * size.height) / kIsolatedRefreshIntervalReferencePixels);
    const isolatedRefreshInterval = Math.min(
      kIsolatedRefreshIntervalMax,
      Math.round(kIsolatedRefreshIntervalBase * isolatedResolutionScale)
    );

    let hasIsolated = false;
    if (isolatedPresent) {
      this.#isolatedFrameCounter++;
      hasIsolated = this.#isolatedDirty || this.#isolatedFrameCounter % isolatedRefreshInterval === 0;
      if (hasIsolated) {
        this.#isolatedDirty = false;
      }
    }

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousRenderObjectFunction = renderer.getRenderObjectFunction();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    const previousBackground = scene.background;

    scene.background = null;

    this.#setSize(size.width, size.height);

    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);

    renderer.setRenderObjectFunction((
      object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
      // eslint-disable-next-line max-params -- external callback contract, matches HighlightPass's own override
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

    if (hasPriority) {
      renderer.autoClear = false;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract, matches HighlightPass's own override
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

    if (hasIsolated) {
      renderer.autoClear = true;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract, matches HighlightPass's own override
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

    renderer.setRenderObjectFunction(previousRenderObjectFunction);

    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    scene.background = previousBackground;

    this.#quad.material = this.#seedInitMaterial;
    renderer.setRenderTarget(this.#renderTargetSeedA);
    this.#quad.render(renderer);

    if (hasPriority) {
      this.#quad.material = this.#prioritySeedInitMaterial;
      renderer.setRenderTarget(this.#renderTargetPrioritySeedA);
      this.#quad.render(renderer);
    }

    if (hasIsolated) {
      this.#quad.material = this.#isolatedSeedInitMaterial;
      renderer.setRenderTarget(this.#renderTargetIsolatedSeedA);
      this.#quad.render(renderer);
    }

    let sourceIsA = true;
    let prioritySourceIsA = true;
    let isolatedSourceIsA = true;
    for (const step of this.#stepSizes) {
      const source = sourceIsA ? this.#renderTargetSeedA : this.#renderTargetSeedB;
      const dest = sourceIsA ? this.#renderTargetSeedB : this.#renderTargetSeedA;

      this.#jfaStepUniform.value = step;
      this.#jfaPositionSourceTexture.value = source.textures[0];
      this.#jfaColorSourceTexture.value = source.textures[1];

      this.#quad.material = this.#jfaStepMaterial;
      renderer.setRenderTarget(dest);
      this.#quad.render(renderer);

      sourceIsA = !sourceIsA;

      if (hasPriority) {
        const prioritySource = prioritySourceIsA ? this.#renderTargetPrioritySeedA : this.#renderTargetPrioritySeedB;
        const priorityDest = prioritySourceIsA ? this.#renderTargetPrioritySeedB : this.#renderTargetPrioritySeedA;

        this.#jfaPriorityPositionSourceTexture.value = prioritySource.textures[0];
        this.#jfaPriorityColorSourceTexture.value = prioritySource.textures[1];

        this.#quad.material = this.#jfaPriorityStepMaterial;
        renderer.setRenderTarget(priorityDest);
        this.#quad.render(renderer);

        prioritySourceIsA = !prioritySourceIsA;
      }

      if (hasIsolated) {
        const isolatedSource = isolatedSourceIsA ? this.#renderTargetIsolatedSeedA : this.#renderTargetIsolatedSeedB;
        const isolatedDest = isolatedSourceIsA ? this.#renderTargetIsolatedSeedB : this.#renderTargetIsolatedSeedA;

        this.#jfaIsolatedPositionSourceTexture.value = isolatedSource.textures[0];
        this.#jfaIsolatedColorSourceTexture.value = isolatedSource.textures[1];

        this.#quad.material = this.#jfaIsolatedStepMaterial;
        renderer.setRenderTarget(isolatedDest);
        this.#quad.render(renderer);

        isolatedSourceIsA = !isolatedSourceIsA;
      }
    }

    const finalTarget = sourceIsA ? this.#renderTargetSeedA : this.#renderTargetSeedB;
    this.#finalPositionTexture.value = finalTarget.textures[0];
    this.#finalColorTexture.value = finalTarget.textures[1];

    if (hasPriority) {
      const finalPriorityTarget = prioritySourceIsA ? this.#renderTargetPrioritySeedA : this.#renderTargetPrioritySeedB;
      this.#finalPriorityPositionTexture.value = finalPriorityTarget.textures[0];
      this.#finalPriorityColorTexture.value = finalPriorityTarget.textures[1];
    }
    if (hasIsolated) {
      const finalIsolatedTarget = isolatedSourceIsA ? this.#renderTargetIsolatedSeedA : this.#renderTargetIsolatedSeedB;
      this.#finalIsolatedPositionTexture.value = finalIsolatedTarget.textures[0];
      this.#finalIsolatedColorTexture.value = finalIsolatedTarget.textures[1];
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
    if (this.#resolution.x === width && this.#resolution.y === height) {
      return;
    }

    this.#resolution.set(width, height);
    this.#invSize.set(1 / width, 1 / height);

    this.#renderTargetMask.setSize(width, height);
    this.#renderTargetComposite.setSize(width, height);
    this.#renderTargetSeedA.setSize(width, height);
    this.#renderTargetSeedB.setSize(width, height);
    this.#renderTargetPriorityMask.setSize(width, height);
    this.#renderTargetPrioritySeedA.setSize(width, height);
    this.#renderTargetPrioritySeedB.setSize(width, height);
    this.#renderTargetIsolatedMask.setSize(width, height);
    this.#renderTargetIsolatedSeedA.setSize(width, height);
    this.#renderTargetIsolatedSeedB.setSize(width, height);

    this.#stepSizes = [];
    let step = 1;
    while (step < Math.max(width, height)) {
      step *= 2;
    }
    while (step >= 1) {
      this.#stepSizes.push(step);
      step = Math.floor(step / 2);
    }
  }
}
