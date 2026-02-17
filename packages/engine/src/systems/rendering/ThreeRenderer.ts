// Import Third-party Dependencies
import * as THREE from "three";
import { EffectComposer, type Pass } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import type {
  Renderer,
  RenderComponent,
  RendererEvents
} from "./Renderer.ts";
import type { SceneContract } from "../SceneManager.ts";
import {
  type RenderMode,
  type RenderStrategy,
  DirectRenderStrategy,
  ComposerRenderStrategy
} from "./RenderStrategy.ts";

export type ThreeRendererEvents = RendererEvents;

export interface ThreeRendererOptions {
  /**
   * @default "direct"
   */
  renderMode: RenderMode;
  sceneManager: SceneContract;
}

export class ThreeRenderer extends EventEmitter<
  ThreeRendererEvents
> implements Renderer {
  webGLRenderer: THREE.WebGLRenderer;
  renderComponents: RenderComponent[] = [];
  renderStrategy: RenderStrategy;
  ratio: number | null = null;
  sceneManager: SceneContract;

  #resizeObserver: ResizeObserver | null = null;
  #pendingResizeWidth = 0;
  #pendingResizeHeight = 0;
  #resizeDirty = true;

  constructor(
    canvas: HTMLCanvasElement,
    options: ThreeRendererOptions
  ) {
    super();
    const { sceneManager, renderMode = "direct" } = options;

    this.sceneManager = sceneManager;
    this.webGLRenderer = createWebGLRenderer(canvas);
    this.setRenderMode(renderMode);
  }

  get canvas() {
    return this.webGLRenderer.domElement;
  }

  getSource() {
    return this.webGLRenderer;
  }

  addRenderComponent(
    component: RenderComponent
  ): void {
    this.renderComponents.push(component);
    if (this.renderStrategy instanceof ComposerRenderStrategy) {
      const renderPass = new RenderPass(this.sceneManager.getSource(), component);
      this.renderStrategy.addEffect(renderPass);
    }
  }

  removeRenderComponent(
    component: RenderComponent
  ): void {
    const index = this.renderComponents.indexOf(component);
    if (index !== -1) {
      this.renderComponents.splice(index, 1);
    }

    if (this.renderStrategy instanceof ComposerRenderStrategy) {
      const composer = this.renderStrategy.getComposer();
      const renderPass = composer.passes.find(
        (pass) => (pass as RenderPass).camera === component
      )!;
      this.renderStrategy.removeEffect(renderPass);
    }
  }

  setRenderMode(
    mode: RenderMode
  ): this {
    if (mode === "direct") {
      this.renderStrategy = new DirectRenderStrategy(this.webGLRenderer);
    }
    else {
      const composer = new EffectComposer(this.webGLRenderer);

      const scene = this.sceneManager.getSource();
      for (const renderComponent of this.renderComponents) {
        const renderPass = new RenderPass(scene, renderComponent);
        composer.addPass(renderPass);
      }

      this.renderStrategy = new ComposerRenderStrategy(
        composer
      );
    }
    this.resize();
    this.clear();

    return this;
  }

  setEffects(...effects: Pass[]): this {
    if (this.renderStrategy instanceof ComposerRenderStrategy) {
      for (const pass of effects) {
        this.renderStrategy.addEffect(pass);
      }
    }

    return this;
  }

  setRatio(
    ratio: number | null = null
  ) {
    this.ratio = ratio;

    const styles = this.ratio ?
      { margin: "0", flex: "1" } :
      { margin: "auto", flex: "none" };
    Object.assign(this.webGLRenderer.domElement.style, styles);
    this.resize();

    return this;
  }

  observeResize() {
    if (this.#resizeObserver) {
      return;
    }

    const target = this.ratio ?
      document.body :
      this.webGLRenderer.domElement.parentElement ?? this.webGLRenderer.domElement;

    this.#resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      if (this.ratio) {
        if (width / height > this.ratio) {
          this.#pendingResizeHeight = Math.round(height);
          this.#pendingResizeWidth = Math.round(Math.min(width, height * this.ratio));
        }
        else {
          this.#pendingResizeWidth = Math.round(width);
          this.#pendingResizeHeight = Math.round(Math.min(height, width / this.ratio));
        }
      }
      else {
        this.#pendingResizeWidth = Math.round(width);
        this.#pendingResizeHeight = Math.round(height);
      }
      this.#resizeDirty = true;
    });
    this.#resizeObserver.observe(target);
  }

  unobserveResize() {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }
  }

  resize = () => {
    if (!this.#resizeDirty) {
      return;
    }
    this.#resizeDirty = false;

    const width = this.#pendingResizeWidth;
    const height = this.#pendingResizeHeight;
    if (width === 0 || height === 0) {
      return;
    }

    this.renderStrategy.resize(width, height);
    for (const renderComponent of this.renderComponents) {
      if (renderComponent instanceof THREE.PerspectiveCamera) {
        renderComponent.aspect = width / height;
      }
      if (renderComponent instanceof THREE.OrthographicCamera) {
        renderComponent.left = width / -2;
        renderComponent.right = width / 2;
        renderComponent.top = height / 2;
        renderComponent.bottom = height / -2;
      }
      renderComponent.updateProjectionMatrix();
    }
    this.emit("resize", { width, height });
  };

  draw() {
    this.resize();
    this.clear();

    this.renderStrategy.render(
      this.sceneManager.getSource(),
      this.renderComponents
    );
    this.emit("draw", { source: this.webGLRenderer });
  }

  onDraw(
    callback: (event: { source: THREE.WebGLRenderer; }) => void
  ) {
    this.on("draw", callback);
  }

  clear() {
    this.webGLRenderer.clear();
  }
}

function createWebGLRenderer(
  canvas: HTMLCanvasElement
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.setSize(0, 0, false);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.25;

  return renderer;
}
