// Import Third-party Dependencies
import * as THREE from "three";
import { CSS2DRenderer as ThreeCSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

// Import Internal Dependencies
import type { WorldDefaultContext } from "../systems/World.ts";
import type { UINode } from "./UINode.ts";
import { type Actor, ActorComponent } from "../actor/index.ts";
import { UIRendererID } from "./common.ts";
import type { RenderComponent } from "../systems/rendering/Renderer.ts";

// CONSTANTS
const kOrthographicCameraZIndex = 10;

export interface UIRendererOptions {
  near?: number;
  far?: number;
  zIndex?: number;
}

export class UIRenderer<
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> {
  static ID = UIRendererID;

  camera: THREE.OrthographicCamera;
  nodes: UINode<TContext>[] = [];

  #renderComponent: RenderComponent;
  #cssRenderer: ThreeCSS2DRenderer;
  #boundDraw: () => void;
  #boundResize: () => void;

  constructor(
    actor: Actor<TContext>,
    options: UIRendererOptions = {}
  ) {
    super({ actor, typeName: "UIRenderer" });

    const {
      near = 0.1,
      far = 2000,
      zIndex = kOrthographicCameraZIndex
    } = options;
    const { world } = actor;

    const screenBounds = world.input.getScreenBounds();

    this.camera = new THREE.OrthographicCamera(
      screenBounds.left,
      screenBounds.right,
      screenBounds.top,
      screenBounds.bottom,
      near,
      far
    );
    this.camera.position.z = zIndex;
    this.actor.object3D.add(this.camera);

    this.#cssRenderer = new ThreeCSS2DRenderer();
    this.#cssRenderer.domElement.style.position = "absolute";
    this.#cssRenderer.domElement.style.top = "0";
    this.#cssRenderer.domElement.style.left = "0";
    this.#cssRenderer.domElement.style.pointerEvents = "none";

    const canvas = world.renderer.canvas;
    canvas.parentElement?.appendChild(this.#cssRenderer.domElement);

    const { width, height } = canvas.getBoundingClientRect();
    this.#cssRenderer.setSize(width, height);

    const camera = this.camera;
    this.#renderComponent = {
      threeCamera: camera,
      depth: kOrthographicCameraZIndex,
      viewport: null,
      prepareRender: () => {
        // Sync camera world transform from actor's scene graph
      }
    };
    world.renderer.addRenderComponent(this.#renderComponent);

    this.#boundResize = this.#onResize.bind(this);
    this.#boundDraw = this.#onDraw.bind(this);
    world.renderer.on("resize", this.#boundResize);
    world.renderer.on("draw", this.#boundDraw);

    world[UIRendererID] = this;
  }

  addChildren(
    node: UINode<TContext>
  ): void {
    const nodeIndex = this.nodes.indexOf(node);
    if (nodeIndex !== -1) {
      return;
    }

    node.updateToWorldPosition();
    this.nodes.push(node);
  }

  updateWorldPosition(): void {
    for (const node of this.nodes) {
      node.updateToWorldPosition();
    }
  }

  #onResize(): void {
    const canvas = this.actor.world.renderer.canvas;
    const { width, height } = canvas.getBoundingClientRect();
    this.#cssRenderer.setSize(width, height);

    this.updateWorldPosition();
  }

  #onDraw(): void {
    const scene = this.actor.world.sceneManager.getSource();
    this.#cssRenderer.render(scene, this.camera);
  }

  clear(): void {
    for (const node of this.nodes) {
      node.destroy();
    }
    this.nodes = [];

    const { world } = this.actor;
    world.renderer.removeRenderComponent(this.#renderComponent);
    world.renderer.off("resize", this.#boundResize);
    world.renderer.off("draw", this.#boundDraw);

    this.#cssRenderer.domElement.remove();

    world[UIRendererID] = undefined;
  }
}
