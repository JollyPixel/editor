// Import Third-party Dependencies
import * as THREE from "three";
import { Input } from "@jolly-pixel/engine";

export interface CubeSelectorRendererOptions {
  rotateSpeed?: number;
  width: number;
  height: number;
  cubeSize?: number;
}

export class CubeSelectorRenderer extends EventTarget {
  slots: THREE.Vector2Like[] = [
    { x: -2.5, y: 1.5 },
    { x: -1.5, y: 1.5 },
    { x: -0.5, y: 1.5 },
    { x: 0.5, y: 1.5 },
    { x: 1.5, y: 1.5 },
    { x: 2.5, y: 1.5 },
    { x: -2.5, y: 0.5 }
  ];

  rotateSpeed: number;
  renderingWidth: number;
  renderingHeight: number;
  cubeSize: number;

  input: Input;

  objects: THREE.Object3D[] = [];
  threeRenderer: THREE.WebGLRenderer;
  rayCaster: THREE.Raycaster;
  selectedObject: THREE.Object3D | null;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rollOver: THREE.LineSegments;

  constructor(
    container: HTMLElement,
    options: CubeSelectorRendererOptions
  ) {
    super();
    const {
      rotateSpeed = 0.004,
      width,
      height,
      cubeSize = 0.5
    } = options;

    this.rotateSpeed = rotateSpeed;
    this.renderingWidth = width;
    this.renderingHeight = height;
    this.cubeSize = cubeSize;

    // Create WebGL renderer
    this.threeRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    this.threeRenderer.setSize(this.renderingWidth, this.renderingHeight);
    this.threeRenderer.autoClear = false;
    this.input = new Input(this.threeRenderer.domElement);
    this.input.connect();
    container.appendChild(this.threeRenderer.domElement);

    this.rayCaster = new THREE.Raycaster();
    this.selectedObject = null;

    // Create default scene and add camera.
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(
      70,
      this.renderingWidth / this.renderingHeight
    );
    this.camera.position.set(0, 0, 3);
    this.scene.add(this.camera);

    const rollOverGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize)
    );

    const rollOverMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });
    this.rollOver = new THREE.LineSegments(rollOverGeometry, rollOverMaterial);
    this.rollOver.renderOrder = 0;
    this.rollOver.position.set(0, 0, 0);
    this.rollOver.visible = false;
    this.scene.add(this.rollOver);

    // Add default cubes to the scene!
    this.pushNewShape("textures/cube.png");
    this.pushNewShape("textures/cube2.png");
    this.pushNewShape("textures/cube3.png");
    this.pushNewShape("textures/cube.png");
    this.pushNewShape("textures/cube.png");
    this.pushNewShape("textures/cube.png");
    this.pushNewShape("textures/cube.png");

    window.requestAnimationFrame(this.loop.bind(this));
  }

  pushNewShape(
    texture: string
  ) {
    const geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
    const material = new THREE.MeshBasicMaterial({
      map: new THREE.TextureLoader().load(texture)
    });
    const mesh = new THREE.Mesh(geometry, material);
    const position = this.slots.shift()!;
    mesh.position.set(position.x, position.y, 0);
    mesh.rotation.set(this.rollOver.rotation.x, this.rollOver.rotation.y, this.rollOver.rotation.z);

    this.objects.push(mesh);
    this.scene.add(mesh);
  }

  private loop = () => {
    this.threeRenderer.clear();
    this.input.update();

    this.camera.updateMatrixWorld(true);
    if (this.input.isMouseMoving() && this.input.isMouseButtonDown("right")) {
      const delta = this.input.getMouseDelta();

      this.objects.forEach((mesh) => {
        mesh.rotation.x += delta.y;
        mesh.rotation.y += delta.x;
      });
      this.rollOver.rotation.x += delta.y;
      this.rollOver.rotation.y += delta.x;
    }
    if (this.input.isMouseButtonDown("left")) {
      this.rayCaster.setFromCamera(
        this.input.getMousePosition(),
        this.camera
      );
      const intersects = this.rayCaster.intersectObjects(this.objects);
      if (intersects.length > 0) {
        const intersect = intersects[0];
        this.rollOver.position.setFromMatrixPosition(intersect.object.matrixWorld);
        this.rollOver.visible = true;
      }
    }

    this.threeRenderer.render(this.scene, this.camera);

    window.requestAnimationFrame(this.loop);
  };
}
