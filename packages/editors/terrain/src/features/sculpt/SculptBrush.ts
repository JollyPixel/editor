// Import Third-party Dependencies
import type { TerrainCommandDocument } from "@jolly-pixel/asset.terrain/client";
import { InputCombination } from "@jolly-pixel/controls";
import type { OpenStep } from "@jolly-pixel/history";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  raycastTerrain,
  type TerrainHit,
  type TerrainView,
  type TileCoord,
  type TileKey
} from "@jolly-pixel/terrain.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import { stampStrength } from "./model/brushRate.ts";
import { halfWeightDistance } from "./model/falloff.ts";
import type { SculptSettings } from "./model/SculptSettings.ts";
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../shared/terrainHistory.ts";
import { sculptStamp } from "./model/sculptStamp.ts";
import {
  StampSpacer,
  type GroundPoint
} from "./model/StampSpacer.ts";
import { StrokeRecorder } from "./model/StrokeRecorder.ts";
import {
  BrushRing,
  type BrushRingShape
} from "./rendering/BrushRing.ts";

// CONSTANTS
const kResizeStep = 1.1;
const kMaxAimDistance = 20_000;

export interface SculptBrushOptions {
  document: TerrainCommandDocument;
  view: TerrainView;
  settings: SculptSettings;
  history: Pick<TerrainHistory, "open">;
  camera: () => THREE.Camera | null;
  publishRing?: (shape: BrushRingShape | null) => void;
}

interface Stroke {
  readonly step: OpenStep;
  readonly spacer: StampSpacer;
  readonly lower: boolean;
  readonly target: number;
}

export class SculptBrush extends ActorComponent {
  #document: TerrainCommandDocument;
  #view: TerrainView;
  #settings: SculptSettings;
  #history: Pick<TerrainHistory, "open">;
  #camera: () => THREE.Camera | null;
  #publishRing: (shape: BrushRingShape | null) => void;
  #ring = new BrushRing();
  #raycaster = new THREE.Raycaster();
  #pointer = new THREE.Vector2();
  #stroke: Stroke | null = null;
  #recorder = new StrokeRecorder();
  #ringKey = "";
  #keepAlive: (() => void) | null = null;

  constructor(
    actor: Actor<any>,
    options: SculptBrushOptions
  ) {
    super({
      actor,
      typeName: "SculptBrush"
    });

    this.#document = options.document;
    this.#view = options.view;
    this.#settings = options.settings;
    this.#history = options.history;
    this.#camera = options.camera;
    this.#publishRing = options.publishRing ?? (() => undefined);
  }

  awake(): void {
    this.actor.object3D.add(this.#ring);
    this.#keepAlive = this.actor.world.keepAlive(() => this.#stroke !== null);
  }

  update(): void {
    const { input } = this.actor.world;
    const { mouse } = input;
    if (!mouse.hovering || mouse.isDown("middle") || InputCombination.Alt.evaluate(input)) {
      this.#endStroke();
      this.#hideRing();

      return;
    }

    const aim = this.#aim();
    if (InputCombination.Control.evaluate(input)) {
      this.#endStroke();
      this.#resize(mouse.isDown("scrollUp"), mouse.isDown("scrollDown"));
    }
    else {
      this.#updateStroke(aim);
    }
    this.#recorder.tick(this.actor.world.time.unscaledDelta);
    if (this.#recorder.due) {
      this.#document.commitTiles(this.#recorder.take());
    }
    this.#drawRing(aim);
  }

  override destroy(): void {
    this.#endStroke();
    this.#keepAlive?.();
    this.actor.object3D.remove(this.#ring);
    this.#ring.dispose();

    super.destroy();
  }

  #aim(): TerrainHit | null {
    const camera = this.#camera();
    if (camera === null) {
      return null;
    }

    this.actor.world.input.mouse.viewportPositionTo(this.#pointer);
    this.#raycaster.setFromCamera(this.#pointer, camera);
    const { origin, direction } = this.#raycaster.ray;

    return raycastTerrain(this.#document.terrain, { origin, direction }, kMaxAimDistance);
  }

  #resize(
    grow: boolean,
    shrink: boolean
  ): void {
    const { size } = this.#settings.options;
    if (grow) {
      this.#settings.update({ size: size * kResizeStep });
    }
    else if (shrink) {
      this.#settings.update({ size: size / kResizeStep });
    }
  }

  #updateStroke(
    aim: TerrainHit | null
  ): void {
    const { mouse } = this.actor.world.input;
    if (this.#stroke !== null && !mouse.isDown("left") && !mouse.isDown("right")) {
      this.#endStroke();
    }
    if (aim === null) {
      return;
    }

    const point = { x: aim.point.x, z: aim.point.z };
    if (this.#stroke === null) {
      const lower = mouse.wasJustPressed("right");
      if (!lower && !mouse.wasJustPressed("left")) {
        return;
      }

      this.#stroke = {
        step: this.#history.open(TERRAIN_HISTORY_SCOPE, "Sculpt"),
        spacer: new StampSpacer(point),
        lower,
        target: aim.point.y
      };
      this.#apply([point]);

      return;
    }

    const { size, spacing } = this.#settings.options;
    const centres = this.#stroke.spacer.moveTo(point, size * spacing);
    this.#apply(centres.length === 0 ? [point] : centres);
  }

  #apply(
    centres: readonly GroundPoint[]
  ): void {
    const stroke = this.#stroke;
    if (stroke === null || centres.length === 0) {
      return;
    }

    const options = this.#settings.options;
    const strength = stampStrength(
      options.tool,
      options.strength,
      this.actor.world.time.unscaledDelta,
      centres.length
    );
    const changed = new Map<TileKey, TileCoord>();
    for (const { x, z } of centres) {
      const patches = sculptStamp(this.#document.terrain, {
        tool: options.tool,
        x,
        z,
        radius: options.size,
        strength,
        falloff: options.falloff,
        lift: stroke.lower ? -options.size : options.size,
        target: stroke.target
      });
      this.#recorder.record(this.#document.writeTiles(patches));
      for (const { tile } of patches) {
        changed.set(tile.key, tile);
      }
    }
    if (changed.size > 0) {
      this.#view.tilesChanged(changed.values());
      this.#ringKey = "";
    }
  }

  #endStroke(): void {
    const stroke = this.#stroke;
    this.#stroke = null;
    if (this.#recorder.size > 0) {
      this.#document.commitTiles(this.#recorder.take());
    }
    stroke?.step.commit();
  }

  #drawRing(
    aim: TerrainHit | null
  ): void {
    if (aim === null) {
      this.#hideRing();

      return;
    }

    const { size, falloff } = this.#settings.options;
    const key = `${aim.point.x},${aim.point.z},${size},${falloff}`;
    if (key === this.#ringKey) {
      return;
    }

    const inner = halfWeightDistance(falloff);
    const shape: BrushRingShape = {
      x: aim.point.x,
      z: aim.point.z,
      radius: size,
      innerRadius: inner === null ? null : inner * size
    };
    this.#ring.draw(this.#document.terrain, shape);
    this.#publishRing(shape);
    this.#ringKey = key;
    this.actor.world.invalidate();
  }

  #hideRing(): void {
    if (this.#ring.visible) {
      this.#ring.visible = false;
      this.#ringKey = "";
      this.#publishRing(null);
      this.actor.world.invalidate();
    }
  }
}
