// Import Third-party Dependencies
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Input } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type CanvasManager from "./CanvasManager.js";

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

  private cubes: THREE.Mesh[];
  private texture: THREE.CanvasTexture | null = null;

  constructor(rootHTMLElement: HTMLDivElement) {
    this.rootHTMLElement = rootHTMLElement;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    // this.renderer.autoClear = false;

    const bounding = this.rootHTMLElement.getBoundingClientRect();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, bounding.width / bounding.height, 0.1, 1000);
    this.camera.position.z = 5;
    this.cameraRaycaster = new THREE.Raycaster();

    this.scene.add(new THREE.GridHelper(10, 10));
    this.cubes = [];
    this.createCube();

    this.orbitalControl = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitalControl.update();

    this.renderer.setSize(bounding.width, bounding.height);
    this.rootHTMLElement.appendChild(this.renderer.domElement);

    this.input = new Input(this.renderer.domElement);
    this.input.connect();

    this.update();

    this.renderer.setAnimationLoop(this.update.bind(this));
  }

  cameraRayCast() {
    if (this.input.wasMouseButtonJustPressed("left")) {
      console.log("camera Raycast");
      this.cameraRaycaster.setFromCamera(
        this.input.getMousePosition(),
        this.camera
      );

      const intersects = this.cameraRaycaster.intersectObjects(this.cubes);
      if (intersects.length > 0) {
        const intersect = intersects[0];
        console.log("Intersected object:", intersect.object);
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

  onResize() {
    const bounding = this.rootHTMLElement.getBoundingClientRect();
    this.renderer.setSize(bounding.width, bounding.height);
    this.camera.aspect = bounding.width / bounding.height;
    this.camera.updateProjectionMatrix();
  }

  update() {
    this.input.update();
    this.cameraRayCast();
    this.renderer.render(this.scene, this.camera);
    // this.orbitalControl.update();
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
