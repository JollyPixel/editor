// Import Third-party Dependencies
import {
  Behavior,
  type BehaviorProperties,
  ModelRenderer,
  Input,
  SceneProperty,
  SceneActorComponent
} from "@jolly-pixel/engine";

export interface PlayerProperties extends BehaviorProperties {
  speed: number;
}

export class PlayerBehavior extends Behavior<PlayerProperties> {
  @SceneProperty({ type: "number" })
  speed = 0.05;

  @SceneActorComponent(ModelRenderer)
  model: ModelRenderer;

  @Input.listen("mouse.down")
  @Input.listen("keyboard.Enter")
  onInputEvent(
    event: MouseEvent | KeyboardEvent
  ) {
    console.log("Input event detected in PlayerBehavior: ", event);
  }

  awake() {
    this.actor.threeObject.rotateX(-Math.PI / 2);

    this.model.animation.setClipNameRewriter((name) => name.slice(name.indexOf("|") + 1).toLowerCase());
    this.model.animation.play("idle_loop");
    this.model.animation.setFadeDuration(0.25);
  }

  update() {
    const { input } = this.actor.gameInstance;

    if (input.isKeyDown("ArrowUp")) {
      this.actor.threeObject.position.z += this.speed;
      this.model.animation.play("walk_loop");
    }
    else if (input.isKeyDown("ArrowDown")) {
      this.actor.threeObject.position.z -= this.speed;
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
