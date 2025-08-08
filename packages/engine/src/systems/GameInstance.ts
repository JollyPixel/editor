// Import Third-party Dependencies
import * as THREE from "three";
import { Timer } from "three/addons/misc/Timer.js";

// Import Internal Dependencies
import { Input } from "../controls/Input.class.js";
import { Actor } from "../Actor.js";
import { ActorTree } from "../ActorTree.js";
import { ActorComponent, type Component } from "../ActorComponent.js";
import {
  GameInstanceDefaultLoader,
  type LoaderProvider
} from "./Loader.js";

export interface GameInstanceOptions {
  enableOnExit?: boolean;
  loader?: LoaderProvider;
  threeRendererProvider?: typeof THREE.WebGLRenderer;
}

export class GameInstance extends EventTarget {
  framesPerSecond = 60;
  ratio: number | null = null;

  tree = new ActorTree({
    addCallback: (actor) => this.threeScene.add(actor.threeObject),
    removeCallback: (actor) => this.threeScene.remove(actor.threeObject)
  });
  cachedActors: Actor[] = [];

  renderComponents: (THREE.PerspectiveCamera | THREE.OrthographicCamera)[] = [];
  componentsToBeStarted: Component[] = [];
  componentsToBeDestroyed: Component[] = [];

  input: Input;
  audio = {
    listener: new THREE.AudioListener(),
    globalVolume: 1
  };
  clock = new Timer();

  threeRenderer: THREE.WebGLRenderer;
  threeScene = new THREE.Scene();

  loader: LoaderProvider;

  skipRendering = false;

  constructor(
    canvas: HTMLCanvasElement,
    options: GameInstanceOptions = {}
  ) {
    super();
    const { threeRendererProvider = THREE.WebGLRenderer } = options;
    globalThis.game = this;

    if (options.loader) {
      this.loader = options.loader;
    }
    else {
      this.loader = new GameInstanceDefaultLoader();
    }

    this.tree.addEventListener("SkipRendering", () => {
      this.skipRendering = true;
    });
    this.threeRenderer = new threeRendererProvider({
      canvas,
      antialias: true,
      alpha: true
    });

    this.threeRenderer.setPixelRatio(window.devicePixelRatio);
    this.threeRenderer.shadowMap.enabled = true;
    this.threeRenderer.shadowMap.type = THREE.BasicShadowMap;
    this.threeRenderer.setSize(0, 0, false);
    this.threeRenderer.autoClear = false;

    this.input = new Input(this.threeRenderer.domElement, {
      enableOnExit: options.enableOnExit
    });
  }

  connect() {
    this.input.connect();
    window.addEventListener("resize", this.resizeRenderer);

    /**
     * We need to refactor that using a Scene loader
     */
    for (const { actor } of this.tree.walk()) {
      if (!actor.awoken) {
        actor.awake();
        actor.awoken = true;
      }
    }

    return this;
  }

  disconnect() {
    this.input.disconnect();
    window.removeEventListener("resize", this.resizeRenderer);

    return this;
  }

  tick(
    accumulatedTime: number,
    callback?: Function
  ): { updates: number; timeLeft: number; } {
    this.clock.update();

    const updateInterval = 1 / this.framesPerSecond * 1000;
    let newAccumulatedTime = accumulatedTime;

    // Limit how many update()s to try and catch up,
    // to avoid falling into the "black pit of despair" aka "doom spiral".
    // where every tick takes longer than the previous one.
    // See http://blogs.msdn.com/b/shawnhar/archive/2011/03/25/technical-term-that-should-exist-quot-black-pit-of-despair-quot.aspx
    const maxAccumulatedUpdates = 5;

    const maxAccumulatedTime = maxAccumulatedUpdates * updateInterval;
    if (newAccumulatedTime > maxAccumulatedTime) {
      newAccumulatedTime = maxAccumulatedTime;
    }

    // Update
    let updates = 0;
    while (newAccumulatedTime >= updateInterval) {
      this.update();
      callback?.();
      if (this.input.exited) {
        break;
      }
      newAccumulatedTime -= updateInterval;
      updates++;
    }

    return { updates, timeLeft: newAccumulatedTime };
  }

  update() {
    this.input.update();

    this.cachedActors.length = 0;
    for (const { actor } of this.tree.walk()) {
      this.cachedActors.push(actor);
    }

    for (let i = 0; i < this.componentsToBeStarted.length; i++) {
      const component = this.componentsToBeStarted[i];

      // If the component to be started is part of an actor
      // which will not be updated, skip it until next loop
      if (this.cachedActors.indexOf(component.actor) === -1) {
        i++;
        continue;
      }

      component.start?.();
      this.componentsToBeStarted.splice(i, 1);
    }

    // Update all actors
    this.cachedActors.forEach((actor) => {
      actor.update();
    });

    // Apply pending component / actor destructions
    this.componentsToBeDestroyed.forEach((component) => {
      component.destroy();
    });
    this.componentsToBeDestroyed.length = 0;

    this.tree.actorsToBeDestroyed.forEach((actor) => {
      this.#doActorDestruction(actor);
    });
    this.tree.actorsToBeDestroyed.length = 0;

    if (this.input.exited) {
      this.threeRenderer.clear();

      return;
    }
    if (this.skipRendering) {
      this.skipRendering = false;
      this.update();

      return;
    }
  }

  setRatio(
    ratio: number | null = null
  ) {
    this.ratio = ratio;
    if (this.ratio) {
      this.threeRenderer.domElement.style.margin = "0";
      this.threeRenderer.domElement.style.flex = "1";
    }
    else {
      this.threeRenderer.domElement.style.margin = "auto";
      this.threeRenderer.domElement.style.flex = "none";
    }
    this.resizeRenderer();

    return this;
  }

  private resizeRenderer = () => {
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
      const parent = this.threeRenderer.domElement.parentElement;
      if (parent) {
        width = parent.clientWidth;
        height = parent.clientHeight;
      }
      else {
        width = this.threeRenderer.domElement.clientWidth;
        height = this.threeRenderer.domElement.clientHeight;
      }
    }

    if (
      this.threeRenderer.domElement.width !== width ||
      this.threeRenderer.domElement.height !== height
    ) {
      this.threeRenderer.setSize(width, height, false);
      for (const renderComponent of this.renderComponents) {
        if (renderComponent instanceof THREE.PerspectiveCamera) {
          renderComponent.aspect = width / height;
        }
        renderComponent.updateProjectionMatrix();
      }
      this.dispatchEvent(new CustomEvent("resize", {
        detail: { width, height }
      }));
    }
  };

  draw() {
    this.resizeRenderer();

    this.threeRenderer.clear();
    // this.renderComponents.sort((a, b) => {
    //   let order = (a.depth - b.depth);
    //   if (order === 0) {
    //     order = this.cachedActors.indexOf(a.actor) - this.cachedActors.indexOf(b.actor);
    //   }

    //   return order;
    // });

    for (const renderComponent of this.renderComponents) {
      this.threeRenderer.render(this.threeScene, renderComponent);
    }
    this.dispatchEvent(new CustomEvent("draw"));
  }

  destroyComponent(
    component: ActorComponent
  ) {
    if (component.pendingForDestruction) {
      return;
    }

    this.componentsToBeDestroyed.push(component);
    component.pendingForDestruction = true;

    const index = this.componentsToBeStarted.indexOf(component);
    if (index !== -1) {
      this.componentsToBeStarted.splice(index, 1);
    }
  }

  #doActorDestruction(
    actor: Actor
  ) {
    while (actor.children.length > 0) {
      this.#doActorDestruction(actor.children[0]);
    }

    const cachedIndex = this.cachedActors.indexOf(actor);
    if (cachedIndex !== -1) {
      this.cachedActors.splice(cachedIndex, 1);
    }

    actor.destroy();
  }
}
