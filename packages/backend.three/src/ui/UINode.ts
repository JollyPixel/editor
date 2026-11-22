// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  type Actor,
  ActorComponent,
  type Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  UILayout,
  type UINodeOptions
} from "./UILayout.ts";

export class UINode<TContext = Systems.WorldDefaultContext> extends ActorComponent<TContext> {
  readonly layout: UILayout;

  constructor(
    actor: Actor<TContext>,
    options: UINodeOptions = {}
  ) {
    super({ actor, typeName: "UINode" });
    this.layout = new UILayout(options);

    const { renderer } = this.actor.world;
    const onResize = () => this.updateToWorldPosition();
    this.updateToWorldPosition();
    renderer.on("resize", onResize);
    this.addTeardown(() => renderer.off("resize", onResize));
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

    this.actor.transform.local.position = {
      x,
      y,
      z: 0
    };
  }
}
