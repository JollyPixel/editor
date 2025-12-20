// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponent,
  Actor,
  Camera3DControls,
  createViewHelper
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { VoxelShapes } from "./shapes/index.ts";
import {
  GridRenderer,
  RollOverRenderer
} from "./components/index.ts";
import { LayerTree } from "./LayerTree.ts";

export interface VoxelRendererOptions {
  ratio?: number;
  cameraActorName?: string;
}

export class VoxelRenderer extends ActorComponent {
  camera: THREE.PerspectiveCamera;

  raycaster = new THREE.Raycaster();
  lastIntersect: THREE.Intersection<THREE.Object3D> | null = null;
  plane: THREE.Mesh;

  tree = new LayerTree();

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
    const behavior = this.actor.gameInstance.scene.tree
      .getActor(cameraActorName)
      ?.getBehavior(Camera3DControls);
    if (!behavior) {
      throw new Error(`Unable to fetch camera behavior from actor with name <${cameraActorName}>`);
    }

    this.camera = behavior.camera;
  }

  awake() {
    const threeScene = this.actor.gameInstance.scene.getSource();
    threeScene.background = new THREE.Color("#e7f2ff");

    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(this.ratio * 100, this.ratio * 100)
        .rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ visible: this.debug })
    );
    this.tree.root.objects.push(this.plane);

    threeScene.add(
      this.plane,
      new THREE.AmbientLight(new THREE.Color("#ffffff"), 3)
    );

    this.actor.registerComponent(GridRenderer, { ratio: this.ratio });
    this.actor.registerComponent(RollOverRenderer, void 0, (component) => {
      threeScene.add(component.object);
    });

    createViewHelper(this.camera, this.actor.gameInstance);
  }

  remove(
    intersect: THREE.Intersection<THREE.Object3D>
  ) {
    if (intersect.object !== this.plane) {
      this.actor.gameInstance.scene.getSource().remove(intersect.object);
      this.tree.remove(intersect.object);
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

    const voxel = new VoxelShapes.Cube({
      size: this.ratio,
      // color: 0x00ff00
      texture: textures[Math.floor(Math.random() * textures.length)]
    }).setPositionFromIntersection(intersect);

    this.actor.gameInstance.scene.getSource().add(voxel);
    this.tree.add(voxel);
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

    const intersects = this.raycaster.intersectObjects(this.tree.selected.objects, false);
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
