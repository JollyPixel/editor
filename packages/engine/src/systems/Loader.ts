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
  audio = new THREE.AudioLoader();
  objLoader = new OBJLoader();
  mtlLoader = new MTLLoader();
}
