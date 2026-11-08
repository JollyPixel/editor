// Import Third-party Dependencies
import { followCameraPreferences } from "@jolly-pixel/editor.host/viewport";
import {
  MeshRenderer,
  OrbitFlyCamera,
  Systems,
  type Actor,
  type MeshGeometry,
  type Shader
} from "@jolly-pixel/engine";
import type { EditorContext } from "@jolly-pixel/editor.host";
import { Teardown } from "@jolly-pixel/utils";
import * as THREE from "three/webgpu";

export interface ShaderPreviewSceneOptions {
  preferences: EditorContext["preferences"];
  geometry: MeshGeometry;
}

export interface ShaderBuild {
  fragment: string;
  vertex: string;
}

// CONSTANTS
const kCameraPreset = {
  focusMode: "lock",
  position: { x: 1.8, y: 1.4, z: 2.4 },
  pitch: -0.45,
  yaw: 0.6,
  moveSpeed: 2,
  minMoveSpeed: 0.25,
  maxMoveSpeed: 10,
  minPivotDistance: 0.5,
  maxPivotDistance: 20,
  pivotNudgeStep: 0.25,
  pivotMarkerSize: 0.05
} as const;

export class ShaderPreviewScene extends Systems.Scene {
  #options: ShaderPreviewSceneOptions;
  #teardown = new Teardown();
  #actor: Actor | null = null;
  #camera: OrbitFlyCamera | null = null;
  #renderer: MeshRenderer<unknown> | null = null;
  #shader: Shader | null = null;

  constructor(
    options: ShaderPreviewSceneOptions
  ) {
    super("shader-preview");
    this.#options = options;
  }

  override awake(): void {
    const { world } = this;
    const scene = world.sceneManager.graph.scene;

    const hemisphere = new THREE.HemisphereLight("#dfe8ff", "#3b3328", 1.2);
    const key = new THREE.DirectionalLight("#ffffff", 2);
    key.position.set(4, 8, 5);
    scene.add(hemisphere, key);

    const environment = world.sceneManager.graph.createEnvironment(world);
    environment.apply({
      background: null,
      environment: {
        kind: "room",
        intensity: 0.6
      },
      fog: {
        kind: "none"
      }
    });

    this.#camera = world
      .createActor("preview-camera")
      .addComponentAndGet(OrbitFlyCamera, kCameraPreset);
    this.#actor = world.createActor("preview-mesh");
    this.#present();

    const teardown = this.#teardown;
    teardown.defer(() => scene.remove(hemisphere, key));
    teardown.defer(() => environment.dispose());
    teardown.defer(world.keepAlive(() => this.#shader !== null));
    teardown.defer(followCameraPreferences(this.#camera, this.#options.preferences));
  }

  async build(
    shader: Shader
  ): Promise<ShaderBuild> {
    const camera = this.#camera;
    if (camera === null) {
      throw new Error("ShaderPreviewScene: the scene is not awake.");
    }

    const { world } = this;
    const probe = new THREE.Mesh(
      new THREE.SphereGeometry(),
      shader.createMaterial().material
    );
    try {
      const { fragmentShader, vertexShader } = await world.renderer.source
        .debug.getShaderAsync(world.sceneManager.graph.scene, camera.threeCamera, probe);

      return {
        fragment: fragmentShader,
        vertex: vertexShader
      };
    }
    finally {
      probe.geometry.dispose();
      probe.material.dispose();
    }
  }

  show(
    shader: Shader
  ): void {
    this.#shader = shader;
    this.#present();
  }

  reshape(
    geometry: MeshGeometry
  ): void {
    this.#options.geometry = geometry;
    this.#present();
  }

  #present(): void {
    if (this.#actor === null) {
      return;
    }

    this.#renderer?.destroy();
    this.#renderer = this.#actor.addComponentAndGet(MeshRenderer, {
      geometry: this.#options.geometry,
      shader: this.#shader
    });
    this.world.invalidate();
  }

  override destroy(): void {
    this.#teardown.run();
    this.#renderer?.destroy();
    super.destroy();
  }
}
