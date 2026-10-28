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
  type TerrainHit
} from "@jolly-pixel/terrain.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import type { MaterialSelection } from "../materials/model/MaterialSelection.ts";
import { paintTool } from "../paint/paintTool.ts";
import type {
  BrushStroke,
  BrushToolHandler
} from "./model/BrushToolHandler.ts";
import type {
  BrushTool,
  SculptSettings
} from "./model/SculptSettings.ts";
import type { GroundPoint } from "./model/StampSpacer.ts";
import { sculptTools } from "./sculptTools.ts";
import type { TerrainHistory } from "../../shared/terrainHistory.ts";
import type { PeerBrushRings } from "./collaboration/PeerBrushRings.ts";
import { BrushCursor } from "./rendering/BrushCursor.ts";

// CONSTANTS
const kResizeStep = 1.1;
const kMaxAimDistance = 20_000;

export interface SculptBrushOptions {
  document: Pick<TerrainDocument, "terrain" | "materials" | "patchSplat">;
  preview: TerrainPreview;
  settings: SculptSettings;
  selection: Pick<MaterialSelection, "selected" | "select">;
  history: Pick<TerrainHistory, "open">;
  camera: THREE.Camera;
  rings: Pick<PeerBrushRings, "publishLocalRing">;
}

export class SculptBrush extends ActorComponent {
  #options: SculptBrushOptions;
  #cursor: BrushCursor;
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #tools: Readonly<Record<BrushTool, BrushToolHandler>>;
  #stroke: BrushStroke | null = null;
  #keepAlive: (() => void) | null = null;

  constructor(
    actor: Actor,
    options: SculptBrushOptions
  ) {
    super({
      actor,
      typeName: "SculptBrush"
    });

    this.#options = options;
    this.#tools = {
      ...sculptTools(options),
      paint: paintTool(options)
    };
    this.#cursor = new BrushCursor({
      terrain: options.preview.terrain,
      rings: options.rings
    });
  }

  awake(): void {
    this.actor.object3D.add(this.#cursor.ring);
    this.#keepAlive = this.actor.world.keepAlive(() => this.#stroke !== null);
  }

  update(): void {
    const { input } = this.actor.world;
    const { mouse } = input;
    if (!mouse.hovering || mouse.isDown("middle") || InputCombination.Alt.evaluate(input)) {
      this.endStroke();
      this.#hideCursor();

      return;
    }

    const aim = this.#aim();
    if (InputCombination.Control.evaluate(input)) {
      this.endStroke();
      this.#resize(mouse.isDown("scrollUp"), mouse.isDown("scrollDown"));
      if (aim !== null && mouse.wasJustPressed("left")) {
        this.#tool().pick(aim);
      }
    }
    else {
      this.#sculpt(aim);
    }

    if (aim === null) {
      this.#hideCursor();
    }
    else if (this.#cursor.show(aim.point, this.#options.settings.options)) {
      this.actor.world.invalidate();
    }
  }

  terrainChanged(): void {
    this.#cursor.terrainChanged();
  }

  endStroke(): void {
    this.#stroke?.end();
    this.#stroke = null;
  }

  override destroy(): void {
    this.endStroke();
    this.#keepAlive?.();
    this.actor.object3D.remove(this.#cursor.ring);
    this.#cursor.dispose();

    super.destroy();
  }

  #aim(): TerrainHit | null {
    this.actor.world.input.mouse.viewportPositionTo(this.#pointer);
    this.#raycaster.setFromCamera(this.#pointer, this.#options.camera);
    const { origin, direction } = this.#raycaster.ray;

    return raycastTerrain(
      this.#options.preview.terrain,
      { origin, direction },
      kMaxAimDistance
    );
  }

  #sculpt(
    aim: TerrainHit | null
  ): void {
    const { mouse } = this.actor.world.input;
    if (this.#stroke !== null && !mouse.isDown("left") && !mouse.isDown("right")) {
      this.endStroke();
    }

    const point = aim === null ? null : groundPoint(aim);
    if (this.#stroke === null) {
      const lower = mouse.wasJustPressed("right");
      if (aim === null || (!lower && !mouse.wasJustPressed("left"))) {
        return;
      }

      this.#stroke = this.#tool().begin({ point: groundPoint(aim), height: aim.point.y, lower });
      if (this.#stroke === null) {
        return;
      }
    }
    this.#stroke.update(point, this.actor.world.time.unscaledDelta);
  }

  #tool(): BrushToolHandler {
    return this.#tools[this.#options.settings.options.tool];
  }

  #resize(
    grow: boolean,
    shrink: boolean
  ): void {
    const { settings } = this.#options;
    const { size } = settings.options;
    if (grow) {
      settings.update({ size: size * kResizeStep });
    }
    else if (shrink) {
      settings.update({ size: size / kResizeStep });
    }
  }

  #hideCursor(): void {
    if (this.#cursor.hide()) {
      this.actor.world.invalidate();
    }
  }
}

function groundPoint(
  { point }: TerrainHit
): GroundPoint {
  return {
    x: point.x,
    z: point.z
  };
}
