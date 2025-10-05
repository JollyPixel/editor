// Import Third-party Dependencies
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// CONSTANTS
const kSection = document.querySelector("section") as HTMLDivElement;
const kBoundingRect = kSection.getBoundingClientRect();

const renderer = new THREE.WebGLRenderer();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, kBoundingRect.width / kBoundingRect.height, 0.1, 1000);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

renderer.setSize(kBoundingRect.width, kBoundingRect.height);
kSection.appendChild(renderer.domElement);

function animate() {
  renderer.render(scene, camera);
  controls.update();
}
renderer.setAnimationLoop(animate);
