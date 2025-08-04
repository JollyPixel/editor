// Import Third-party Dependencies
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

export interface LoaderProvider {
  audio: THREE.AudioLoader;
  objLoader: OBJLoader;
  mtlLoader: MTLLoader;
}

export class GameInstanceDefaultLoader implements LoaderProvider {
  audio: THREE.AudioLoader;
  objLoader: OBJLoader;
  mtlLoader: MTLLoader;

  constructor(
    manager?: THREE.LoadingManager
  ) {
    this.audio = new THREE.AudioLoader(manager);
    this.objLoader = new OBJLoader(manager);
    this.mtlLoader = new MTLLoader(manager);
  }
}
