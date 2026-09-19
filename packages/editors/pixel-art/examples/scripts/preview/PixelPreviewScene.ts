// Import Third-party Dependencies
import { Systems, OrbitFlyCamera } from "@jolly-pixel/engine";
import * as THREE from "three";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import type { ResolvedThemeMode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PixelCanvasTexture } from "../../../src/mesh-texturing/PixelCanvasTexture.ts";
import {
  RegionPreviewBehavior,
  type RegionPreviewStyle
} from "./RegionPreviewBehavior.ts";
import { RegionPreviewGallery } from "./RegionPreviewGallery.ts";
import { RegionPreviewPicker } from "./RegionPreviewPicker.ts";

// CONSTANTS
const kSceneAppearances = {
  light: {
    backgroundColor: "#eef3f7",
    borderColor: "#101820"
  },
  dark: {
    backgroundColor: "#161a1d",
    borderColor: "#f2f5f7"
  }
} as const satisfies Record<ResolvedThemeMode, PixelPreviewSceneAppearance>;

export interface PixelPreviewSceneAppearance {
  backgroundColor: THREE.ColorRepresentation;
  borderColor: THREE.ColorRepresentation;
}

export interface PixelPreviewSceneOptions {
  canvasManager: PixelArtCanvas;
  rotating: boolean;
}

interface CanvasBinding {
  texture: PixelCanvasTexture;
  gallery: RegionPreviewGallery;
  picker: RegionPreviewPicker;
}

export class PixelPreviewScene extends Systems.Scene {
  #canvasManager: PixelArtCanvas;
  #camera: THREE.Camera | null = null;
  #binding: CanvasBinding | null = null;
  readonly #style: RegionPreviewStyle;
  readonly #ready = Promise.withResolvers<void>();

  constructor(
    options: PixelPreviewSceneOptions
  ) {
    super("pixel-preview");

    this.#canvasManager = options.canvasManager;
    this.#style = {
      rotating: options.rotating,
      borderColor: new THREE.Color(kSceneAppearances.light.borderColor)
    };
  }

  get ready(): Promise<void> {
    return this.#ready.promise;
  }

  get meshCount(): number {
    return this.#binding?.gallery.meshes.length ?? 0;
  }

  override awake(): void {
    const scene = this.world.sceneManager.getSource();
    scene.add(
      new THREE.HemisphereLight(0xffffff, 0x76848c, 2.8)
    );

    const orbitCamera = this.world.createActor("camera")
      .addComponentAndGet(OrbitFlyCamera, {
        focusMode: "lock",
        position: { x: 0, y: 0, z: 8 },
        pitch: 0,
        fov: 45,
        showPivotMarker: false,
        minPivotDistance: 3,
        maxPivotDistance: 30
      });
    orbitCamera.enterOrbitFocus({ x: 0, y: 0, z: 0 });

    this.#camera = orbitCamera.camera;
    this.#binding = this.#bind(this.#camera);
    this.#ready.resolve();
  }

  setCanvas(
    canvasManager: PixelArtCanvas
  ): void {
    if (canvasManager === this.#canvasManager) {
      return;
    }

    this.#canvasManager = canvasManager;
    if (this.#camera !== null) {
      this.#unbind();
      this.#binding = this.#bind(this.#camera);
    }
  }

  setAppearance(
    theme: ResolvedThemeMode
  ): void {
    const appearance = kSceneAppearances[theme];
    this.world.sceneManager.getSource().background = new THREE.Color(
      appearance.backgroundColor
    );
    this.#style.borderColor.set(appearance.borderColor);
  }

  setRotating(
    rotating: boolean
  ): void {
    this.#style.rotating = rotating;
  }

  override destroy(): void {
    this.#unbind();
  }

  #bind(
    camera: THREE.Camera
  ): CanvasBinding {
    const canvasManager = this.#canvasManager;
    const texture = new PixelCanvasTexture(canvasManager);
    const gallery = new RegionPreviewGallery({
      canvasManager,
      createPreview: (region, textureSize) => this.world
        .createActor(`uv-preview-${region.id}`)
        .addComponentAndGet(RegionPreviewBehavior, {
          canvasTexture: texture.texture,
          region,
          textureSize,
          style: this.#style
        })
    });
    texture.on("resized", () => gallery.refreshTextureSize());

    const picker = new RegionPreviewPicker({
      uv: canvasManager.uv,
      camera,
      canvas: this.world.renderer.canvas,
      getMeshes: () => gallery.meshes
    });

    return {
      texture,
      gallery,
      picker
    };
  }

  #unbind(): void {
    if (this.#binding === null) {
      return;
    }

    this.#binding.picker.dispose();
    this.#binding.gallery.dispose();
    this.#binding.texture.dispose();
    this.#binding = null;
  }
}
