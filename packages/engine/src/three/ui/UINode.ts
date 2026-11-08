// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { WorldDefaultContext } from "../../core/systems/World.ts";
import { UIRenderer } from "./UIRenderer.ts";
import { type Actor, ActorComponent } from "../../core/actor/index.ts";
import {
  UILayout,
  type UINodeOptions
} from "./UILayout.ts";

export class UINode<TContext = WorldDefaultContext> extends ActorComponent<TContext> {
  readonly layout: UILayout;

  constructor(
    actor: Actor<TContext>,
    options: UINodeOptions = {}
  ) {
    super({ actor, typeName: "UINode" });
    this.layout = new UILayout(options);

    const { world } = this.actor;
    const uiRenderer = UIRenderer.for(world);
    if (uiRenderer) {
      uiRenderer.addChildren(this);
      this.addTeardown(() => uiRenderer.removeChildren(this));
    }
    else {
      const onResize = () => this.updateToWorldPosition();
      this.updateToWorldPosition();
      world.renderer.on("resize", onResize);
      this.addTeardown(() => world.renderer.off("resize", onResize));
    }
  }

  addChildren(
    object: THREE.Object3D
  ): void {
    this.actor.node.object3D.add(object);
  }

  updateToWorldPosition(): void {
    const { x, y } = this.layout.position(
      this.actor.world.input.screen.bounds
    );

    this.actor.transform.setLocalPosition({
      x,
      y,
      z: 0
    });
  }
}
