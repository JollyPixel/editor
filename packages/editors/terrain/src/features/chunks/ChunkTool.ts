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
import type { SculptSettings } from "../../state/SculptSettings.ts";
import {
  ChunkDrag,
  type ChunkMode
} from "./model/ChunkDrag.ts";
import {
  emptyGroundTarget,
  rayOnPlane,
  surfaceTarget,
  type ChunkTarget
} from "./model/chunkTarget.ts";
import { ChunkGhost } from "./rendering/ChunkGhost.ts";

// CONSTANTS
const kMaxAimDistance = 20_000;

export interface ChunkToolOptions {
  document: Pick<
    TerrainDocument,
    "terrain" | "addChunk" | "removeChunk" | "changeTier" | "canAddChunk" | "canRemoveChunk"
  >;
  preview: Pick<TerrainPreview, "terrain">;
  settings: Pick<SculptSettings, "options">;
  history: Pick<TerrainHistory, "open">;
  camera: THREE.Camera;
  paused?: () => boolean;
}

interface ActiveDrag {
  readonly drag: ChunkDrag;
  readonly height: number;
}

export class ChunkTool extends ActorComponent {
  #options: ChunkToolOptions;
  #ghost = new ChunkGhost();
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #active: ActiveDrag | null = null;
  #keepAlive: (() => void) | null = null;

  constructor(
    actor: Actor,
    options: ChunkToolOptions
  ) {
    super({
      actor,
      typeName: "ChunkTool"
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
    const { tool, chunkMode, chunkTier } = this.#options.settings.options;
    if (
      tool !== "chunks" ||
      this.#options.paused?.() === true ||
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
      const hit = rayOnPlane(ray, active.height, kMaxAimDistance);
      if (hit !== null) {
        active.drag.moveTo(hit.point);
      }
      this.#hideGhost();

      return;
    }

    const mode = InputCombination.Control.evaluate(input) ? swapped(chunkMode) : chunkMode;
    const target = this.#target(mode, ray);
    if (target !== null && mouse.wasJustPressed("left")) {
      this.#active = {
        drag: new ChunkDrag(this.#options, { mode, tier: chunkTier }, target.point),
        height: target.height
      };
      this.#hideGhost();
    }
    else if (target === null) {
      this.#hideGhost();
    }
    else {
      const accepted = this.#accepts(mode, target);
      if (this.#ghost.show(this.#options.preview.terrain, { ...target, mode, accepted })) {
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

  #target(
    mode: ChunkMode,
    ray: TerrainRay
  ): ChunkTarget | null {
    const { document, preview } = this.#options;
    const surface = raycastTerrain(preview.terrain, ray, { maxDistance: kMaxAimDistance, hitHoles: true });
    if (mode !== "add") {
      return surface === null ? null : surfaceTarget(document.terrain, surface);
    }

    const ground = emptyGroundTarget(document.terrain, ray, kMaxAimDistance);

    return ground === null || (surface !== null && surface.distance < ground.distance) ? null : ground;
  }

  #accepts(
    mode: ChunkMode,
    { coord }: ChunkTarget
  ): boolean {
    const { document, settings } = this.#options;
    switch (mode) {
      case "add":
        return document.canAddChunk(coord.x, coord.z);
      case "remove":
        return document.canRemoveChunk(coord.x, coord.z);
      case "detail":
        return document.terrain.chunk(coord)?.tier !== settings.options.chunkTier;
    }
  }

  #hideGhost(): void {
    if (this.#ghost.hide()) {
      this.actor.world.invalidate();
    }
  }
}

function swapped(
  mode: ChunkMode
): ChunkMode {
  switch (mode) {
    case "add":
      return "remove";
    case "remove":
      return "add";
    case "detail":
      return "detail";
  }
}
