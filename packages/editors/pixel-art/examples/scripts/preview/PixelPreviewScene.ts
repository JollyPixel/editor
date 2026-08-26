// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import * as THREE from "three";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelCanvasTexture } from "../../../src/three/PixelCanvasTexture.ts";
import { CameraBehavior } from "../components/Camera.ts";
import { OrbitControlsBehavior } from "../components/OrbitControlsBehavior.ts";
import { RegionPreviewFactory } from "./RegionPreviewFactory.ts";
import { RegionPreviewGallery } from "./RegionPreviewGallery.ts";
import { RegionPreviewPicker } from "./RegionPreviewPicker.ts";

declare global {
  interface Window {
    /**
     * Current preview mesh count for e2e leak checks.
     */
    __uvPreviewMeshCount?: () => number;
  }
}

export interface PixelPreviewSceneAppearance {
  backgroundColor: THREE.ColorRepresentation;
  borderColor: THREE.ColorRepresentation;
}

const kSceneAppearances: Record<string, PixelPreviewSceneAppearance> = {
  light: {
    backgroundColor: "#eef3f7",
    borderColor: "#101820"
  },
  dark: {
    backgroundColor: "#161a1d",
    borderColor: "#f2f5f7"
  }
};

export interface PixelPreviewSceneOptions {
  canvasManager: PixelArtCanvas;
  /**
   * @default true
   */
  initialRotating?: boolean;
}

/**
 * Owns the preview camera, controls, lights, gallery, and picker.
 */
export class PixelPreviewScene extends Systems.Scene {
  readonly #canvasManager: PixelArtCanvas;
  readonly #initialRotating: boolean;

  #canvasTexture!: PixelCanvasTexture;
  #previewGallery!: RegionPreviewGallery;
  #previewPicker!: RegionPreviewPicker;

  constructor(
    options: PixelPreviewSceneOptions
  ) {
    super("pixel-preview");

    this.#canvasManager = options.canvasManager;
    this.#initialRotating = options.initialRotating ?? true;
  }

  override awake(): void {
    const scene = this.world.sceneManager.getSource();
    scene.add(
      new THREE.HemisphereLight(0xffffff, 0x76848c, 2.8)
    );

    // One upload per animation frame, however many pixels the stroke touched.
    this.#canvasTexture = new PixelCanvasTexture(this.#canvasManager);
    this.#canvasTexture.on("resized", () => {
      this.#previewGallery.refreshTextureSize();
    });

    const cameraBehavior = this.world.createActor("camera")
      .addComponentAndGet(CameraBehavior);

    this.world.createActor("orbit-controls").addComponentAndGet(OrbitControlsBehavior, {
      camera: cameraBehavior.camera,
      cameraActor: cameraBehavior.actor,
      target: new THREE.Vector3(0, 0, 0),
      minDistance: 3,
      maxDistance: 30
    });

    const previewFactory = new RegionPreviewFactory({
      world: this.world,
      canvasTexture: this.#canvasTexture.texture
    });
    this.#previewGallery = new RegionPreviewGallery({
      previewFactory,
      canvasManager: this.#canvasManager
    });
    window.__uvPreviewMeshCount = () => this.#previewGallery.meshes.length;
    this.#previewGallery.setRotating(this.#initialRotating);

    this.#previewPicker = new RegionPreviewPicker({
      uv: this.#canvasManager.uv,
      camera: cameraBehavior.camera,
      canvas: this.world.renderer.canvas,
      getMeshes: () => this.#previewGallery.meshes
    });

    // SceneManager calls awake next frame, after loadRuntime resolves.
    // World-dependent callers must wait for this event.
    this.emit("awake");
  }

  setAppearance(
    theme: "light" | "dark"
  ): void {
    const appearance = kSceneAppearances[theme];
    this.world.sceneManager.getSource().background = new THREE.Color(
      appearance.backgroundColor
    );
    this.#previewGallery.setAppearance({
      borderColor: appearance.borderColor
    });
  }

  setRotating(
    rotating: boolean
  ): void {
    this.#previewGallery.setRotating(rotating);
  }

  override destroy(): void {
    this.#previewPicker.dispose();
    this.#previewGallery.dispose();
    this.#canvasTexture.dispose();
    delete window.__uvPreviewMeshCount;
  }
}
