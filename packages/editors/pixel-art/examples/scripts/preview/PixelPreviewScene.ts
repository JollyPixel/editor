// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";
import * as THREE from "three";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { CameraBehavior } from "../components/Camera.ts";
import { OrbitControlsBehavior } from "../components/OrbitControlsBehavior.ts";
import { RegionPreviewFactory } from "./RegionPreviewFactory.ts";
import { RegionPreviewGallery } from "./RegionPreviewGallery.ts";
import { RegionPreviewPicker } from "./RegionPreviewPicker.ts";

declare global {
  interface Window {
    /**
     * Preview meshes currently in the scene. Exposed for e2e: a region view
     * leaking a second mesh is invisible from the DOM.
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
  /** @default true */
  initialRotating?: boolean;
}

/**
 * Owns every Three.js concern for the pixel-draw preview: camera, orbit
 * controls, lighting, the UV region gallery and its click-to-select picker.
 */
export class PixelPreviewScene extends Systems.Scene {
  readonly #canvasManager: PixelArtCanvas;
  readonly #initialRotating: boolean;

  #canvasTexture!: THREE.CanvasTexture;
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

    this.#canvasTexture = new THREE.CanvasTexture(
      this.#canvasManager.textureCanvas()
    );
    this.#canvasTexture.magFilter = THREE.NearestFilter;
    this.#canvasTexture.minFilter = THREE.NearestFilter;
    this.#canvasManager.onBufferUpdated = (event) => {
      this.#canvasTexture.needsUpdate = true;
      if (event.action === "texture-replaced") {
        this.#canvasTexture.image = this.#canvasManager.textureCanvas();
        this.#previewGallery.refreshTextureSize();
      }
    };

    const cameraBehavior = this.world.createActor("camera")
      .addComponentAndGet(CameraBehavior);

    // Drag orbit + scroll zoom camera controls.
    this.world.createActor("orbit-controls").addComponentAndGet(OrbitControlsBehavior, {
      camera: cameraBehavior.camera,
      cameraActor: cameraBehavior.actor,
      target: new THREE.Vector3(0, 0, 0),
      minDistance: 3,
      maxDistance: 30
    });

    const previewFactory = new RegionPreviewFactory({
      world: this.world,
      canvasTexture: this.#canvasTexture
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

    // SceneManager activates the scene (and calls awake()) on the next
    // render frame, well after loadRuntime()'s promise has already
    // resolved — callers needing world-dependent APIs must wait for this.
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
    delete window.__uvPreviewMeshCount;
  }
}
