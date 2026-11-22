// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/ecs";
import type * as THREE from "three/webgpu";

export type ThreeComponentPackage = Systems.ComponentPackage<
  THREE.LoadingManager
>;
