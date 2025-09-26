// Import Third-party Dependencies
import {
  Behavior,
  type BehaviorProperties,
  Renderers
} from "@jolly-pixel/engine";

export interface PlayerBehaviorProperties extends BehaviorProperties {
  speed: number;
}

export class PlayerBehavior extends Behavior<PlayerBehaviorProperties> {
  model = new Renderers.ModelRenderer(this.actor, {
    path: "models/Standard.fbx",
    animations: {
      default: "idle_loop",
      clipNameRewriter: (name) => name.slice(name.indexOf("|") + 1).toLowerCase()
    }
  });

  awake() {
    this.actor.threeObject.rotateX(-Math.PI / 2);
    this.model.animation.setFadeDuration(0.25);
  }

  update() {
    const { input } = this.actor.gameInstance;
    const speed = this.getProperty("speed", 0.05);

    if (input.isKeyDown("ArrowUp")) {
      this.actor.threeObject.position.z += speed;
      this.model.animation.play("walk_loop");
    }
    else if (input.isKeyDown("ArrowDown")) {
      this.actor.threeObject.position.z -= speed;
      this.model.animation.play("walk_loop");
    }
    else if (input.isMouseButtonDown("left")) {
      this.model.animation.play("punch_jab");
    }
    else {
      this.model.animation.play("idle_loop");
    }
  }
}
