// Import Third-party Dependencies
import {
  Behavior,
  type BehaviorProperties,
  ModelRenderer,
  Input,
  type InputDevicePreference,
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

  @Input.listen("input.devicePreferenceChange")
  onInputEvent(
    preference: InputDevicePreference
  ) {
    console.log("Input event detected in PlayerBehavior: ", preference);
  }

  @Input.listen("gamepad.connect")
  onGamepadConnect() {
    console.log("Gamepad connected!");
  }

  awake() {
    console.log({
      isTouchpadAvailable: this.actor.gameInstance.input.isTouchpadAvailable()
    });
    this.actor.threeObject.rotateX(-Math.PI / 2);

    this.model.animation.setClipNameRewriter((name) => name.slice(name.indexOf("|") + 1).toLowerCase());
    this.model.animation.play("idle_loop");
    this.model.animation.setFadeDuration(0.25);
  }

  update() {
    const { input } = this.actor.gameInstance;

    if (input.isTouchDown("primary")) {
      console.log("Primary touch is down!");
    }

    if (input.wasGamepadButtonJustPressed(0, "DPadUp")) {
      console.log("Gamepad 0 button DPadUp is up!");
    }

    if (input.wasGamepadAxisJustPressed(0, "LeftStickY", { positive: true })) {
      console.log("Gamepad 0 axis LeftStickY was just pressed!");
    }

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
