// Import Third-party Dependencies
import { followCameraPreferences } from "@jolly-pixel/editor.host/viewport";
import {
  MESH_GEOMETRY_DEFAULTS,
  MeshRenderer,
  OrbitFlyCamera,
  Systems,
  type Actor,
  type MeshGeometry,
  type MeshGeometryKind,
  type Shader
} from "@jolly-pixel/engine";
import type { EditorContext } from "@jolly-pixel/editor.host";
import { Teardown } from "@jolly-pixel/utils";
import * as THREE from "three/webgpu";

export interface ShaderPreviewSceneOptions {
  preferences: EditorContext["preferences"];
  geometry: MeshGeometryKind;
}

export interface ShaderBuild {
  fragment: string;
  vertex: string;
}

interface PreviewShape {
  geometry: MeshGeometry;
  rotation: THREE.Euler;
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
const kStanding = new THREE.Euler();
const kPlaneShape: PreviewShape = {
  geometry: {
    ...MESH_GEOMETRY_DEFAULTS.plane,
    width: 6,
    height: 6
  },
  rotation: new THREE.Euler(-Math.PI / 2, 0, 0)
};

export class ShaderPreviewScene extends Systems.Scene {
  #preferences: EditorContext["preferences"];
  #teardown = new Teardown();
  #actor: Actor | null = null;
  #shape: PreviewShape;
  #size = 1;
  #camera: OrbitFlyCamera | null = null;
  #renderer: MeshRenderer<unknown> | null = null;
  #shader: Shader | null = null;

  constructor(
    options: ShaderPreviewSceneOptions
  ) {
    super("shader-preview");
    this.#preferences = options.preferences;
    this.#shape = previewShape(options.geometry);
  }

  override awake(): void {
    const { world } = this;

    const environment = world.sceneManager.graph.createEnvironment(world);
    environment.apply(Systems.ENVIRONMENT_PRESETS.studio);

    this.#camera = world
      .createActor("preview-camera")
      .addComponentAndGet(OrbitFlyCamera, kCameraPreset);
    this.#actor = world.createActor("preview-mesh");
    this.#present();

    const teardown = this.#teardown;
    teardown.defer(() => environment.dispose());
    teardown.defer(followCameraPreferences(this.#camera, this.#preferences));
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
    geometry: MeshGeometryKind
  ): void {
    this.#shape = previewShape(geometry);
    this.#renderer?.configure({
      geometry: this.#shape.geometry
    });
    this.#place();
  }

  rescale(
    size: number
  ): void {
    const camera = this.#camera;
    if (camera !== null) {
      const ratio = size / this.#size;
      camera.worldScale = size;
      camera.teleport({
        position: camera.camera.getWorldPosition(new THREE.Vector3()).multiplyScalar(ratio),
        quaternion: camera.camera.getWorldQuaternion(new THREE.Quaternion())
      });
    }
    this.#size = size;
    this.#place();
  }

  #present(): void {
    if (this.#actor === null) {
      return;
    }

    this.#renderer?.destroy();
    this.#renderer = this.#actor.addComponentAndGet(MeshRenderer, {
      geometry: this.#shape.geometry,
      shader: this.#shader
    });
    this.#place();
  }

  #place(): void {
    if (this.#actor === null) {
      return;
    }

    const { local } = this.#actor.transform;
    local.eulerAngles = this.#shape.rotation;
    local.scale = {
      x: this.#size,
      y: this.#size,
      z: this.#size
    };
    this.world.invalidate();
  }

  override destroy(): void {
    this.#teardown.run();
    this.#renderer?.destroy();
    super.destroy();
  }
}

function previewShape(
  kind: MeshGeometryKind
): PreviewShape {
  if (kind === "plane") {
    return kPlaneShape;
  }

  return {
    geometry: MESH_GEOMETRY_DEFAULTS[kind],
    rotation: kStanding
  };
}
