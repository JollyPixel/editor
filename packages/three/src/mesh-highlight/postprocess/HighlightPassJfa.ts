// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  uniform,
  texture,
  pass
} from "three/tsl";

// Import Internal Dependencies
import type { HighlightEntry } from "./HighlightPass.ts";
import { HighlightMask } from "./HighlightMask.ts";
import { buildJfaSeedInit } from "./tsl/jfa/seed.ts";
import { buildJfaPropagateStep } from "./tsl/jfa/propagate.ts";
import { buildJfaRingComposite, type JfaRingChannel } from "./tsl/jfa/resolve.ts";
import type { TslTextureNode } from "./tsl/tslNode.ts";

// CONSTANTS
const kIsolatedRefreshIntervalBase = 6;
const kIsolatedRefreshIntervalReferencePixels = 1920 * 1080;
const kIsolatedRefreshIntervalMax = 16;
const kNearestFilter = {
  magFilter: THREE.NearestFilter,
  minFilter: THREE.NearestFilter
} as const;

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

interface FloodChannel {
  seedA: THREE.RenderTarget;
  seedB: THREE.RenderTarget;
  sourceIsA: boolean;
  seedInitMaterial: THREE.NodeMaterial;
  stepMaterial: THREE.NodeMaterial;
  positionSource: TslTextureNode;
  colorSource: TslTextureNode;
  ring: JfaRingChannel;
}

export class HighlightPassJfa {
  readonly pipeline: THREE.RenderPipeline;

  #renderer: THREE.WebGPURenderer;
  #mask: HighlightMask;
  #size = new THREE.Vector2();
  #isolatedDirty = true;
  #isolatedFrameCounter = 0;

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
  #hasPriorityUniform;
  #hasIsolatedUniform;

  #stepSizes: number[] = [];
  #jfaStepUniform;

  #shared: FloodChannel;
  #priority: FloodChannel;
  #isolated: FloodChannel;

  #compositeMaterial: THREE.NodeMaterial;
  #quad: THREE.QuadMesh;

  constructor(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: HighlightPassJfaOptions = {}
  ) {
    const { ringThickness = 2, borderThickness = 1, isolatedFillOpacity = 0.15 } = options;

    this.#renderer = renderer;
    this.#mask = new HighlightMask(renderer, scene, camera, kNearestFilter);
    this.#ringThickness = ringThickness;
    this.#borderThickness = borderThickness;
    this.#isolatedFillOpacity = isolatedFillOpacity;

    this.#ringThicknessUniform = uniform(ringThickness);
    this.#borderThicknessUniform = uniform(borderThickness);
    this.#isolatedFillOpacityUniform = uniform(isolatedFillOpacity);
    this.#resolutionUniform = uniform(this.#resolution);
    this.#invSizeUniform = uniform(this.#invSize);
    this.#jfaStepUniform = uniform(1);
    this.#hasPriorityUniform = uniform(0);
    this.#hasIsolatedUniform = uniform(0);

    this.#shared = this.#createChannel(this.#mask.shared, "shared");
    this.#priority = this.#createChannel(this.#mask.priority, "priority");
    this.#isolated = this.#createChannel(this.#mask.isolated, "isolated");

    this.#compositeMaterial = new THREE.NodeMaterial();
    this.#compositeMaterial.name = "HighlightPassJfa.composite";
    this.#compositeMaterial.fragmentNode = buildJfaRingComposite(
      {
        resolutionNode: this.#resolutionUniform,
        ringThicknessNode: this.#ringThicknessUniform,
        borderThicknessNode: this.#borderThicknessUniform,
        isolatedFillOpacityNode: this.#isolatedFillOpacityUniform,
        hasPriorityNode: this.#hasPriorityUniform,
        hasIsolatedNode: this.#hasIsolatedUniform
      },
      this.#shared.ring,
      this.#priority.ring,
      this.#isolated.ring
    );

    this.#quad = new THREE.QuadMesh(this.#compositeMaterial);

    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = texture(this.#mask.composite.texture)
      .add(pass(scene, camera));
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

  configure(
    options: HighlightPassJfaOptions
  ): void {
    const {
      ringThickness = this.#ringThickness,
      borderThickness = this.#borderThickness,
      isolatedFillOpacity = this.#isolatedFillOpacity
    } = options;

    this.ringThickness = ringThickness;
    this.borderThickness = borderThickness;
    this.isolatedFillOpacity = isolatedFillOpacity;
  }

  get entries(): HighlightEntry[] {
    return this.#mask.entries;
  }

  set entries(
    entries: HighlightEntry[]
  ) {
    this.#isolatedDirty = true;
    this.#mask.entries = entries;
  }

  render(): void {
    let isolated = false;
    if (this.#mask.size > 0) {
      const size = this.#renderer.getDrawingBufferSize(this.#size);
      this.#resize(size.width, size.height);
      isolated = this.#isolatedDue(size.width * size.height);
    }
    if (this.#mask.render(isolated)) {
      this.#renderJumpFlood(isolated);
    }
    this.pipeline.render();
  }

  dispose(): void {
    this.#mask.dispose();
    for (const channel of [this.#shared, this.#priority, this.#isolated]) {
      channel.seedA.dispose();
      channel.seedB.dispose();
      channel.seedInitMaterial.dispose();
      channel.stepMaterial.dispose();
    }
    this.#compositeMaterial.dispose();
    this.pipeline.dispose();
  }

  #createChannel(
    mask: THREE.RenderTarget,
    name: string
  ): FloodChannel {
    const seedA = this.#createSeedRenderTarget();
    const seedB = this.#createSeedRenderTarget();
    const maskTexture = texture(mask.texture);
    const positionSource = texture(seedA.textures[0]);
    const colorSource = texture(seedA.textures[1]);

    const seedInitMaterial = new THREE.NodeMaterial();
    seedInitMaterial.name = `HighlightPassJfa.${name}SeedInit`;
    seedInitMaterial.fragmentNode = buildJfaSeedInit(maskTexture, this.#resolutionUniform);

    const stepMaterial = new THREE.NodeMaterial();
    stepMaterial.name = `HighlightPassJfa.${name}Step`;
    stepMaterial.fragmentNode = buildJfaPropagateStep(
      positionSource,
      colorSource,
      this.#jfaStepUniform,
      this.#invSizeUniform,
      this.#resolutionUniform
    );

    return {
      seedA,
      seedB,
      sourceIsA: true,
      seedInitMaterial,
      stepMaterial,
      positionSource,
      colorSource,
      ring: {
        positionTexture: texture(seedA.textures[0]),
        colorTexture: texture(seedA.textures[1]),
        maskTexture
      }
    };
  }

  #isolatedDue(
    pixels: number
  ): boolean {
    if (!this.#mask.hasIsolated) {
      return false;
    }

    const resolutionScale = Math.max(1, pixels / kIsolatedRefreshIntervalReferencePixels);
    const refreshInterval = Math.min(
      kIsolatedRefreshIntervalMax,
      Math.round(kIsolatedRefreshIntervalBase * resolutionScale)
    );
    this.#isolatedFrameCounter++;
    const due = this.#isolatedDirty || this.#isolatedFrameCounter % refreshInterval === 0;
    if (due) {
      this.#isolatedDirty = false;
    }

    return due;
  }

  #renderJumpFlood(
    isolated: boolean
  ): void {
    const renderer = this.#renderer;
    const previousTarget = renderer.getRenderTarget();
    this.#hasPriorityUniform.value = this.#mask.hasPriority ? 1 : 0;
    this.#hasIsolatedUniform.value = this.#mask.hasIsolated ? 1 : 0;

    const channels = [this.#shared];
    if (this.#mask.hasPriority) {
      channels.push(this.#priority);
    }
    if (isolated) {
      channels.push(this.#isolated);
    }

    for (const channel of channels) {
      this.#drawQuad(channel.seedInitMaterial, channel.seedA);
      channel.sourceIsA = true;
    }

    for (const step of this.#stepSizes) {
      this.#jfaStepUniform.value = step;
      for (const channel of channels) {
        const source = channel.sourceIsA ? channel.seedA : channel.seedB;
        const destination = channel.sourceIsA ? channel.seedB : channel.seedA;
        channel.positionSource.value = source.textures[0];
        channel.colorSource.value = source.textures[1];
        this.#drawQuad(channel.stepMaterial, destination);
        channel.sourceIsA = !channel.sourceIsA;
      }
    }

    for (const channel of channels) {
      const final = channel.sourceIsA ? channel.seedA : channel.seedB;
      channel.ring.positionTexture.value = final.textures[0];
      channel.ring.colorTexture.value = final.textures[1];
    }

    this.#drawQuad(this.#compositeMaterial, this.#mask.composite);
    renderer.setRenderTarget(previousTarget);
  }

  #drawQuad(
    material: THREE.NodeMaterial,
    target: THREE.RenderTarget
  ): void {
    this.#quad.material = material;
    this.#renderer.setRenderTarget(target);
    this.#quad.render(this.#renderer);
  }

  #resize(
    width: number,
    height: number
  ): void {
    if (this.#resolution.x === width && this.#resolution.y === height) {
      return;
    }

    this.#resolution.set(width, height);
    this.#invSize.set(1 / width, 1 / height);
    this.#mask.resize(width, height);
    for (const channel of [this.#shared, this.#priority, this.#isolated]) {
      channel.seedA.setSize(width, height);
      channel.seedB.setSize(width, height);
    }

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

  #createSeedRenderTarget(): THREE.RenderTarget {
    const target = new THREE.RenderTarget(1, 1, {
      depthBuffer: false,
      type: THREE.FloatType,
      count: 2,
      ...kNearestFilter
    });
    target.textures[0].name = "position";
    target.textures[1].name = "color";

    return target;
  }
}
