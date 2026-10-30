// Import Third-party Dependencies
import type { TerrainPreview } from "@jolly-pixel/asset.terrain/client";
import { InputCombination } from "@jolly-pixel/controls";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type { TerrainRay } from "@jolly-pixel/terrain.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import type { GroundPoint } from "../brush/model/StampSpacer.ts";
import type { ChunkMode } from "./model/ChunkDrag.ts";
import {
  rayOnPlane,
  type ChunkTarget
} from "./model/chunkTarget.ts";
import { ChunkGhost } from "./rendering/ChunkGhost.ts";

// CONSTANTS
export const MAX_AIM_DISTANCE = 20_000;

export interface ChunkAim {
  readonly target: ChunkTarget;
  readonly mode: ChunkMode;
  readonly accepted: boolean;
}

export interface ChunkGesture {
  moveTo(point: GroundPoint): void;
  end(): void;
}

export interface ChunkDragStrategy {
  enabled(): boolean;
  aim(ray: TerrainRay, inverted: boolean): ChunkAim | null;
  begin(aim: ChunkAim): ChunkGesture;
}

export interface ChunkDragToolOptions {
  preview: Pick<TerrainPreview, "terrain">;
  camera: THREE.Camera;
  strategy: ChunkDragStrategy;
}

interface ActiveDrag {
  readonly gesture: ChunkGesture;
  readonly height: number;
}

export class ChunkDragTool extends ActorComponent {
  #options: ChunkDragToolOptions;
  #ghost = new ChunkGhost();
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #active: ActiveDrag | null = null;
  #keepAlive: (() => void) | null = null;

  constructor(
    actor: Actor,
    options: ChunkDragToolOptions
  ) {
    super({
      actor,
      typeName: "ChunkDragTool"
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
    const { strategy, preview } = this.#options;
    if (
      !strategy.enabled() ||
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
    const active = this.#active;
    if (active !== null) {
      const hit = rayOnPlane(ray, active.height, MAX_AIM_DISTANCE);
      if (hit !== null) {
        active.gesture.moveTo(hit.point);
      }
      this.#hideGhost();

      return;
    }

    const aim = strategy.aim(ray, InputCombination.Control.evaluate(input));
    if (aim === null) {
      this.#hideGhost();
    }
    else if (mouse.wasJustPressed("left")) {
      this.#active = { gesture: strategy.begin(aim), height: aim.target.height };
      this.#hideGhost();
    }
    else if (this.#ghost.show(preview.terrain, { ...aim.target, mode: aim.mode, accepted: aim.accepted })) {
      this.actor.world.invalidate();
    }
  }

  terrainChanged(): void {
    this.#ghost.terrainChanged();
  }

  endDrag(): void {
    this.#active?.gesture.end();
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
