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
import { holeTool } from "../holes/holeTool.ts";
import type { MaterialSelection } from "../materials/model/MaterialSelection.ts";
import { paintTool } from "../paint/paintTool.ts";
import type {
  BrushStroke,
  BrushToolHandler
} from "./model/BrushToolHandler.ts";
import {
  STRENGTH_OPTIONS,
  type BrushTool,
  type SculptOptions,
  type SculptSettings
} from "./model/SculptSettings.ts";
import type { GroundPoint } from "./model/StampSpacer.ts";
import {
  rampTool,
  sculptTools
} from "./sculptTools.ts";
import type { TerrainHistory } from "../../shared/terrainHistory.ts";
import type { PeerBrushRings } from "./collaboration/PeerBrushRings.ts";
import { BrushCursor } from "./rendering/BrushCursor.ts";
import { RampGuide } from "./rendering/RampGuide.ts";

// CONSTANTS
const kResizeStep = 1.1;
const kMaxAimDistance = 20_000;

export interface SculptBrushOptions {
  document: Pick<TerrainDocument, "terrain" | "materials" | "patchSplat" | "patchHoles">;
  preview: TerrainPreview;
  settings: SculptSettings;
  selection: Pick<MaterialSelection, "selected" | "select">;
  history: Pick<TerrainHistory, "open">;
  camera: THREE.Camera;
  rings: Pick<PeerBrushRings, "publishLocalRing">;
  paused?: () => boolean;
}

export class SculptBrush extends ActorComponent {
  #options: SculptBrushOptions;
  #cursor: BrushCursor;
  #guide = new RampGuide();
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #tools: Readonly<Record<Exclude<BrushTool, "chunks">, BrushToolHandler>>;
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
      ramp: rampTool(options),
      paint: paintTool(options),
      holes: holeTool(options)
    };
    this.#cursor = new BrushCursor({
      terrain: options.preview.terrain,
      rings: options.rings
    });
  }

  awake(): void {
    this.actor.object3D.add(this.#cursor.ring, this.#guide);
    this.#keepAlive = this.actor.world.keepAlive(() => this.#stroke !== null);
  }

  update(): void {
    const { input } = this.actor.world;
    const { mouse } = input;
    const selected = this.#options.settings.options.tool;
    if (
      selected === "chunks" ||
      this.#options.paused?.() === true ||
      !mouse.hovering ||
      mouse.isDown("middle") ||
      InputCombination.Alt.evaluate(input)
    ) {
      this.interruptStroke();
      this.#hideCursor();

      return;
    }

    const tool = this.#tools[selected];
    const aim = this.#aim(tool);
    const control = InputCombination.Control.evaluate(input);
    if (control) {
      this.#resize(mouse.isDown("scrollUp"), mouse.isDown("scrollDown"));
    }
    if (control && tool.pick !== undefined) {
      this.#endStroke();
      if (aim !== null && mouse.wasJustPressed("left")) {
        tool.pick(aim);
      }
    }
    else {
      this.#sculpt(tool, aim, control);
    }

    if (aim === null) {
      this.#hideCursor();
    }
    else if (this.#cursor.show(aim.point, this.#ringOptions())) {
      this.actor.world.invalidate();
    }
    this.#showGuide();
  }

  terrainChanged(): void {
    this.#cursor.terrainChanged();
    this.#guide.terrainChanged();
  }

  interruptStroke(): void {
    if (this.#stroke?.cancel === undefined) {
      this.#endStroke();
    }
    else {
      this.#stroke.cancel();
      this.#stroke = null;
    }
  }

  override destroy(): void {
    this.interruptStroke();
    this.#keepAlive?.();
    this.actor.object3D.remove(this.#cursor.ring, this.#guide);
    this.#cursor.dispose();
    this.#guide.dispose();

    super.destroy();
  }

  #endStroke(): void {
    this.#stroke?.end();
    this.#stroke = null;
  }

  #aim(
    tool: BrushToolHandler
  ): TerrainHit | null {
    this.actor.world.input.mouse.viewportPositionTo(this.#pointer);
    this.#raycaster.setFromCamera(this.#pointer, this.#options.camera);
    const { origin, direction } = this.#raycaster.ray;

    return raycastTerrain(
      this.#options.preview.terrain,
      { origin, direction },
      { maxDistance: kMaxAimDistance, hitHoles: tool.hitsHoles }
    );
  }

  #ringOptions(): Pick<SculptOptions, "size" | "falloff"> {
    const { tool, size, falloff } = this.#options.settings.options;

    return {
      size,
      falloff: STRENGTH_OPTIONS[tool] === null ? "constant" : falloff
    };
  }

  #sculpt(
    tool: BrushToolHandler,
    aim: TerrainHit | null,
    inverted: boolean
  ): void {
    const { mouse } = this.actor.world.input;
    if (this.#stroke !== null && !mouse.isDown("left") && !mouse.isDown("right")) {
      this.#endStroke();
    }

    const point = aim === null ? null : groundPoint(aim);
    if (this.#stroke === null) {
      const lower = mouse.wasJustPressed("right");
      if (aim === null || (!lower && !mouse.wasJustPressed("left"))) {
        return;
      }

      this.#stroke = tool.begin({ point: groundPoint(aim), height: aim.point.y, lower });
      if (this.#stroke === null) {
        return;
      }
    }
    this.#stroke.update(point, this.actor.world.time.unscaledDelta, inverted);
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
    const ring = this.#cursor.hide();
    const guide = this.#guide.hide();
    if (ring || guide) {
      this.actor.world.invalidate();
    }
  }

  #showGuide(): void {
    const segment = this.#stroke?.segment ?? null;
    const changed = segment === null ?
      this.#guide.hide() :
      this.#guide.show(this.#options.preview.terrain, segment, this.#options.settings.options.size);
    if (changed) {
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
