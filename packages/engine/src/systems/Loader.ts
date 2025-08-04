// Import Third-party Dependencies
import * as THREE from "three";

export interface LoaderProvider {
  audio: THREE.AudioLoader;
}

export class GameInstanceDefaultLoader implements LoaderProvider {
  audio: THREE.AudioLoader;

  constructor(
    manager?: THREE.LoadingManager
  ) {
    this.audio = new THREE.AudioLoader(manager);
  }
}
