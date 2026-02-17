// Import Third-party Dependencies
import { ActorComponent, Actor } from "@jolly-pixel/engine";
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

// Import Internal Dependencies
import { VoxelRenderer } from "../VoxelRenderer.ts";

export class RollOverRenderer extends ActorComponent {
  voxelRenderer: VoxelRenderer;

  material: LineMaterial;
  object: THREE.Object3D;

  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "ScriptBehavior"
    });

    const renderer = this.actor.components.find((component) => component.typeName === "VoxelRenderer");
    if (!renderer) {
      throw new Error("Unable to fetch VoxelRenderer behavior from actor");
    }
    this.voxelRenderer = renderer as VoxelRenderer;

    const size = this.voxelRenderer.ratio;
    const edges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(size, size, size)
    );

    this.material = new LineMaterial({
      color: new THREE.Color("rgba(8, 35, 68, 1)"),
      linewidth: 2,
      opacity: 0.55
    });

    this.object = new LineSegments2(
      new LineSegmentsGeometry().fromEdgesGeometry(edges),
      this.material
    );
    this.object.renderOrder = 0;
    this.object.position.set(0, 0, 0);
  }

  update() {
    const { input } = this.actor.world;

    const isMouseMoving = input.isMouseMoving();
    if (!isMouseMoving) {
      return;
    }

    const { raycaster, camera, ratio, tree } = this.voxelRenderer;
    raycaster.setFromCamera(
      this.actor.world.input.getMousePosition(),
      camera
    );

    const intersects = raycaster.intersectObjects(tree.selected.objects, false);
    if (intersects.length === 0) {
      return;
    }
    const intersection = intersects[0];

    this.object.position
      .copy(intersection.point)
      .add(intersection.face!.normal)
      .divideScalar(ratio)
      .floor()
      .multiplyScalar(ratio)
      .addScalar(ratio / 2);
  }
}
