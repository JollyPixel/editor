// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { Systems } from "@jolly-pixel/engine";

export interface SplashScreen {
  /**
   * The Scene instance that the splash screen manages.
   * loadRuntime() appends this to the SceneManager as an overlay.
   */
  readonly scene: Systems.Scene<any>;

  /**
   * Called once after the Scene has been appended and runtime.start() has been
   * called. Use this to perform any setup that requires the world to be connected
   * (e.g. loading textures via TextureLoader).
   */
  onSetup(world: Systems.World<THREE.WebGLRenderer, any>): void;

  /** Update the loading bar (loaded/total item counts). */
  onProgress(loaded: number, total: number): void;

  /** Update the current-asset label. */
  onAssetStart(asset: Systems.Asset): void;

  /** Switch to the error state. */
  onError(error: Error): void;

  /**
   * Called when all assets are loaded.
   * The implementation should display a "click / tap to start" prompt and
   * begin resolving waitForUserGesture().
   */
  onLoadComplete(): void;

  /**
   * Returns a Promise that resolves after the user has produced a pointer-down
   * or keydown event (the required user gesture for AudioContext unlock).
   */
  waitForUserGesture(): Promise<void>;

  /**
   * Trigger the outro animation and remove the scene.
   * Resolves when the transition is fully complete.
   */
  complete(): Promise<void>;
}
