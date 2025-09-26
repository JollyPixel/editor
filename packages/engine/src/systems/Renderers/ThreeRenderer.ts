// Import Third-party Dependencies
import * as THREE from "three";
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import type {
  GameRenderer,
  RenderComponent
} from "./GameRenderer.js";
import type { Scene } from "../Scene.js";

export type ThreeRendererEvents = {
  resize: [
    { width: number; height: number; }
  ];
  draw: [
    { source: THREE.WebGLRenderer; }
  ];
};

export class ThreeRenderer extends EventEmitter<
  ThreeRendererEvents
> implements GameRenderer {
  webGLRenderer: THREE.WebGLRenderer;
  renderComponents: RenderComponent[] = [];
  ratio: number | null = null;

  constructor(
    canvas: HTMLCanvasElement
  ) {
    super();
    this.webGLRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });

    this.webGLRenderer.setPixelRatio(window.devicePixelRatio);
    this.webGLRenderer.shadowMap.enabled = true;
    this.webGLRenderer.shadowMap.type = THREE.BasicShadowMap;
    this.webGLRenderer.setSize(0, 0, false);
    this.webGLRenderer.autoClear = false;
  }

  get canvas() {
    return this.webGLRenderer.domElement;
  }

  getSource() {
    return this.webGLRenderer;
  }

  addRenderComponent(component: RenderComponent): void {
    this.renderComponents.push(component);
  }

  removeRenderComponent(component: RenderComponent): void {
    const index = this.renderComponents.indexOf(component);
    if (index !== -1) {
      this.renderComponents.splice(index, 1);
    }
  }

  setRatio(
    ratio: number | null = null
  ) {
    this.ratio = ratio;
    if (this.ratio) {
      this.webGLRenderer.domElement.style.margin = "0";
      this.webGLRenderer.domElement.style.flex = "1";
    }
    else {
      this.webGLRenderer.domElement.style.margin = "auto";
      this.webGLRenderer.domElement.style.flex = "none";
    }
    this.resize();

    return this;
  }

  resize = () => {
    let width: number;
    let height: number;
    if (this.ratio) {
      if (document.body.clientWidth / document.body.clientHeight > this.ratio) {
        height = document.body.clientHeight;
        width = Math.min(document.body.clientWidth, height * this.ratio);
      }
      else {
        width = document.body.clientWidth;
        height = Math.min(document.body.clientHeight, width / this.ratio);
      }
    }
    else {
      const parent = this.webGLRenderer.domElement.parentElement;
      if (parent) {
        width = parent.clientWidth;
        height = parent.clientHeight;
      }
      else {
        width = this.webGLRenderer.domElement.clientWidth;
        height = this.webGLRenderer.domElement.clientHeight;
      }
    }

    if (
      this.webGLRenderer.domElement.width !== width ||
      this.webGLRenderer.domElement.height !== height
    ) {
      this.webGLRenderer.setSize(width, height, false);
      for (const renderComponent of this.renderComponents) {
        if (renderComponent instanceof THREE.PerspectiveCamera) {
          renderComponent.aspect = width / height;
        }
        renderComponent.updateProjectionMatrix();
      }
      this.emit("resize", { width, height });
    }
  };

  draw(
    scene: Scene
  ) {
    this.resize();
    this.clear();
    // this.renderComponents.sort((a, b) => {
    //   let order = (a.depth - b.depth);
    //   if (order === 0) {
    //     order = this.cachedActors.indexOf(a.actor) - this.cachedActors.indexOf(b.actor);
    //   }

    //   return order;
    // });

    const source = scene.getSource();
    for (const renderComponent of this.renderComponents) {
      this.webGLRenderer.render(source, renderComponent);
    }
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
