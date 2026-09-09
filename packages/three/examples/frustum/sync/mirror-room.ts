// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  color,
  mix,
  nodeObject,
  reflector,
  smoothstep,
  uv
} from "three/tsl";

// CONSTANTS
const kDefaultSize = 20;
const kDefaultHeight = 8;
const kDefaultResolutionScale = 1;
const kDefaultSamples = 4;
const kDefaultTint = "#7fa6b2";
const kDefaultTintStrength = 0.12;
const kDefaultBackdrop = "#1e2a30";
const kDefaultFadeStart = 0.35;
const kMirrorLayer = 1;
const kWallLayer = 2;
const kWalls = [
  { x: 0, z: -1, rotationY: 0 },
  { x: 0, z: 1, rotationY: Math.PI },
  { x: -1, z: 0, rotationY: Math.PI / 2 },
  { x: 1, z: 0, rotationY: -Math.PI / 2 }
] as const;

export interface MirrorRoomOptions {
  size?: number;

  height?: number;

  resolutionScale?: number;

  samples?: number;

  tint?: THREE.ColorRepresentation;

  tintStrength?: number;

  backdrop?: THREE.ColorRepresentation;

  fadeStart?: number;
}

export interface MirrorRoom {
  group: THREE.Group;

  showOnlyInMirrors: (object: THREE.Object3D) => void;
  dispose: () => void;
}

export function createMirrorRoom(
  camera: THREE.Camera,
  options: MirrorRoomOptions = {}
): MirrorRoom {
  const {
    size = kDefaultSize,
    height = kDefaultHeight,
    resolutionScale = kDefaultResolutionScale,
    samples = kDefaultSamples,
    tint = kDefaultTint,
    tintStrength = kDefaultTintStrength,
    backdrop = kDefaultBackdrop,
    fadeStart = kDefaultFadeStart
  } = options;

  const tintColor = new THREE.Color(tint);
  const backdropColor = new THREE.Color(backdrop);
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(size, height);
  const reflections: ReturnType<typeof reflector>[] = [];
  const materials: THREE.MeshBasicNodeMaterial[] = [];

  for (const wall of kWalls) {
    const reflection = reflector({
      resolutionScale,
      samples,
      bounces: false
    });
    const material = new THREE.MeshBasicNodeMaterial();

    material.colorNode = mix(
      mix(
        nodeObject(reflection).rgb,
        color(tintColor),
        tintStrength
      ),
      color(backdropColor),
      smoothstep(fadeStart, 1, uv().y)
    );

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      wall.x * size / 2,
      height / 2,
      wall.z * size / 2
    );
    mesh.rotation.y = wall.rotationY;
    mesh.layers.set(kWallLayer);

    mesh.add(reflection.target);
    group.add(mesh);

    const virtualCamera = reflection.reflector.getVirtualCamera(camera);
    virtualCamera.layers.enable(kMirrorLayer);
    virtualCamera.layers.disable(kWallLayer);

    reflections.push(reflection);
    materials.push(material);
  }

  camera.layers.enable(kWallLayer);

  return {
    group,
    showOnlyInMirrors(object) {
      object.traverse((child) => child.layers.set(kMirrorLayer));
    },
    dispose() {
      camera.layers.disable(kWallLayer);
      geometry.dispose();
      for (const material of materials) {
        material.dispose();
      }
      for (const reflection of reflections) {
        reflection.dispose();
      }
      group.clear();
    }
  };
}
