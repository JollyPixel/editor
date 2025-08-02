// Import Third-party Dependencies
import * as THREE from "three";

export interface LoaderProvider {
  audio: THREE.AudioLoader;
}

export class GameInstanceDefaultLoader implements LoaderProvider {
  audio = new THREE.AudioLoader();
}
