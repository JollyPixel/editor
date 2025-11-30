// Import Third-party Dependencies
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/Addons.js";
// import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';
import { Input } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type CanvasManager from "../texture/CanvasManager.js";
import ModelManager from "./ModelManager.js";

export default class ThreeSceneManager {
  private rootHTMLElement: HTMLDivElement;

  private renderer: THREE.WebGLRenderer;
  private input: Input;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraRaycaster: THREE.Raycaster;

  private orbitalControl: OrbitControls;
  private transformControl: TransformControls;
  private modelManager: ModelManager;
  // private viewHelper: ViewHelper;

  private isTransformControlsDragging: boolean = false;

  private texture: THREE.CanvasTexture | null = null;

  constructor(rootHTMLElement: HTMLDivElement) {
    this.rootHTMLElement = rootHTMLElement;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    this.renderer.sortObjects = true;
    // this.renderer.autoClear = false;

    const bounding = this.rootHTMLElement.getBoundingClientRect();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, bounding.width / bounding.height, 0.1, 1000);
    this.camera.position.z = 5;
    this.cameraRaycaster = new THREE.Raycaster();

    this.transformControl = new TransformControls(this.camera, this.renderer.domElement);

    this.transformControl.addEventListener("dragging-changed", (event: any) => {
      this.isTransformControlsDragging = event.value;
      this.orbitalControl.enabled = !event.value;
    });

    this.orbitalControl = this.initOrbitControl();

    // Initialize ModelManager
    this.modelManager = new ModelManager({
      scene: this.scene,
      transformControl: this.transformControl
    });

    this.input = new Input(this.renderer.domElement);
    this.input.connect();
    this.update();

    this.scene.add(new THREE.GridHelper(10, 10));

    this.renderer.setSize(bounding.width, bounding.height);
    this.rootHTMLElement.appendChild(this.renderer.domElement);

    this.renderer.setAnimationLoop(this.update.bind(this));
  }

  private initOrbitControl(): OrbitControls {
    const orbitalControl = new OrbitControls(this.camera, this.renderer.domElement);
    orbitalControl.mouseButtons = {
      RIGHT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.ROTATE
    };
    orbitalControl.enableZoom = true;

    return orbitalControl;
  }

  private cameraRayCast() {
    if (this.input.wasMouseButtonJustPressed("left")) {
      if (this.isTransformControlsDragging) {
        return;
      }

      this.cameraRaycaster.setFromCamera(
        this.input.getMousePosition(),
        this.camera
      );

      const meshes = this.modelManager.getGroups().map((group) => group.getMesh());
      const cubeIntersects = this.cameraRaycaster.intersectObjects(meshes, false);

      if (cubeIntersects.length > 0) {
        const intersect = cubeIntersects[0];
        const mesh = intersect.object as THREE.Mesh;
        const group = this.modelManager.getGroupByMesh(mesh);

        if (group) {
          this.modelManager.selectGroup(group);
        }

        return;
      }

      this.modelManager.selectGroup(null);
    }
  }

  public createCube() {
    const group = this.modelManager.addGroup({
      texture: this.texture
    });

    return group;
  }

  onResize() {
    const bounding = this.rootHTMLElement.getBoundingClientRect();
    this.renderer.setSize(bounding.width, bounding.height);
    this.camera.aspect = bounding.width / bounding.height;
    this.camera.updateProjectionMatrix();
  }

  update() {
    this.input.update();
    this.cameraRayCast();
    this.handleKeyboardControls();
    this.orbitalControl.update();

    this.renderer.render(this.scene, this.camera);
  }

  private handleKeyboardControls(): void {
    const moveDistance = 0.1;
    const direction = new THREE.Vector3();

    if (this.input.isKeyDown("W")) {
      direction.z -= moveDistance;
    }
    if (this.input.isKeyDown("A")) {
      direction.x -= moveDistance;
    }
    if (this.input.isKeyDown("S")) {
      direction.z += moveDistance;
    }
    if (this.input.isKeyDown("D")) {
      direction.x += moveDistance;
    }
    if (this.input.isKeyDown("Space")) {
      direction.y += moveDistance;
    }
    if (this.input.isKeyDown("ShiftLeft")) {
      direction.y -= moveDistance;
    }

    this.camera.position.add(direction);
    this.orbitalControl.target.add(direction);
  }

  public setCanvasTexture(canvasManager: CanvasManager): void {
    const textureCanvas = canvasManager.getTextureCanvas();
    // this.textureCanvas = textureCanvas;
    this.texture = new THREE.CanvasTexture(textureCanvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true;
    this.texture.generateMipmaps = false;

    this.modelManager.setTextureForAll(this.texture);
  }
}
