// Import Third-party Dependencies
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/Addons.js";
// import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';
import { Input } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type CanvasManager from "./CanvasManager.js";

// const kSvgNs = "http://www.w3.org/2000/svg";

interface CreateCubeOptions {
  pos?: THREE.Vector3;
  pivotPos?: THREE.Vector3;
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

  private selectedGroup: THREE.Group | null = null;
  private isTransformControlsDragging: boolean = false;

  private meshes: THREE.Mesh[] = [];
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
    this.input = new Input(this.renderer.domElement);
    this.input.connect();
    this.update();

    this.scene.add(new THREE.GridHelper(10, 10));
    this.meshes = [];
    // this.createCube();

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

  private pointTexture(size: number = 64): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
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
      if (this.isTransformControlsDragging) {
        return;
      }

      this.cameraRaycaster.setFromCamera(
        this.input.getMousePosition(),
        this.camera
      );

      const cubeIntersects = this.cameraRaycaster.intersectObjects(this.meshes, false);

      if (cubeIntersects.length > 0) {
        const intersect = cubeIntersects[0];
        this.selectCube(intersect.object as THREE.Mesh);

        return;
      }

      this.selectCube(null);
    }
  }

  public createCube(options: CreateCubeOptions = {}) {
    const {
      pos = new THREE.Vector3(0, 0, 0),
      pivotPos = new THREE.Vector3(0, 0, 0),
      size = new THREE.Vector3(1, 1, 1),
      scale = new THREE.Vector3(1, 1, 1),
      color = new THREE.Color(0xffffff)
    } = options;

    const pivot = new THREE.Group();
    pivot.position.copy(pos);
    pivot.name = `pivot_${this.meshes.length}`;

    const geometry = new THREE.BoxGeometry(...size);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.DoubleSide,
      map: this.texture
    });
    material.needsUpdate = true;

    const cube = new THREE.Mesh(geometry, material);
    cube.name = `mesh_${this.meshes.length}`;

    cube.position.copy(pivotPos);

    cube.scale.x = scale.x;
    cube.scale.y = scale.y;
    cube.scale.z = scale.z;

    const edgesGeo = new THREE.EdgesGeometry(geometry);
    const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000 });
    const edgesLines = new THREE.LineSegments(edgesGeo, edgesMat);
    edgesLines.name = "edges";
    cube.add(edgesLines);

    pivot.add(cube);

    const pivotPointGeo = new THREE.BufferGeometry();
    pivotPointGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
    const pivotPointMat = new THREE.PointsMaterial({
      color: 0xff00ff,
      size: 15,
      sizeAttenuation: false,
      map: this.pointTexture(256)
    });
    pivotPointMat.depthTest = false;
    pivotPointMat.transparent = true;
    const pivotPoint = new THREE.Points(pivotPointGeo, pivotPointMat);
    pivotPoint.name = "pivot_visual";
    pivotPoint.visible = false;
    pivotPoint.renderOrder = 1;

    pivotPoint.position.copy(pos);
    pivot.add(pivotPoint);

    this.scene.add(pivot);

    this.meshes.push(cube);
  }

  private selectCube(mesh: THREE.Mesh | null) {
    const previousMesh = this.selectedGroup?.children.find((child) => child.name.startsWith("mesh"));
    if (mesh && mesh.id === previousMesh?.id) {
      return;
    }

    console.log("this.selectedGroup");
    console.log(this.selectedGroup);

    console.log("previousMesh");
    console.log(previousMesh);

    if (previousMesh) {
      const edgeChild = previousMesh.children.find(
        (child) => child.name === "edges"
      ) as THREE.LineSegments;
      if (edgeChild && edgeChild.material instanceof THREE.LineBasicMaterial) {
        edgeChild.material.color.set(0x000000);
      }
    }

    const previousPivotPoint = this.selectedGroup?.children.find((child) => child.name === "pivot_visual")!;
    if (previousPivotPoint) {
      previousPivotPoint.visible = false;
    }

    if (!mesh) {
      console.log("assign this.selectedGroup to null");
      this.selectedGroup = null;
      this.transformControl.detach();

      return;
    }

    console.log("assign this.selectedGroup");
    this.selectedGroup = mesh.parent! as THREE.Group;

    const groupPivot = mesh.parent!;

    const edgeChild = mesh.children.find((child) => child.name === "edges") as THREE.LineSegments;
    if (edgeChild && edgeChild.material instanceof THREE.LineBasicMaterial) {
      edgeChild.material.color.set(0xff00ff);
    }

    const pivotPoint = groupPivot.children.find((child) => child.name === "pivot_visual")!;
    pivotPoint.visible = true;

    this.transformControl.attach(this.selectedGroup);
    this.scene.add(this.transformControl.getHelper());
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

    this.meshes.forEach((mesh) => {
      if (mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material.map = this.texture;
        mesh.material.needsUpdate = true;
      }
    });
  }
}
