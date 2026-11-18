// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import "@jolly-pixel/ui/elements/control";
import "@jolly-pixel/ui/elements/controls";
import "@jolly-pixel/ui/elements/scope";

// Import Internal Dependencies
import {
  Grid,
  StudioSky,
  type SkyBackdrop
} from "../../src/index.ts";
import {
  createExample,
  orbitCamera
} from "../shared/example.ts";

// CONSTANTS
const kSkies: Record<SkyBackdrop, StudioSky> = {
  dark: new StudioSky("dark"),
  light: new StudioSky("light")
};
const kProps: Array<Prop> = [
  {
    size: [1, 1, 1],
    position: [0, 0.5, 0],
    color: "#4a90d9"
  },
  {
    size: [0.6, 3, 0.6],
    position: [-2.5, 1.5, -1.5],
    color: "#d98a4a"
  },
  {
    size: [1.6, 0.4, 1.6],
    position: [2.5, 0.2, 1],
    color: "#7cc46b"
  }
];

interface Prop {
  size: THREE.Vector3Tuple;
  position: THREE.Vector3Tuple;
  color: string;
}

interface SkySettings {
  backdrop: SkyBackdrop;
  gradient: boolean;
  fov: number;
}

const { scene, camera, pane, start } = await createExample({
  title: "Studio Sky",
  camera: orbitCamera(
    { x: 7, y: 2.5, z: 7 },
    { x: 0, y: 1, z: 0 }
  )
});

const settings: SkySettings = {
  backdrop: "dark",
  gradient: true,
  fov: camera.fov
};

const sun = new THREE.DirectionalLight("#ffffff", 2);
sun.position.set(-4, 8, 5);
scene.add(
  sun,
  new THREE.HemisphereLight("#dceaff", "#30343c", 0.8),
  new Grid()
);

for (const prop of kProps) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...prop.size),
    new THREE.MeshStandardMaterial({
      color: prop.color
    })
  );
  mesh.position.set(...prop.position);
  scene.add(mesh);
}

function applySky(): void {
  scene.backgroundNode = settings.gradient ?
    kSkies[settings.backdrop].node :
    null;
}

const skyFolder = pane.addFolder({
  title: "Sky"
});
skyFolder
  .addBinding(settings, "backdrop", {
    options: {
      Dark: "dark",
      Light: "light"
    }
  })
  .on("change", applySky);
skyFolder
  .addBinding(settings, "gradient")
  .on("change", applySky);

const viewFolder = pane.addFolder({
  title: "View"
});
viewFolder
  .addBinding(settings, "fov", {
    min: 20,
    max: 120,
    step: 1
  })
  .on("change", ({ value }) => {
    camera.fov = value;
    camera.updateProjectionMatrix();
  });

applySky();
start();
