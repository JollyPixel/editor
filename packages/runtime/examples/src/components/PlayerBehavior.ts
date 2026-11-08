// Import Third-party Dependencies
import {
  Behavior,
  ModelRenderer,
  type InputDevicePreference,
  SceneProperty,
  SceneActorComponent,
  InputListener,
  SignalEvent
} from "@jolly-pixel/engine";
import * as THREE from "three";

export class PlayerBehavior extends Behavior {
  onPlayerPunch = new SignalEvent();

  @SceneProperty({ type: "number" })
  speed = 0.05;

  @SceneActorComponent(ModelRenderer)
  model: ModelRenderer;

  @InputListener("input.devicePreferenceChange")
  onInputEvent(
    preference: InputDevicePreference
  ) {
    console.log("Input event detected in PlayerBehavior: ", preference);
  }

  @InputListener("gamepad.connect")
  onGamepadConnect() {
    console.log("Gamepad connected!");
  }

  awake() {
    this.actor.transform.rotateLocalEulerAngles(
      new THREE.Euler(-Math.PI / 2, 0, 0)
    );
  }

  start() {
    this.model.animation.setClipNameRewriter(
      (name) => name.slice(name.indexOf("|") + 1).toLowerCase()
    );
    this.model.animation.play("idle_loop");
    this.model.animation.setFadeDuration(0.25);
  }

  update() {
    const { input } = this.actor.world;

    if (input.touchpad.isDown("primary")) {
      console.log("Primary touch is down!");
    }

    if (input.gamepad.wasButtonJustPressed(0, "DPadUp")) {
      console.log("Gamepad 0 button DPadUp is up!");
    }

    if (input.gamepad.wasAxisJustPressed(0, "LeftStickY", { positive: true })) {
      console.log("Gamepad 0 axis LeftStickY was just pressed!");
    }

    if (input.keyboard.isDown("ArrowUp")) {
      this.actor.transform.moveLocal({ x: 0, y: 0, z: this.speed });
      this.model.animation.play("walk_loop");
    }
    else if (input.keyboard.isDown("ArrowDown")) {
      this.actor.transform.moveLocal({ x: 0, y: 0, z: -this.speed });
      this.model.animation.play("walk_loop");
    }
    else if (input.mouse.isDown("left")) {
      this.model.animation.play("punch_jab");
      this.onPlayerPunch.emit();
    }
    else {
      this.model.animation.play("idle_loop");
    }
  }
}
