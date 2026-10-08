// Import Third-party Dependencies
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { WebGPURenderer } from "three/webgpu";

// CONSTANTS
const kDefaultBackground = "#1a1a2e";
const kLabelStyle: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  color: "#fff",
  fontSize: "11px",
  fontFamily: "monospace",
  background: "rgba(26, 26, 26, 0.95)",
  padding: "2px 7px",
  borderRadius: "3px",
  pointerEvents: "none",
  whiteSpace: "nowrap",
  transform: "translateX(-50%)"
};

export interface OrbitViewerOptions {
  position: THREE.Vector3Like;
  target: THREE.Vector3Like;
  background?: THREE.ColorRepresentation;
  antialias?: boolean;
}

export interface OrbitViewerLoop {
  render?: () => void;
  onFrame?: (deltaTime: number) => void;
}

interface Label {
  element: HTMLDivElement;
  position: THREE.Vector3;
}

export class OrbitViewer {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGPURenderer;
  readonly scene = new THREE.Scene();
  readonly background: THREE.Color;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  #labels: Label[] = [];
  #projected = new THREE.Vector3();

  constructor(
    options: OrbitViewerOptions
  ) {
    const {
      position,
      target,
      background = kDefaultBackground,
      antialias = true
    } = options;

    const canvas = document.querySelector("canvas");
    if (!canvas) {
      throw new Error("HTMLCanvasElement not found");
    }
    this.canvas = canvas;

    this.renderer = new WebGPURenderer({ canvas, antialias });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.background = new THREE.Color(background);
    this.scene.background = this.background;

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.copy(position);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.update();
  }

  label(
    text: string,
    position: THREE.Vector3Like,
    style?: Partial<CSSStyleDeclaration>
  ): void {
    const element = document.createElement("div");
    element.textContent = text;
    Object.assign(element.style, kLabelStyle, style);
    document.body.appendChild(element);

    this.#labels.push({
      element,
      position: new THREE.Vector3().copy(position)
    });
  }

  async start(
    loop: OrbitViewerLoop = {}
  ): Promise<void> {
    const {
      render = () => this.renderer.render(this.scene, this.camera),
      onFrame
    } = loop;

    window.addEventListener("resize", () => this.#resize());
    await this.renderer.init();

    let lastTime = performance.now();
    const animate = () => {
      requestAnimationFrame(animate);

      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      this.renderer.clear();
      this.controls.update();
      this.#projectLabels();
      render();
      onFrame?.(deltaTime);
    };
    animate();
  }

  #resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  #projectLabels(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (const { element, position } of this.#labels) {
      this.#projected.copy(position).project(this.camera);
      if (this.#projected.z > 1) {
        element.style.display = "none";
        continue;
      }

      element.style.display = "";
      element.style.left = `${((this.#projected.x * 0.5) + 0.5) * width}px`;
      element.style.top = `${((-this.#projected.y * 0.5) + 0.5) * height}px`;
    }
  }
}
