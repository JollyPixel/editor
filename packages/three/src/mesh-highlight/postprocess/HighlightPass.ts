// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  float,
  uniform,
  texture,
  pass
} from "three/tsl";

// Import Internal Dependencies
import type { SelectableObject } from "../MeshHighlightState.ts";
import { MAX_BLUR_RADIUS, buildSeparableBlur } from "./tsl/gaussianBlur.ts";
import { buildEdgeDetection } from "./tsl/edgeDetection.ts";
import {
  buildHighlightComposite,
  type HighlightCompositeChannel
} from "./tsl/composite.ts";
import type { TslTextureNode } from "./tsl/tslNode.ts";
import { HighlightMask } from "./HighlightMask.ts";

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

interface EdgeChannel {
  maskDownSample: THREE.RenderTarget;
  edge1: THREE.RenderTarget;
  edge2: THREE.RenderTarget;
  blur1: THREE.RenderTarget;
  blur2: THREE.RenderTarget;
  copyMaterial: THREE.NodeMaterial;
  edgeDetectionMaterial: THREE.NodeMaterial;
  composite: HighlightCompositeChannel;
}

export class HighlightPass {
  readonly pipeline: THREE.RenderPipeline;

  #renderer: THREE.WebGPURenderer;
  #mask: HighlightMask;
  #downSampleRatio: number;
  #size = new THREE.Vector2();

  #edgeThickness: number;
  #edgeGlow: number;
  #edgeThicknessUniform;
  #edgeGlowUniform;

  #blurDirection = new THREE.Vector2();
  #invSize = new THREE.Vector2();
  #invSizeUniform;
  #blurSourceTexture: TslTextureNode;

  #shared: EdgeChannel;
  #priority: EdgeChannel;
  #isolated: EdgeChannel;

  #blurMaterial1: THREE.NodeMaterial;
  #blurMaterial2: THREE.NodeMaterial;
  #compositeMaterial: THREE.NodeMaterial;
  #quad: THREE.QuadMesh;

  constructor(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: HighlightPassOptions = {}
  ) {
    const { edgeThickness = 1, edgeGlow = 0, downSampleRatio = 2 } = options;

    this.#renderer = renderer;
    this.#mask = new HighlightMask(renderer, scene, camera);
    this.#downSampleRatio = downSampleRatio;
    this.#edgeThickness = edgeThickness;
    this.#edgeGlow = edgeGlow;

    this.#edgeThicknessUniform = uniform(edgeThickness);
    this.#edgeGlowUniform = uniform(edgeGlow);
    this.#invSizeUniform = uniform(this.#invSize);
    const blurDirectionNode = uniform(this.#blurDirection);

    this.#shared = this.#createChannel(this.#mask.shared, "shared");
    this.#priority = this.#createChannel(this.#mask.priority, "priority");
    this.#isolated = this.#createChannel(this.#mask.isolated, "isolated");

    this.#blurSourceTexture = texture(this.#shared.edge1.texture);
    this.#blurMaterial1 = new THREE.NodeMaterial();
    this.#blurMaterial1.name = "HighlightPass.blur1";
    this.#blurMaterial1.fragmentNode = buildSeparableBlur(
      this.#blurSourceTexture,
      blurDirectionNode,
      this.#invSizeUniform,
      this.#edgeThicknessUniform
    );

    this.#blurMaterial2 = new THREE.NodeMaterial();
    this.#blurMaterial2.name = "HighlightPass.blur2";
    this.#blurMaterial2.fragmentNode = buildSeparableBlur(
      this.#blurSourceTexture,
      blurDirectionNode,
      this.#invSizeUniform,
      float(MAX_BLUR_RADIUS)
    );

    this.#compositeMaterial = new THREE.NodeMaterial();
    this.#compositeMaterial.name = "HighlightPass.composite";
    this.#compositeMaterial.fragmentNode = buildHighlightComposite(
      this.#shared.composite,
      this.#priority.composite,
      this.#isolated.composite,
      this.#edgeGlowUniform
    );

    this.#quad = new THREE.QuadMesh(this.#compositeMaterial);

    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = texture(this.#mask.composite.texture)
      .add(pass(scene, camera));
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

  get downSampleRatio(): number {
    return this.#downSampleRatio;
  }

  set downSampleRatio(
    downSampleRatio: number
  ) {
    this.#downSampleRatio = downSampleRatio;
  }

  configure(
    options: HighlightPassOptions
  ): void {
    const {
      edgeThickness = this.#edgeThickness,
      edgeGlow = this.#edgeGlow,
      downSampleRatio = this.#downSampleRatio
    } = options;

    this.edgeThickness = edgeThickness;
    this.edgeGlow = edgeGlow;
    this.downSampleRatio = downSampleRatio;
  }

  get entries(): HighlightEntry[] {
    return this.#mask.entries;
  }

  set entries(
    entries: HighlightEntry[]
  ) {
    this.#mask.entries = entries;
  }

  render(): void {
    if (this.#mask.size > 0) {
      const size = this.#renderer.getDrawingBufferSize(this.#size);
      this.#resize(size.width, size.height);
    }
    if (this.#mask.render()) {
      this.#renderEdges();
    }
    this.pipeline.render();
  }

  dispose(): void {
    this.#mask.dispose();
    for (const channel of [this.#shared, this.#priority, this.#isolated]) {
      channel.maskDownSample.dispose();
      channel.edge1.dispose();
      channel.edge2.dispose();
      channel.blur1.dispose();
      channel.blur2.dispose();
      channel.copyMaterial.dispose();
      channel.edgeDetectionMaterial.dispose();
    }
    this.#blurMaterial1.dispose();
    this.#blurMaterial2.dispose();
    this.#compositeMaterial.dispose();
    this.pipeline.dispose();
  }

  #createChannel(
    mask: THREE.RenderTarget,
    name: string
  ): EdgeChannel {
    const maskDownSample = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    const edge1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    const edge2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    const maskTexture = texture(mask.texture);

    const copyMaterial = new THREE.NodeMaterial();
    copyMaterial.name = `HighlightPass.${name}Copy`;
    copyMaterial.fragmentNode = maskTexture;

    const edgeDetectionMaterial = new THREE.NodeMaterial();
    edgeDetectionMaterial.name = `HighlightPass.${name}EdgeDetection`;
    edgeDetectionMaterial.fragmentNode = buildEdgeDetection(
      texture(maskDownSample.texture),
      this.#invSizeUniform
    );

    return {
      maskDownSample,
      edge1,
      edge2,
      blur1: new THREE.RenderTarget(1, 1, { depthBuffer: false }),
      blur2: new THREE.RenderTarget(1, 1, { depthBuffer: false }),
      copyMaterial,
      edgeDetectionMaterial,
      composite: {
        edge1: texture(edge1.texture),
        edge2: texture(edge2.texture),
        mask: maskTexture
      }
    };
  }

  #renderEdges(): void {
    const renderer = this.#renderer;
    const previousTarget = renderer.getRenderTarget();

    this.#renderChannel(this.#shared);
    if (this.#mask.hasPriority) {
      this.#renderChannel(this.#priority);
    }
    else {
      this.#mask.clear(this.#priority.edge1);
      this.#mask.clear(this.#priority.edge2);
    }
    if (this.#mask.hasIsolated) {
      this.#renderChannel(this.#isolated);
    }
    else {
      this.#mask.clear(this.#isolated.edge1);
      this.#mask.clear(this.#isolated.edge2);
    }

    this.#drawQuad(this.#compositeMaterial, this.#mask.composite);
    renderer.setRenderTarget(previousTarget);
  }

  #renderChannel(
    channel: EdgeChannel
  ): void {
    this.#drawQuad(channel.copyMaterial, channel.maskDownSample);
    this.#drawQuad(channel.edgeDetectionMaterial, channel.edge1);

    this.#blur(this.#blurMaterial1, channel.edge1, channel.blur1, channel.edge1);
    this.#blur(this.#blurMaterial2, channel.edge1, channel.blur2, channel.edge2);
  }

  #blur(
    material: THREE.NodeMaterial,
    source: THREE.RenderTarget,
    intermediate: THREE.RenderTarget,
    destination: THREE.RenderTarget
  ): void {
    this.#blurSourceTexture.value = source.texture;
    this.#blurDirection.set(1, 0);
    this.#drawQuad(material, intermediate);

    this.#blurSourceTexture.value = intermediate.texture;
    this.#blurDirection.set(0, 1);
    this.#drawQuad(material, destination);
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
    this.#mask.resize(width, height);

    let resx = Math.round(width / this.#downSampleRatio);
    let resy = Math.round(height / this.#downSampleRatio);
    for (const channel of [this.#shared, this.#priority, this.#isolated]) {
      channel.maskDownSample.setSize(resx, resy);
      channel.edge1.setSize(resx, resy);
      channel.blur1.setSize(resx, resy);
    }
    this.#invSize.set(1 / resx, 1 / resy);

    resx = Math.round(resx / 2);
    resy = Math.round(resy / 2);
    for (const channel of [this.#shared, this.#priority, this.#isolated]) {
      channel.edge2.setSize(resx, resy);
      channel.blur2.setSize(resx, resy);
    }
  }
}
