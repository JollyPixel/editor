// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { InputKeyboardAction } from "../../controls/types.ts";
import type { MouseEventButton } from "../../controls/Input.class.ts";
import { Actor } from "../../actor/Actor.ts";
import { CameraComponent, type CameraOptions } from "./Camera.ts";

export interface Camera3DControlsOptions extends CameraOptions {
  bindings?: {
    forward?: InputKeyboardAction;
    backward?: InputKeyboardAction;
    left?: InputKeyboardAction;
    right?: InputKeyboardAction;
    up?: InputKeyboardAction;
    down?: InputKeyboardAction;
    lookAround?: Exclude<
      keyof typeof MouseEventButton,
      "scrollUp" | "scrollDown"
    >;
  };
  maxRollUp?: number;
  maxRollDown?: number;
  rotationSpeed?: number;
  speed?: number;
}

export class Camera3DControls extends CameraComponent<any> {
  #bindings: Required<NonNullable<Camera3DControlsOptions["bindings"]>>;

  maxRollUp: number;
  maxRollDown: number;
  #rotationSpeed: number;
  #movementSpeed: number;

  constructor(
    actor: Actor<any>,
    options: Camera3DControlsOptions = {}
  ) {
    super(actor, {
      addAudioListener: true
    });

    const {
      bindings,
      maxRollUp = Math.PI / 2,
      maxRollDown = -Math.PI / 2,
      rotationSpeed = 1,
      speed = 7.5
    } = options;

    this.#bindings = {
      forward: bindings?.forward ?? "KeyW",
      backward: bindings?.backward ?? "KeyS",
      left: bindings?.left ?? "KeyA",
      right: bindings?.right ?? "KeyD",
      up: bindings?.up ?? "Space",
      down: bindings?.down ?? "ShiftLeft",
      lookAround: bindings?.lookAround ?? "middle"
    };

    this.maxRollUp = maxRollUp;
    this.maxRollDown = maxRollDown;
    this.#rotationSpeed = rotationSpeed;
    this.#movementSpeed = speed;
  }

  get camera(): THREE.PerspectiveCamera {
    return this.threeCamera as THREE.PerspectiveCamera;
  }

  override awake(): void {
    super.awake();
    this.needUpdate = true;
  }

  set speed(
    speed: number
  ) {
    this.#movementSpeed = THREE.MathUtils.clamp(speed, 0.1, Infinity);
  }

  set rollSpeed(
    speed: number
  ) {
    this.#rotationSpeed = THREE.MathUtils.clamp(speed, 0.1, Infinity);
  }

  #rotate() {
    const mouseDelta = this.actor.world.input.getMouseDelta(
      true
    );
    const euler = new THREE.Euler(0, 0, 0, "YXZ");

    euler.setFromQuaternion(this.camera.quaternion);
    euler.y -= mouseDelta.x * this.#rotationSpeed;
    euler.x += mouseDelta.y * this.#rotationSpeed;
    euler.x = Math.max(this.maxRollDown, Math.min(this.maxRollUp, euler.x));

    this.camera.quaternion.setFromEuler(euler);
  }

  update(
    deltaTime: number
  ) {
    const { input } = this.actor.world;

    const vector = new THREE.Vector3(0);
    if (input.isKeyDown(this.#bindings.forward)) {
      vector.z -= 1;
    }
    if (input.isKeyDown(this.#bindings.backward)) {
      vector.z += 1;
    }

    if (input.isKeyDown(this.#bindings.up)) {
      vector.y += 1;
    }
    if (input.isKeyDown(this.#bindings.down)) {
      vector.y -= 1;
    }

    if (input.isKeyDown(this.#bindings.right)) {
      vector.x += 1;
    }
    if (input.isKeyDown(this.#bindings.left)) {
      vector.x -= 1;
    }

    const translation = new THREE.Vector3(vector.x, 0, vector.z);
    this.camera.translateOnAxis(
      translation.normalize(),
      this.#movementSpeed * deltaTime
    );
    this.camera.position.y += vector.y * this.#movementSpeed * deltaTime;

    if (input.isMouseButtonDown(this.#bindings.lookAround)) {
      // input.mouse.lock();
      this.#rotate();
    }
    else if (input.wasMouseButtonJustReleased(this.#bindings.lookAround)) {
      // input.mouse.unlock();
    }
  }
}
