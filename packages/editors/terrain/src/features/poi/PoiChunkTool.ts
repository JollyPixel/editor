// Import Third-party Dependencies
import type {
  TerrainDocument,
  TerrainPreview
} from "@jolly-pixel/asset.terrain/client";
import { InputCombination } from "@jolly-pixel/controls";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  raycastTerrain,
  type TerrainRay
} from "@jolly-pixel/terrain.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import type { TerrainHistory } from "../../shared/terrainHistory.ts";
import {
  rayOnPlane,
  surfaceTarget
} from "../chunks/model/chunkTarget.ts";
import { ChunkGhost } from "../chunks/rendering/ChunkGhost.ts";
import {
  PoiChunkDrag,
  type PoiChunkMode
} from "./model/PoiChunkDrag.ts";
import type { PoiSelection } from "./model/PoiSelection.ts";

// CONSTANTS
const kMaxAimDistance = 20_000;

export interface PoiChunkToolOptions {
  document: Pick<TerrainDocument, "terrain" | "pointsOfInterest" | "updatePointOfInterest">;
  preview: Pick<TerrainPreview, "terrain">;
  selection: Pick<PoiSelection, "selected" | "editing">;
  history: Pick<TerrainHistory, "open">;
  camera: THREE.Camera;
}

interface ActiveDrag {
  readonly drag: PoiChunkDrag;
  readonly height: number;
}

export class PoiChunkTool extends ActorComponent {
  #options: PoiChunkToolOptions;
  #ghost = new ChunkGhost();
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #active: ActiveDrag | null = null;
  #keepAlive: (() => void) | null = null;

  constructor(
    actor: Actor,
    options: PoiChunkToolOptions
  ) {
    super({
      actor,
      typeName: "PoiChunkTool"
    });

    this.#options = options;
  }

  awake(): void {
    this.actor.object3D.add(this.#ghost);
    this.#keepAlive = this.actor.world.keepAlive(() => this.#active !== null);
  }

  update(): void {
    const { input } = this.actor.world;
    const { mouse } = input;
    const { selected, editing } = this.#options.selection;
    if (
      selected === null ||
      !editing ||
      !mouse.hovering ||
      mouse.isDown("middle") ||
      InputCombination.Alt.evaluate(input)
    ) {
      this.endDrag();
      this.#hideGhost();

      return;
    }
    if (this.#active !== null && !mouse.isDown("left")) {
      this.endDrag();
    }

    const ray = this.#ray();
    if (this.#active !== null) {
      const hit = rayOnPlane(ray, this.#active.height, kMaxAimDistance);
      if (hit !== null) {
        this.#active.drag.moveTo(hit.point);
      }
      this.#hideGhost();

      return;
    }

    const { document, preview } = this.#options;
    const mode: PoiChunkMode = InputCombination.Control.evaluate(input) ? "remove" : "add";
    const surface = raycastTerrain(preview.terrain, ray, { maxDistance: kMaxAimDistance, hitHoles: true });
    const target = surface === null ? null : surfaceTarget(document.terrain, surface);
    if (target === null) {
      this.#hideGhost();
    }
    else if (mouse.wasJustPressed("left")) {
      this.#active = {
        drag: new PoiChunkDrag(this.#options, { id: selected, mode }, target.point),
        height: target.height
      };
      this.#hideGhost();
    }
    else {
      const named = document.pointsOfInterest.pointOfInterest(selected)?.chunks
        .some(({ x, z }) => x === target.coord.x && z === target.coord.z) ?? false;
      const accepted = mode === "add" ? !named : named;
      if (this.#ghost.show(preview.terrain, { ...target, mode, accepted })) {
        this.actor.world.invalidate();
      }
    }
  }

  terrainChanged(): void {
    this.#ghost.terrainChanged();
  }

  endDrag(): void {
    this.#active?.drag.end();
    this.#active = null;
  }

  override destroy(): void {
    this.endDrag();
    this.#keepAlive?.();
    this.actor.object3D.remove(this.#ghost);
    this.#ghost.dispose();

    super.destroy();
  }

  #ray(): TerrainRay {
    this.actor.world.input.mouse.viewportPositionTo(this.#pointer);
    this.#raycaster.setFromCamera(this.#pointer, this.#options.camera);

    return this.#raycaster.ray;
  }

  #hideGhost(): void {
    if (this.#ghost.hide()) {
      this.actor.world.invalidate();
    }
  }
}
