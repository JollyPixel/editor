// Import Third-party Dependencies
import {
  Actor,
  Behavior,
  type BehaviorProperties,
  Renderers
} from "@jolly-pixel/engine";

export interface PlayerBehaviorProperties extends BehaviorProperties {
  speed: number;
}

export class PlayerBehavior extends Behavior<PlayerBehaviorProperties> {
  model: Renderers.ModelRenderer;

  constructor(
    actor: Actor
  ) {
    super(actor);

    this.model = this.actor.registerComponentAndGet(Renderers.ModelRenderer, {
      path: "models/Standard.fbx",
      animations: {
        default: "idle_loop",
        clipNameRewriter: (name) => name.slice(name.indexOf("|") + 1).toLowerCase()
      }
    });
    this.mergeProperties({
      speed: 0.05
    });
  }

  awake() {
    this.actor.threeObject.rotateX(-90 * (Math.PI / 180));
    this.actor.threeObject.position.set(2, 0, 0);
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
