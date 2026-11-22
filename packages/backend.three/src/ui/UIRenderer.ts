// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { CSS2DRenderer as ThreeCSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  type Actor,
  ActorComponent,
  type Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { ThreeRenderComponent } from "../rendering/ThreeRenderComponent.ts";

// CONSTANTS
const kRenderDepth = 10;
const kDefaultZIndex = 10;

export interface UIRendererOptions {
  near?: number;
  far?: number;
  zIndex?: number;
}

export class UIRenderer<
  TContext = Systems.WorldDefaultContext
> extends ActorComponent<TContext> {
  readonly camera: THREE.OrthographicCamera;

  #renderComponent: ThreeRenderComponent;
  #cssRenderer = new ThreeCSS2DRenderer();

  constructor(
    actor: Actor<TContext>,
    options: UIRendererOptions = {}
  ) {
    super({ actor, typeName: "UIRenderer" });

    const {
      near = 0.1,
      far = 2000,
      zIndex = kDefaultZIndex
    } = options;
    const { world } = actor;
    const { bounds } = world.input.screen;

    this.camera = new THREE.OrthographicCamera(
      bounds.left,
      bounds.right,
      bounds.top,
      bounds.bottom,
      near,
      far
    );
    this.camera.position.z = zIndex;
    this.actor.node.object3D.add(this.camera);

    const { style } = this.#cssRenderer.domElement;
    style.position = "absolute";
    style.top = "0";
    style.left = "0";
    style.pointerEvents = "none";
    world.renderer.canvas.parentElement?.appendChild(this.#cssRenderer.domElement);
    this.#fitOverlay();

    this.#renderComponent = {
      threeCamera: this.camera,
      depth: kRenderDepth,
      viewport: null,
      prepareRender: () => void 0
    };
    world.renderer.addRenderComponent(this.#renderComponent);
    world.renderer.on("resize", this.#fitOverlay);
    world.renderer.on("draw", this.#draw);

    this.addTeardown(() => {
      world.renderer.removeRenderComponent(this.#renderComponent);
      world.renderer.off("resize", this.#fitOverlay);
      world.renderer.off("draw", this.#draw);
      this.#cssRenderer.domElement.remove();
    });
  }

  readonly #fitOverlay = (): void => {
    const { width, height } = this.actor.world.renderer.canvas
      .getBoundingClientRect();
    this.#cssRenderer.setSize(width, height);
  };

  readonly #draw = (): void => {
    const { scene } = this.actor.world.sceneManager.graph;
    this.#cssRenderer.render(scene, this.camera);
  };
}
