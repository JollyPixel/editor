// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type {
  BindingChangeEvent,
  FacadeFolder
} from "@jolly-pixel/ui/facade";
import "@jolly-pixel/ui/elements/control";
import "@jolly-pixel/ui/elements/controls";
import "@jolly-pixel/ui/elements/scope";

// Import Internal Dependencies
import {
  AudioGizmo,
  CameraGizmo,
  type CameraGizmoLens,
  Grid,
  LightGizmo,
  StudioSky
} from "../../src/index.ts";
import {
  createExample,
  orbitCamera
} from "../shared/example.ts";
import { CameraView } from "./camera-view.ts";

// CONSTANTS
const kAspectOptions: Record<string, number> = {
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "1:1": 1,
  "9:16": 9 / 16
};
const kDistanceRange = {
  min: 0,
  max: 12,
  step: 0.5
};
const kSunRadius = 5;
const kSunHeight = 4;
const kSpotTarget = new THREE.Vector3(2, 0, -1);
const kSpotSweep = 1.5;
const kCameraRadius = 7;
const kCameraHeight = 2.5;
const kCameraTarget = new THREE.Vector3(0, 0.5, 0);
const kSpeakerRadius = 3.5;
const kUp = new THREE.Vector3(0, 1, 0);
const kLookAt = new THREE.Matrix4();

const { renderer, scene, camera, pane, start } = await createExample({
  title: "Scene Gizmos",
  camera: orbitCamera(
    { x: 9, y: 6, z: 9 },
    { x: 0, y: 0.5, z: 0 }
  )
});

scene.background = null;
scene.backgroundNode = new StudioSky("dark").node;

const helpers = new THREE.Group();
helpers.add(new Grid());
scene.add(helpers);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({
    color: "#4b505c"
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;

const centerBox = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({
    color: "#4a90d9"
  })
);
centerBox.position.y = 0.5;

const occluder = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 2, 1.2),
  new THREE.MeshStandardMaterial({
    color: "#c8ccd4"
  })
);
occluder.position.set(-1, 1, -1);
scene.add(ground, centerBox, occluder);

const sun = new THREE.DirectionalLight("#fff4e0", 1.5);

const spot = new THREE.SpotLight(
  "#7fb2ff",
  40,
  9,
  THREE.MathUtils.degToRad(28),
  0.35
);
spot.position.set(4, 5, -3);

const point = new THREE.PointLight("#ff9a4d", 12, 5);
point.position.set(-3, 1.5, 3);

const hemisphere = new THREE.HemisphereLight("#cfe3ff", "#3a3328", 0.6);
hemisphere.position.set(-2, 1, -2);

const ambient = new THREE.AmbientLight("#ffffff", 0.15);
ambient.position.set(3, 1.5, 4);

scene.add(
  sun,
  sun.target,
  spot,
  spot.target,
  point,
  hemisphere,
  ambient
);

const lightGizmos = new Map<THREE.Light, LightGizmo>();

const lens: CameraGizmoLens = {
  projection: "perspective",
  fov: 50,
  near: 0.5,
  far: 30,
  orthographicScale: 4
};
const cameraStyle = {
  color: "#aab4c3",
  aspect: 16 / 9,
  depth: 3
};
const cameraState = {
  selected: false,
  scale: 1
};
const cameraActor = new THREE.Object3D();
let cameraGizmo = new CameraGizmo(cameraStyle);
helpers.add(cameraGizmo);

const cameraView = new CameraView(renderer, cameraStyle.aspect);

const speaker = {
  color: "#8fe3a1",
  position: new THREE.Vector3()
};
const audioGizmo = new AudioGizmo();
helpers.add(audioGizmo);

const settings = {
  animate: true
};
const timer = new THREE.Timer();
let elapsed = 0;

function update(): void {
  timer.update();
  if (settings.animate) {
    elapsed += timer.getDelta();
  }

  animate(elapsed);
  for (const [light, gizmo] of lightGizmos) {
    gizmo.update(light);
  }
  cameraGizmo.update(lens, cameraActor.matrixWorld);
  audioGizmo.update(speaker.position, speaker.color);
}

function animate(
  seconds: number
): void {
  const sunAngle = seconds * 0.3;
  sun.position.set(
    Math.cos(sunAngle) * kSunRadius,
    kSunHeight,
    Math.sin(sunAngle) * kSunRadius
  );

  spot.target.position.set(
    kSpotTarget.x + (Math.cos(seconds * 0.8) * kSpotSweep),
    kSpotTarget.y,
    kSpotTarget.z + (Math.sin(seconds * 0.8) * kSpotSweep)
  );

  point.position.y = 1.5 + (Math.sin(seconds * 1.2) * 0.75);

  const speakerAngle = -seconds * 0.5;
  speaker.position.set(
    Math.cos(speakerAngle) * kSpeakerRadius,
    1,
    Math.sin(speakerAngle) * kSpeakerRadius
  );

  const cameraAngle = (seconds * 0.15) + (Math.PI / 4);
  cameraActor.position.set(
    Math.cos(cameraAngle) * kCameraRadius,
    kCameraHeight,
    Math.sin(cameraAngle) * kCameraRadius
  );
  kLookAt.lookAt(cameraActor.position, kCameraTarget, kUp);
  cameraActor.quaternion.setFromRotationMatrix(kLookAt);
  cameraActor.scale.setScalar(cameraState.scale);
  cameraActor.updateMatrixWorld();
}

function render(): void {
  renderer.render(scene, camera);

  helpers.visible = false;
  cameraView.render(scene, lens, cameraActor.matrixWorld);
  helpers.visible = true;
}

function rebuildCameraGizmo(
  { last }: BindingChangeEvent<unknown>
): void {
  if (!last) {
    return;
  }

  helpers.remove(cameraGizmo);
  cameraGizmo.dispose();

  cameraGizmo = new CameraGizmo(cameraStyle);
  cameraGizmo.selected = cameraState.selected;
  helpers.add(cameraGizmo);
  cameraView.resize(cameraStyle.aspect);
}

const sceneFolder = pane.addFolder({
  title: "Scene"
});
sceneFolder.addBinding(settings, "animate");
sceneFolder.addBinding(cameraView, "visible", {
  label: "camera view"
});
sceneFolder
  .addBinding({ selectAll: false }, "selectAll", {
    label: "select all"
  })
  .on("change", ({ value }) => {
    for (const gizmo of lightGizmos.values()) {
      gizmo.selected = value;
    }
    audioGizmo.selected = value;
    cameraState.selected = value;
    cameraGizmo.selected = value;
    pane.refresh();
  });

const cameraFolder = pane.addFolder({
  title: "Camera"
});
cameraFolder
  .addBinding(cameraState, "selected")
  .on("change", ({ value }) => {
    cameraGizmo.selected = value;
  });
cameraFolder.addBinding(lens, "projection", {
  options: {
    Perspective: "perspective",
    Orthographic: "orthographic"
  }
});
cameraFolder.addBinding(lens, "fov", {
  min: 10,
  max: 120,
  step: 1
});
cameraFolder.addBinding(lens, "near", {
  min: 0.05,
  max: 5,
  step: 0.05
});
cameraFolder.addBinding(lens, "far", {
  min: 1,
  max: 50,
  step: 0.5
});
cameraFolder.addBinding(lens, "orthographicScale", {
  min: 0.5,
  max: 12,
  step: 0.1
});
cameraFolder.addBinding(cameraState, "scale", {
  label: "actor scale",
  min: 0.25,
  max: 4,
  step: 0.05
});
cameraFolder.addSeparator();
cameraFolder
  .addBinding(cameraStyle, "color")
  .on("change", rebuildCameraGizmo);
cameraFolder
  .addBinding(cameraStyle, "aspect", {
    options: kAspectOptions
  })
  .on("change", rebuildCameraGizmo);
cameraFolder
  .addBinding(cameraStyle, "depth", {
    min: 0.5,
    max: 10,
    step: 0.5
  })
  .on("change", rebuildCameraGizmo);

function addLight(
  title: string,
  light: THREE.Light,
  maxIntensity: number
): FacadeFolder {
  const gizmo = new LightGizmo();
  helpers.add(gizmo);
  lightGizmos.set(light, gizmo);

  const folder = pane.addFolder({
    title,
    expanded: false
  });
  folder.addBinding(gizmo, "selected");
  folder
    .addBinding({ color: `#${light.color.getHexString()}` }, "color")
    .on("change", ({ value }) => {
      light.color.set(value);
    });
  folder.addBinding(light, "intensity", {
    min: 0,
    max: maxIntensity,
    step: maxIntensity / 100
  });

  return folder;
}

addLight("Directional", sun, 5);

const spotFolder = addLight("Spot", spot, 100);
spotFolder.addBinding(spot, "distance", kDistanceRange);
spotFolder
  .addBinding({ angle: THREE.MathUtils.radToDeg(spot.angle) }, "angle", {
    min: 1,
    max: 89,
    step: 1
  })
  .on("change", ({ value }) => {
    spot.angle = THREE.MathUtils.degToRad(value);
  });

addLight("Point", point, 40)
  .addBinding(point, "distance", kDistanceRange);
addLight("Hemisphere", hemisphere, 3);
addLight("Ambient", ambient, 2);

const audioFolder = pane.addFolder({
  title: "Audio",
  expanded: false
});
audioFolder.addBinding(audioGizmo, "selected");
audioFolder.addBinding(speaker, "color");

start({
  update,
  render
});
