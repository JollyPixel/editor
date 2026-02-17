// Import Third-party Dependencies
import * as THREE from "three";
import { CSS2DRenderer as ThreeCSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

// Import Internal Dependencies
import type { GameInstanceDefaultContext } from "../systems/GameInstance.ts";
import type { UINode } from "./UINode.ts";
import { type Actor, ActorComponent } from "../actor/index.ts";
import { UIRendererID } from "./common.ts";

// CONSTANTS
const kOrthographicCameraZIndex = 10;

export interface UIRendererOptions {
  near?: number;
  far?: number;
  zIndex?: number;
}

export class UIRenderer<
  TContext = GameInstanceDefaultContext
> extends ActorComponent<TContext> {
  camera: THREE.OrthographicCamera;
  nodes: UINode<TContext>[] = [];

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
    const { gameInstance } = actor;

    const screenBounds = gameInstance.input.getScreenBounds();

    this.camera = new THREE.OrthographicCamera(
      screenBounds.left,
      screenBounds.right,
      screenBounds.top,
      screenBounds.bottom,
      near,
      far
    );
    this.camera.position.z = zIndex;
    this.actor.threeObject.add(this.camera);

    this.#cssRenderer = new ThreeCSS2DRenderer();
    this.#cssRenderer.domElement.style.position = "absolute";
    this.#cssRenderer.domElement.style.top = "0";
    this.#cssRenderer.domElement.style.left = "0";
    this.#cssRenderer.domElement.style.pointerEvents = "none";

    const canvas = gameInstance.renderer.canvas;
    canvas.parentElement?.appendChild(this.#cssRenderer.domElement);

    const { width, height } = canvas.getBoundingClientRect();
    this.#cssRenderer.setSize(width, height);

    gameInstance.renderer.addRenderComponent(this.camera);

    this.#boundResize = this.#onResize.bind(this);
    this.#boundDraw = this.#onDraw.bind(this);
    gameInstance.renderer.on("resize", this.#boundResize);
    gameInstance.renderer.on("draw", this.#boundDraw);

    Object.defineProperty(gameInstance, UIRendererID, {
      value: this,
      enumerable: false
    });
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
    const canvas = this.actor.gameInstance.renderer.canvas;
    const { width, height } = canvas.getBoundingClientRect();
    this.#cssRenderer.setSize(width, height);

    this.updateWorldPosition();
  }

  #onDraw(): void {
    const scene = this.actor.gameInstance.scene.getSource();
    this.#cssRenderer.render(scene, this.camera);
  }

  clear(): void {
    for (const node of this.nodes) {
      node.destroy();
    }
    this.nodes = [];

    const { gameInstance } = this.actor;
    gameInstance.renderer.removeRenderComponent(this.camera);
    gameInstance.renderer.off("resize", this.#boundResize);
    gameInstance.renderer.off("draw", this.#boundDraw);

    this.#cssRenderer.domElement.remove();

    gameInstance[UIRendererID] = undefined;
  }
}
