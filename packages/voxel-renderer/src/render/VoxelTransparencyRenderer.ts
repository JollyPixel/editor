// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  clamp,
  mrt,
  output,
  positionView,
  renderOutput,
  texture,
  vec4
} from "three/tsl";

// CONSTANTS
const kTargetOptions = {
  type: THREE.HalfFloatType,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter
};

/**
 * Weighted blended transparency for a complete scene and camera.
 * Two transparent draws avoid requiring indexed MRT blending on WebGL.
 * Colours are approximate; accumulated coverage is order independent.
 */
export class VoxelTransparencyRenderer {
  #renderer: THREE.WebGPURenderer;
  #opaque = new THREE.RenderTarget(1, 1, kTargetOptions);
  #accumulation = new THREE.RenderTarget(1, 1, kTargetOptions);
  #coverage = new THREE.RenderTarget(1, 1, kTargetOptions);
  #depth = new THREE.DepthTexture(1, 1);
  #quad: THREE.QuadMesh;
  #material: THREE.NodeMaterial;
  #size = new THREE.Vector2();
  #accumulationOutput;
  #coverageOutput;

  constructor(
    renderer: THREE.WebGPURenderer
  ) {
    this.#renderer = renderer;
    for (const target of [this.#opaque, this.#accumulation, this.#coverage]) {
      target.depthTexture = this.#depth;
      target.texture.name = "output";
    }

    const weight = clamp(
      output.a.add(0.01).pow(3).mul(32)
        .div(positionView.z.abs().mul(0.01).add(1)
          .pow(2)),
      0.01,
      32
    );
    this.#accumulationOutput = mrt({
      output: vec4(output.rgb.mul(output.a), output.a).mul(weight)
    });
    this.#coverageOutput = mrt({ output: vec4(0, 0, 0, output.a) });

    const base = texture(this.#opaque.texture);
    const accumulated = texture(this.#accumulation.texture);
    const coverage = texture(this.#coverage.texture).a.clamp(0, 1);
    const remaining = coverage.oneMinus();
    const alpha = coverage.add(base.a.mul(remaining));
    const rgb = accumulated.rgb.div(accumulated.a.max(0.000001))
      .mul(coverage).add(base.rgb.mul(remaining));
    const material = new THREE.NodeMaterial();
    material.fragmentNode = renderOutput(vec4(rgb, alpha));
    material.depthTest = false;
    material.depthWrite = false;
    this.#material = material;
    this.#quad = new THREE.QuadMesh(material);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.Camera
  ): void {
    const renderer = this.#renderer;
    const target = renderer.getRenderTarget();
    const viewport = renderer.getViewport(new THREE.Vector4());
    const scissor = renderer.getScissor(new THREE.Vector4());
    const scissorTest = renderer.getScissorTest();
    const state = {
      autoClear: renderer.autoClear,
      opaque: renderer.opaque,
      transparent: renderer.transparent,
      toneMapping: renderer.toneMapping,
      outputColorSpace: renderer.outputColorSpace,
      background: scene.background,
      backgroundNode: scene.backgroundNode,
      clearColor: renderer.getClearColor(new THREE.Color()),
      clearAlpha: renderer.getClearAlpha(),
      mrt: renderer.getMRT(),
      renderObject: renderer.getRenderObjectFunction()
    };
    if (target) {
      this.#size.set(target.width, target.height);
    }
    else {
      renderer.getDrawingBufferSize(this.#size);
    }

    const buffers = [
      this.#opaque,
      this.#accumulation,
      this.#coverage
    ];
    if (
      this.#opaque.width !== this.#size.x ||
      this.#opaque.height !== this.#size.y
    ) {
      for (const buffer of buffers) {
        buffer.setSize(this.#size.x, this.#size.y);
      }

      for (const buffer of buffers) {
        renderer.initRenderTarget(buffer);
      }
    }
    try {
      renderer.autoClear = false;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      renderer.setScissorTest(false);
      renderer.setMRT(null);
      renderer.setRenderTarget(this.#opaque);
      renderer.opaque = true;
      renderer.transparent = false;
      renderer.clear();
      renderer.render(scene, camera);

      scene.background = null;
      scene.backgroundNode = null;
      renderer.setClearColor(0, 0);
      renderer.opaque = false;
      renderer.transparent = true;
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
        renderer.render(scene, camera);
      }

      renderer.setRenderObjectFunction(null);
      renderer.setMRT(null);
      renderer.setRenderTarget(target);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.opaque = true;
      renderer.transparent = true;
      renderer.toneMapping = state.toneMapping;
      renderer.outputColorSpace = state.outputColorSpace;
      this.#quad.render(renderer);
    }
    finally {
      renderer.setRenderObjectFunction(state.renderObject);
      renderer.setMRT(state.mrt);
      renderer.setRenderTarget(target);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      renderer.setClearColor(state.clearColor, state.clearAlpha);
      renderer.autoClear = state.autoClear;
      renderer.opaque = state.opaque;
      renderer.transparent = state.transparent;
      renderer.toneMapping = state.toneMapping;
      renderer.outputColorSpace = state.outputColorSpace;
      scene.background = state.background;
      scene.backgroundNode = state.backgroundNode;
    }
  }

  dispose(): void {
    this.#material.dispose();

    for (const target of [this.#opaque, this.#accumulation, this.#coverage]) {
      target.depthTexture = null;
      target.dispose();
    }
    this.#depth.dispose();
  }
}
