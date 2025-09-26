// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";

export interface ModelManipulatorOptions {
  camera: THREE.Camera;
}

export class ModelManipulator extends ActorComponent {
  #camera: THREE.Camera;
  #canvas: HTMLCanvasElement;
  #actors: Actor[];
  #raycaster: THREE.Raycaster;
  #mouse: THREE.Vector2;
  #isDragging = false;
  #draggedActor: Actor | null = null;
  #dragPlane: THREE.Plane;
  #dragOffset: THREE.Vector3;
  #isControlDown = false;
  #isAltDown = false;
  #rotationStartMouse: THREE.Vector2;
  #rotationStartRotation: number;

  constructor(
    actor: Actor,
    options: ModelManipulatorOptions
  ) {
    super({
      actor,
      typeName: "ModelManipulator"
    });

    this.#camera = options.camera;
    this.#canvas = this.actor.gameInstance.renderer.canvas;
    // @ts-ignore
    this.#actors = this.actor.gameInstance.tree.children.filter((node) => node.name.endsWith("Model"));
    this.#raycaster = new THREE.Raycaster();
    this.#mouse = new THREE.Vector2();
    this.#dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.#dragOffset = new THREE.Vector3();
    this.#rotationStartMouse = new THREE.Vector2();
    this.#rotationStartRotation = 0;

    this.#setupEventListeners();
  }

  #setupEventListeners(): void {
    document.addEventListener("keydown", (event) => {
      if (event.code === "ControlLeft" || event.code === "ControlRight") {
        this.#isControlDown = true;
        this.#canvas.style.cursor = "grab";
      }
      if (event.code === "AltLeft" || event.code === "AltRight") {
        this.#isAltDown = true;
        this.#canvas.style.cursor = "crosshair";
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.code === "ControlLeft" || event.code === "ControlRight") {
        this.#isControlDown = false;
        this.#canvas.style.cursor = "default";
        if (this.#isDragging) {
          this.#stopDragging();
        }
      }
      if (event.code === "AltLeft" || event.code === "AltRight") {
        this.#isAltDown = false;
        this.#canvas.style.cursor = "default";
        if (this.#isDragging) {
          this.#stopDragging();
        }
      }
    });

    this.#canvas.addEventListener("mousedown", (event) => {
      if (event.button === 0 && this.#isControlDown) {
        this.#onMouseDown(event);
      }
      if (event.button === 0 && this.#isAltDown) {
        this.#onMouseDownRotate(event);
      }
    });

    this.#canvas.addEventListener("mousemove", (event) => {
      this.#onMouseMove(event);
    });

    this.#canvas.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        this.#stopDragging();
      }
    });

    this.#canvas.addEventListener("mouseleave", () => {
      this.#stopDragging();
    });
  }

  #updateMousePosition(event: MouseEvent): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#mouse.x = (((event.clientX - rect.left) / rect.width) * 2) - 1;
    this.#mouse.y = -(((event.clientY - rect.top) / rect.height) * 2) + 1;
  }

  #onMouseDown(event: MouseEvent): void {
    this.#updateMousePosition(event);

    this.#raycaster.setFromCamera(this.#mouse, this.#camera);

    const intersectableObjects: THREE.Object3D[] = [];
    this.#actors.forEach((actor) => {
      if (actor.threeObject.children.length > 0) {
        actor.threeObject.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            intersectableObjects.push(child);
          }
        });
      }
    });

    const intersections = this.#raycaster.intersectObjects(intersectableObjects);

    if (intersections.length > 0) {
      const intersectedObject = intersections[0].object;
      this.#draggedActor = this.#findActorForObject(intersectedObject);

      if (this.#draggedActor) {
        this.#isDragging = true;
        this.#canvas.style.cursor = "grabbing";

        const intersection = new THREE.Vector3();
        this.#raycaster.ray.intersectPlane(this.#dragPlane, intersection);

        this.#dragOffset.copy(this.#draggedActor.threeObject.position).sub(intersection);
      }
    }
  }

  #onMouseDownRotate(event: MouseEvent): void {
    this.#updateMousePosition(event);

    this.#raycaster.setFromCamera(this.#mouse, this.#camera);

    const intersectableObjects: THREE.Object3D[] = [];
    this.#actors.forEach((actor) => {
      if (actor.threeObject.children.length > 0) {
        actor.threeObject.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            intersectableObjects.push(child);
          }
        });
      }
    });

    const intersects = this.#raycaster.intersectObjects(intersectableObjects);

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      this.#draggedActor = this.#findActorForObject(intersectedObject);

      if (this.#draggedActor) {
        this.#isDragging = true;
        this.#canvas.style.cursor = "grabbing";

        this.#rotationStartMouse.copy(this.#mouse);
        this.#rotationStartRotation = this.#draggedActor.threeObject.rotation.y;
      }
    }
  }

  #onMouseMove(event: MouseEvent): void {
    this.#updateMousePosition(event);

    if (this.#isDragging && this.#draggedActor) {
      if (this.#isControlDown) {
        this.#raycaster.setFromCamera(this.#mouse, this.#camera);

        const intersection = new THREE.Vector3();
        if (this.#raycaster.ray.intersectPlane(this.#dragPlane, intersection)) {
          this.#draggedActor.threeObject.position.copy(intersection.add(this.#dragOffset));
        }
      }
      else if (this.#isAltDown) {
        const mouseDelta = this.#mouse.x - this.#rotationStartMouse.x;
        const rotationSpeed = Math.PI * 2;
        const newRotation = this.#rotationStartRotation + (mouseDelta * rotationSpeed);
        this.#draggedActor.threeObject.rotation.y = newRotation;
      }
    }
    else if (this.#isControlDown || this.#isAltDown) {
      this.#raycaster.setFromCamera(this.#mouse, this.#camera);

      const intersectableObjects: THREE.Object3D[] = [];
      this.#actors.forEach((actor) => {
        if (actor.threeObject.children.length > 0) {
          actor.threeObject.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              intersectableObjects.push(child);
            }
          });
        }
      });

      const intersects = this.#raycaster.intersectObjects(intersectableObjects);
      if (intersects.length > 0) {
        this.#canvas.style.cursor = this.#isControlDown ? "grab" : "crosshair";
      }
      else {
        this.#canvas.style.cursor = "default";
      }
    }
  }

  #stopDragging(): void {
    this.#isDragging = false;
    this.#draggedActor = null;
    if (this.#isControlDown) {
      this.#canvas.style.cursor = "grab";
    }
    else if (this.#isAltDown) {
      this.#canvas.style.cursor = "crosshair";
    }
    else {
      this.#canvas.style.cursor = "default";
    }
  }

  #findActorForObject(object: THREE.Object3D): Actor | null {
    for (const actor of this.#actors) {
      if (this.#isObjectInActor(object, actor.threeObject)) {
        return actor;
      }
    }

    return null;
  }

  #isObjectInActor(object: THREE.Object3D, actorObject: THREE.Object3D): boolean {
    if (object === actorObject) {
      return true;
    }

    let parent = object.parent;
    while (parent) {
      if (parent === actorObject) {
        return true;
      }
      parent = parent.parent;
    }

    return false;
  }
}
