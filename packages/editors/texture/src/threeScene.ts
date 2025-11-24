// Import Third-party Dependencies
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/Addons.js";
// import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';
import { Input } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type CanvasManager from "./CanvasManager.js";

const kSvgNs = "http://www.w3.org/2000/svg";

interface CreateCubeOptions {
  pos?: THREE.Vector3;
  size?: THREE.Vector3;
  scale?: THREE.Vector3;
  color?: THREE.Color;
}

export default class ThreeSceneManager {
  private rootHTMLElement: HTMLDivElement;

  private renderer: THREE.WebGLRenderer;
  private input: Input;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraRaycaster: THREE.Raycaster;

  private orbitalControl: OrbitControls;
  private transformControl: TransformControls;
  // private viewHelper: ViewHelper;

  private wireframeMesh: THREE.Mesh | null = null;
  private selectedCube: THREE.Mesh | null = null;

  private cubes: THREE.Mesh[];
  private texture: THREE.CanvasTexture | null = null;

  constructor(rootHTMLElement: HTMLDivElement) {
    this.rootHTMLElement = rootHTMLElement;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    // this.renderer.autoClear = false;
    this.wireframeMesh = null;

    const bounding = this.rootHTMLElement.getBoundingClientRect();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, bounding.width / bounding.height, 0.1, 1000);
    this.camera.position.z = 5;
    this.cameraRaycaster = new THREE.Raycaster();

    this.transformControl = new TransformControls(this.camera, this.renderer.domElement);

    this.scene.add(new THREE.GridHelper(10, 10));
    this.cubes = [];
    this.createCube();

    this.orbitalControl = this.initOrbitControl();

    this.renderer.setSize(bounding.width, bounding.height);
    this.rootHTMLElement.appendChild(this.renderer.domElement);

    this.input = new Input(this.renderer.domElement);
    this.input.connect();

    this.update();

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

  // private initUV(mesh: THREE.Mesh): void {
  //   const uvRects = mesh.geometry.getAttribute("uv");

  //   for (const rect of uvRects) {
  //     const rectElem = document.createElementNS(kSvgNs, "rect");
  //     rectElem.classList.add("uv");
  //     this.svg.appendChild(rectElem);
  //     rect.element = rectElem;
  //     rect.element.style.display = rect.hidden ? "none" : "";
  //     rect.element.style.pointerEvents = "none";

  //     this.updateUVRect(rect);
  //   }
  // }

  private cameraRayCast() {
    if (this.input.wasMouseButtonJustPressed("left")) {
      this.cameraRaycaster.setFromCamera(
        this.input.getMousePosition(),
        this.camera
      );

      const intersects = this.cameraRaycaster.intersectObjects(this.cubes);
      if (intersects.length > 0) {
        const intersect = intersects[0];
        this.selectCube(intersect.object as THREE.Mesh);
      }
      else {
        this.selectCube(null);
      }
    }
  }

  private createCube(options: CreateCubeOptions = {}) {
    const {
      pos = new THREE.Vector3(0, 0, 0),
      size = new THREE.Vector3(1, 1, 1),
      scale = new THREE.Vector3(1, 1, 1),
      color = new THREE.Color(0xffffff)
    } = options;

    const geometry = new THREE.BoxGeometry(...size);
    console.log(geometry.attributes.uv);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.DoubleSide
    });
    // material.map = this.texture;
    material.needsUpdate = true;

    const cube = new THREE.Mesh(geometry, material);

    cube.position.x = pos.x;
    cube.position.y = pos.y;
    cube.position.z = pos.z;

    cube.scale.x = scale.x;
    cube.scale.y = scale.y;
    cube.scale.z = scale.z;

    this.scene.add(cube);

    this.cubes.push(cube);
  }

  private selectCube(mesh: THREE.Mesh | null) {
    if (!mesh) {
      if (this.wireframeMesh) {
        this.scene.remove(this.wireframeMesh);
        this.wireframeMesh = null;
      }
      this.selectedCube = null;
      this.transformControl.detach();

      return;
    }

    if (mesh.id === this.selectedCube?.id) {
      return;
    }

    this.selectedCube = mesh;
    const wireframeMesh = mesh.clone();
    wireframeMesh.material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      wireframe: true
    });

    this.transformControl.attach(this.selectedCube);
    this.scene.add(this.transformControl.getHelper());

    this.scene.add(wireframeMesh);
    this.wireframeMesh = wireframeMesh;
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

    this.cubes.forEach((cube) => {
      if (cube.material instanceof THREE.MeshBasicMaterial) {
        cube.material.map = this.texture;
        cube.material.needsUpdate = true;
      }
    });
  }
}
