// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { MouseEventButton } from "../controls/Input.class.js";
import { Actor } from "../Actor.js";
import { Behavior } from "../Behavior.js";

export interface Camera3DControlsOptions {
  bindings?: {
    forward?: string;
    backward?: string;
    left?: string;
    right?: string;
    up?: string;
    down?: string;
    lookAround?: Exclude<keyof typeof MouseEventButton, "scrollUp" | "scrollDown">;
  };
  maxRollUp?: number;
  maxRollDown?: number;
  rotationSpeed?: number;
  speed?: number;
}

export class Camera3DControls extends Behavior {
  camera: THREE.PerspectiveCamera;
  #bindings: Required<NonNullable<Camera3DControlsOptions["bindings"]>>;

  maxRollUp: number;
  maxRollDown: number;
  #rotationSpeed: number;
  #movementSpeed: number;

  constructor(
    actor: Actor,
    options: Camera3DControlsOptions = {}
  ) {
    super(actor);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);

    this.#bindings = {
      forward: options.bindings?.forward ?? "KeyW",
      backward: options.bindings?.backward ?? "KeyS",
      left: options.bindings?.left ?? "KeyA",
      right: options.bindings?.right ?? "KeyD",
      up: options.bindings?.up ?? "Space",
      down: options.bindings?.down ?? "ShiftLeft",
      lookAround: options.bindings?.lookAround ?? "middle"
    };

    this.maxRollUp = options.maxRollUp ?? Math.PI / 2;
    this.maxRollDown = options.maxRollDown ?? -Math.PI / 2;
    this.#rotationSpeed = options.rotationSpeed ?? 2;
    this.#movementSpeed = options.speed ?? 20;
  }

  start() {
    this.actor.gameInstance.renderComponents.push(this.camera);
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
    const mouseDelta = this.actor.gameInstance.input.getMouseDelta();
    const euler = new THREE.Euler(0, 0, 0, "YXZ");

    euler.setFromQuaternion(this.camera.quaternion);
    euler.y -= mouseDelta.x * this.#rotationSpeed;
    euler.x += mouseDelta.y * this.#rotationSpeed;
    euler.x = Math.max(this.maxRollDown, Math.min(this.maxRollUp, euler.x));

    this.camera.quaternion.setFromEuler(euler);
  }

  update() {
    const { input } = this.actor.gameInstance;

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
    this.camera.translateOnAxis(translation.normalize(), this.#movementSpeed);
    this.camera.position.y += vector.y * this.#movementSpeed;

    if (input.isMouseButtonDown(this.#bindings.lookAround)) {
      // this.#input.mouse.lock();
      this.#rotate();
    }
    if (input.wasMouseButtonJustReleased(this.#bindings.lookAround)) {
      // this.#input.mouse.unlock();
    }
  }
}
