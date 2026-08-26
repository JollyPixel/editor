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
/**
 * Objects moved to this layer are drawn by the mirrors' virtual cameras only,
 * never by the scene camera itself.
 */
const kMirrorLayer = 1;
/**
 * The layer the walls live on, kept out of every virtual camera: a mirror
 * that could see the other three would reflect them endlessly, and each wall
 * would show a different depth of that corridor depending on render order.
 */
const kWallLayer = 2;
/**
 * One entry per wall, as a fraction of half the room. `rotationY` turns the
 * plane's reflective side (local `+Z`) back toward the room center.
 */
const kWalls = [
  { x: 0, z: -1, rotationY: 0 },
  { x: 0, z: 1, rotationY: Math.PI },
  { x: -1, z: 0, rotationY: Math.PI / 2 },
  { x: 1, z: 0, rotationY: -Math.PI / 2 }
] as const;

export interface MirrorRoomOptions {
  /**
   * Side of the square room, in world units.
   * @default 20
   */
  size?: number;
  /**
   * Wall height, in world units. Walls stand on `y = 0`.
   * @default 8
   */
  height?: number;
  /**
   * Reflection render-target size, as a fraction of the drawing buffer.
   * Below `1` the reflection is upscaled, which shows badly on the thin
   * lines a frustum is made of.
   * @default 1
   */
  resolutionScale?: number;
  /**
   * MSAA samples of the reflection render target. `0` disables it, and
   * leaves every reflected edge stair-stepped.
   * @default 4
   */
  samples?: number;
  /**
   * Glass tint mixed into every reflection.
   * @default "#7fa6b2"
   */
  tint?: THREE.ColorRepresentation;
  /**
   * How much of `tint` the reflection takes, from `0` (plain mirror) to `1`
   * (flat color).
   * @default 0.12
   */
  tintStrength?: number;
  /**
   * Color the reflection fades into toward the top of a wall. Set it to the
   * scene background, or the fade turns into a visible band.
   * @default "#1e2a30"
   */
  backdrop?: THREE.ColorRepresentation;
  /**
   * Height at which the fade to `backdrop` starts, from `0` (floor) to `1`
   * (top edge). `1` leaves the wall cut off with a hard line.
   * @default 0.35
   */
  fadeStart?: number;
}

export interface MirrorRoom {
  /**
   * Holds the four walls. Add it to the scene; toggling its `visible` flag
   * stops the reflection passes too.
   */
  group: THREE.Group;
  /**
   * Moves `object` and its current descendants to the mirror-only layer, so
   * they show up in the reflections but not in the direct view. Call it again
   * after adding children.
   */
  showOnlyInMirrors: (object: THREE.Object3D) => void;
  dispose: () => void;
}

/**
 * Four inward-facing mirror walls forming a square room around the origin.
 *
 * `camera` is the camera the scene is rendered with: each wall derives its
 * own virtual camera from it, and only those virtual cameras see the objects
 * passed to `showOnlyInMirrors`. Its layer mask is edited, and restored by
 * `dispose`.
 */
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
    // Tinted reflection at eye level, dissolving into the backdrop toward
    // the top so the wall has no hard upper edge.
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
    // The reflector reads its mirror plane from `target.matrixWorld`, and a
    // `PlaneGeometry` already faces local `+Z`: parenting the target to the
    // wall keeps the two in sync without duplicating the transform.
    mesh.add(reflection.target);
    group.add(mesh);

    // The virtual camera is cloned from `camera` on first use, layer mask
    // included, so its two opt-outs from the scene camera's view have to be
    // applied here rather than on `camera`.
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
