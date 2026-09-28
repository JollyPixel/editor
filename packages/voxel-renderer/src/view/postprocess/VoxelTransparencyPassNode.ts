// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  cameraFar,
  clamp,
  mrt,
  output,
  passTexture,
  positionView,
  vec4
} from "three/tsl";

// Import Internal Dependencies
import { SettledSize } from "./SettledSize.ts";

// CONSTANTS
const kDepthWeightRange = 10;
const kTargetOptions = {
  type: THREE.HalfFloatType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter
};

export interface VoxelTransparencyPassOptions {
  /**
   * MSAA sample count of the offscreen targets; 0 disables antialiasing.
   * @default renderer.samples
   */
  samples?: number;
}

/**
 * Weighted blended transparency for a complete scene and camera.
 * Two transparent draws avoid requiring indexed MRT blending on WebGL.
 * Colours are approximate; accumulated coverage is order independent.
 */
export class VoxelTransparencyPassNode extends THREE.PassNode {
  #scene: THREE.Scene;
  #accumulation: THREE.RenderTarget;
  #coverage: THREE.RenderTarget;
  #composite: THREE.Node;
  #accumulationOutput: THREE.MRTNode;
  #coverageOutput: THREE.MRTNode;
  #renderer: THREE.Renderer | null = null;
  #allocated = new SettledSize();
  #primed = false;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: VoxelTransparencyPassOptions = {}
  ) {
    super(THREE.PassNode.COLOR, scene, camera, options);
    this.transparent = false;
    this.#scene = scene;

    this.#accumulation = new THREE.RenderTarget(1, 1, kTargetOptions);
    this.#coverage = new THREE.RenderTarget(1, 1, kTargetOptions);
    for (const target of [this.#accumulation, this.#coverage]) {
      target.depthTexture = this.renderTarget.depthTexture;
      target.texture.name = "output";
    }

    const depth = positionView.z.abs()
      .div(cameraFar)
      .mul(kDepthWeightRange)
      .add(1);
    const weight = clamp(
      output.a.add(0.01).pow(3).mul(32)
        .div(depth.pow(2)),
      0.01,
      32
    );
    this.#accumulationOutput = mrt({
      output: vec4(output.rgb.mul(output.a), output.a).mul(weight)
    });
    this.#coverageOutput = mrt({ output: vec4(0, 0, 0, output.a) });

    const base = this.getTextureNode("output");
    const accumulated = passTexture(this, this.#accumulation.texture);
    const coverage = passTexture(this, this.#coverage.texture).a.clamp(0, 1);
    const remaining = coverage.oneMinus();
    const alpha = coverage.add(base.a.mul(remaining));
    const rgb = accumulated.rgb.div(accumulated.a.max(0.000001))
      .mul(coverage).add(base.rgb.mul(remaining));
    this.#composite = vec4(rgb, alpha);
  }

  override setup(
    builder: THREE.NodeBuilder
  ): THREE.Node {
    super.setup(builder);
    this.#renderer = builder.renderer;
    this.#accumulation.samples = this.renderTarget.samples;
    this.#coverage.samples = this.renderTarget.samples;

    return this.#composite;
  }

  override setSize(
    width: number,
    height: number
  ): void {
    if (this.#allocated.request(width, height)) {
      this.#primed = false;
    }
    super.setSize(this.#allocated.width, this.#allocated.height);

    const { width: targetWidth, height: targetHeight } = this.renderTarget;
    this.#accumulation.setSize(targetWidth, targetHeight);
    this.#coverage.setSize(targetWidth, targetHeight);
    if (!this.#primed && this.#renderer) {
      for (const target of [this.renderTarget, this.#accumulation, this.#coverage]) {
        this.#renderer.initRenderTarget(target);
      }
      this.#primed = true;
    }
  }

  override updateBefore(
    frame: THREE.NodeFrame
  ): undefined {
    const renderer = frame.renderer;
    if (!renderer) {
      return;
    }

    const scene = this.#scene;
    const state = {
      target: renderer.getRenderTarget(),
      mrt: renderer.getMRT(),
      autoClear: renderer.autoClear,
      opaque: renderer.opaque,
      transparent: renderer.transparent,
      background: scene.background,
      backgroundNode: scene.backgroundNode,
      clearColor: renderer.getClearColor(new THREE.Color()),
      clearAlpha: renderer.getClearAlpha(),
      renderObject: renderer.getRenderObjectFunction()
    };
    try {
      super.updateBefore(frame);

      renderer.autoClear = false;
      renderer.opaque = false;
      renderer.transparent = true;
      renderer.setClearColor(0, 0);
      scene.background = null;
      scene.backgroundNode = null;
      for (const coverage of [false, true]) {
        renderer.setRenderTarget(coverage ? this.#coverage : this.#accumulation);
        renderer.setMRT(coverage ? this.#coverageOutput : this.#accumulationOutput);
        renderer.clear(true, false, false);
        renderer.setRenderObjectFunction((...args) => {
          const material = args[4];
          const saved = {
            blending: material.blending,
            blendSrc: material.blendSrc,
            blendDst: material.blendDst,
            blendSrcAlpha: material.blendSrcAlpha,
            blendDstAlpha: material.blendDstAlpha,
            blendEquation: material.blendEquation,
            blendEquationAlpha: material.blendEquationAlpha,
            depthWrite: material.depthWrite,
            forceSinglePass: material.forceSinglePass
          };
          try {
            material.blending = THREE.CustomBlending;
            material.blendSrc = THREE.OneFactor;
            material.blendDst = coverage ?
              THREE.OneMinusSrcAlphaFactor : THREE.OneFactor;
            material.blendSrcAlpha = THREE.OneFactor;
            material.blendDstAlpha = material.blendDst;
            material.blendEquation = THREE.AddEquation;
            material.blendEquationAlpha = THREE.AddEquation;
            material.depthWrite = false;
            material.forceSinglePass = true;
            if (state.renderObject) {
              state.renderObject(...args);
            }
            else {
              renderer.renderObject(...args);
            }
          }
          finally {
            Object.assign(material, saved);
          }
        });
        renderer.render(scene, this.camera);
      }
    }
    finally {
      renderer.setRenderObjectFunction(state.renderObject);
      renderer.setMRT(state.mrt);
      renderer.setRenderTarget(state.target);
      renderer.setClearColor(state.clearColor, state.clearAlpha);
      renderer.autoClear = state.autoClear;
      renderer.opaque = state.opaque;
      renderer.transparent = state.transparent;
      scene.background = state.background;
      scene.backgroundNode = state.backgroundNode;
    }
  }

  override dispose(): void {
    for (const target of [this.#accumulation, this.#coverage]) {
      target.depthTexture = null;
      target.dispose();
    }
    super.dispose();
  }
}

export function voxelTransparencyPass(
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: VoxelTransparencyPassOptions = {}
): VoxelTransparencyPassNode {
  return new VoxelTransparencyPassNode(scene, camera, options);
}
