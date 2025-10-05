// Import Third-party Dependencies
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Import Internal Dependencies
import CanvasManager from "./CanvasManager";

// CONSTANTS
// const kSection = document.querySelector("section") as HTMLDivElement;
// const kBoundingRect = kSection.getBoundingClientRect();

// const renderer = new THREE.WebGLRenderer();

// const scene = new THREE.Scene();
// const camera = new THREE.PerspectiveCamera(75, kBoundingRect.width / kBoundingRect.height, 0.1, 1000);

// const geometry = new THREE.BoxGeometry(1, 1, 1);
// const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// const cube = new THREE.Mesh(geometry, material);
// scene.add(cube);

// camera.position.z = 5;

// const controls = new OrbitControls(camera, renderer.domElement);
// controls.update();

// renderer.setSize(kBoundingRect.width, kBoundingRect.height);
// kSection.appendChild(renderer.domElement);

// function animate() {
//   renderer.render(scene, camera);
//   controls.update();
// }
// renderer.setAnimationLoop(animate);

interface CreateCubeOptions {
  pos?: THREE.Vector3;
  size?: THREE.Vector3;
  scale?: THREE.Vector3;
  color?: THREE.Color;
}

export default class ThreeSceneManager {
  private rootHTMLElement: HTMLDivElement;
  private canvasManager: CanvasManager;

  private renderer: THREE.WebGLRenderer;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private orbitalControl: OrbitControls;

  private cubes: THREE.Mesh[];
  private texture: THREE.CanvasTexture;

  constructor(rootHTMLElement: HTMLDivElement, canvasManager: CanvasManager) {
    this.rootHTMLElement = rootHTMLElement;
    this.canvasManager = canvasManager;

    this.renderer = new THREE.WebGLRenderer();
    const bounding = this.rootHTMLElement.getBoundingClientRect();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, bounding.width / bounding.height, 0.1, 1000);
    this.camera.position.z = 5;

    this.texture = new THREE.CanvasTexture(this.canvasManager.getTextureCanvas());
    // Désactiver le lissage
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;

    this.cubes = [];
    this.createCube();

    this.orbitalControl = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitalControl.update();

    this.renderer.setSize(bounding.width, bounding.height);
    this.rootHTMLElement.appendChild(this.renderer.domElement);

    this.update();

    this.renderer.setAnimationLoop(this.update.bind(this));
  }

  private createCube(options: CreateCubeOptions = {}) {
    const {
      pos = new THREE.Vector3(0, 0, 0),
      size = new THREE.Vector3(1, 1, 1),
      scale = new THREE.Vector3(1, 1, 1),
      color = new THREE.Color(0xffffff)
    } = options;

    const geometry = new THREE.BoxGeometry(...size);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.DoubleSide
    });
    material.map = this.texture;
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
    this.camera = new THREE.PerspectiveCamera(75, bounding.width / bounding.height, 0.1, 1000);
  }

  update() {
    this.renderer.render(this.scene, this.camera);
    this.orbitalControl.update();
    this.texture.needsUpdate = true;
  }
}
