// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Axis,
  AxisMap,
  type InputKeyboardAction,
  type MouseEventButton
} from "@jolly-pixel/controls";

// Import Internal Dependencies
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

type Camera3DControlsAxis =
  | "moveX"
  | "moveY"
  | "moveZ";

export class Camera3DControls extends CameraComponent<any> {
  #bindings: Required<NonNullable<Camera3DControlsOptions["bindings"]>>;
  #axes: AxisMap<Camera3DControlsAxis>;

  maxRollUp: number;
  maxRollDown: number;
  #rotationSpeed: number;
  #movementSpeed: number;

  // Reused each frame — avoid allocations.
  #orientation = new THREE.Quaternion();
  #euler = new THREE.Euler(0, 0, 0, "YXZ");
  #direction = new THREE.Vector3();
  #translation = new THREE.Vector3();

  constructor(
    actor: Actor<any>,
    options: Camera3DControlsOptions = {}
  ) {
    super(actor, {
      ...options,
      addAudioListener: options.addAudioListener ?? true
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

    this.#axes = new AxisMap({
      moveX: Axis.buttons(this.#bindings.right, this.#bindings.left),
      moveY: Axis.buttons(this.#bindings.up, this.#bindings.down),
      moveZ: Axis.buttons(this.#bindings.backward, this.#bindings.forward)
    });

    this.maxRollUp = maxRollUp;
    this.maxRollDown = maxRollDown;
    this.#rotationSpeed = rotationSpeed;
    this.#movementSpeed = speed;
  }

  /**
   * The underlying THREE camera. Read-only as far as the transform goes:
   * position and quaternion are overwritten from `actor.transform` every frame.
   * Move the camera through `actor.transform` instead.
   */
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
    const { transform } = this.actor;
    const mouseDelta = this.actor.world.input.mouse.viewportDelta(
      true
    );

    this.#euler.setFromQuaternion(
      transform.getLocalOrientation(this.#orientation)
    );
    this.#euler.y -= mouseDelta.x * this.#rotationSpeed;
    this.#euler.x += mouseDelta.y * this.#rotationSpeed;
    this.#euler.x = Math.max(
      this.maxRollDown,
      Math.min(this.maxRollUp, this.#euler.x)
    );

    transform.setLocalOrientation(
      this.#orientation.setFromEuler(this.#euler)
    );
  }

  update(
    deltaTime: number
  ) {
    const { input } = this.actor.world;

    this.#axes.update(input);
    const vector = this.#axes.vector3(
      "moveX",
      "moveY",
      "moveZ",
      this.#direction
    );

    const { transform } = this.actor;
    const distance = this.#movementSpeed * deltaTime;

    transform.moveOriented(
      this.#translation
        .set(vector.x, 0, vector.z)
        .normalize()
        .multiplyScalar(distance)
    );
    if (vector.y !== 0) {
      transform.moveGlobal(
        this.#translation.set(0, vector.y * distance, 0)
      );
    }

    if (input.mouse.isDown(this.#bindings.lookAround)) {
      // input.mouse.lock();
      this.#rotate();
    }
    else if (input.mouse.wasJustReleased(this.#bindings.lookAround)) {
      // input.mouse.unlock();
    }
  }
}
