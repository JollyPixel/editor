// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponent,
  Actor,
  Components
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { VoxelShapes } from "./shapes/index.js";
import {
  GridRenderer,
  RollOverRenderer
} from "./components/index.js";

export interface VoxelRendererOptions {
  ratio?: number;
  cameraActorName?: string;
}

export class VoxelRenderer extends ActorComponent {
  camera: THREE.PerspectiveCamera;

  raycaster = new THREE.Raycaster();
  lastIntersect: THREE.Intersection<THREE.Object3D> | null = null;
  objects: THREE.Object3D[] = [];
  plane: THREE.Mesh;

  ratio: number = 50;

  debug = false;

  constructor(
    actor: Actor,
    options: VoxelRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "VoxelRenderer"
    });
    const { cameraActorName = "camera", ratio = 50 } = options;

    this.ratio = ratio;
    const behavior = JP.getActor(cameraActorName)?.getBehavior(Components.Camera3DControls);
    if (!behavior) {
      throw new Error(`Unable to fetch camera behavior from actor with name <${cameraActorName}>`);
    }

    this.camera = behavior.camera;
  }

  awake() {
    const { threeScene } = this.actor.gameInstance;
    threeScene.background = new THREE.Color("#e7f2ff");

    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(this.ratio * 100, this.ratio * 100)
        .rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ visible: this.debug })
    );
    this.objects.push(this.plane);

    threeScene.add(
      this.plane,
      new THREE.AmbientLight(0x606060, 3)
    );

    this.actor.registerComponent(GridRenderer, { ratio: this.ratio });
    this.actor.registerComponent(RollOverRenderer, void 0, (component) => {
      threeScene.add(component.object);
    });
  }

  remove(
    intersect: THREE.Intersection<THREE.Object3D>
  ) {
    if (intersect.object !== this.plane) {
      this.actor.gameInstance.threeScene.remove(intersect.object);
      this.objects.splice(this.objects.indexOf(intersect.object), 1);
    }
  }

  create(
    intersect: THREE.Intersection<THREE.Object3D>
  ) {
    const textures = [
      "textures/cube.png",
      "textures/cube2.png",
      "textures/cube3.png"
    ];

    const voxel = new VoxelShapes.Slope({
      size: this.ratio,
      // color: 0x00ff00
      texture: textures[Math.floor(Math.random() * textures.length)]
    }).setPositionFromIntersection(intersect);

    this.actor.gameInstance.threeScene.add(voxel);
    this.objects.push(voxel);
  }

  update() {
    const { input } = this.actor.gameInstance;

    const isAnyMouseButtonsPressed = input.wasMouseButtonJustPressed("ANY");
    if (!isAnyMouseButtonsPressed) {
      return;
    }

    this.raycaster.setFromCamera(
      this.actor.gameInstance.input.getMousePosition(),
      this.camera
    );

    const intersects = this.raycaster.intersectObjects(this.objects, false);
    if (intersects.length === 0) {
      return;
    }
    const object = intersects[0];

    if (input.wasMouseButtonJustPressed("right")) {
      this.remove(object);
    }
    else if (input.wasMouseButtonJustPressed("left") && object !== this.lastIntersect) {
      this.create(object);
    }

    this.lastIntersect = object;
  }
}
