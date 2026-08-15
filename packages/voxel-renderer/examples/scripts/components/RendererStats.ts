// Import Third-party Dependencies
import {
  ActorComponent,
  type Actor
} from "@jolly-pixel/engine";
import {
  formatCount,
  type Pane
} from "@jolly-pixel/ui";
import { StatsRecorder } from "@jolly-pixel/ui/stats";
import type * as THREE from "three/webgpu";

export interface RendererStatsOptions {
  folder: ReturnType<Pane["addFolder"]>;
  onRefresh?: () => void;
}

/** Adds post-draw renderer counters to an existing example folder. */
export class RendererStats extends ActorComponent {
  #folder: ReturnType<Pane["addFolder"]>;
  #onRefresh?: () => void;
  #recorder = new StatsRecorder();
  #unsubscribe: (() => void) | null = null;

  #stats = {
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0
  };
  #frame = {
    calls: 0,
    triangles: 0
  };

  constructor(
    actor: Actor,
    options: RendererStatsOptions
  ) {
    super({
      actor,
      typeName: "RendererStats"
    });
    this.#folder = options.folder;
    this.#onRefresh = options.onRefresh;
  }

  awake(): void {
    const renderer = this.actor.world.renderer
      .getSource() as THREE.WebGPURenderer;
    this.actor.world.renderer.onDraw(this.#captureFrame);
    this.#registerMetrics(renderer);

    this.#folder.addMonitors(this.#stats, {
      calls: { label: "draw calls", format: formatCount },
      triangles: { label: "rendered tris", format: formatCount },
      geometries: { label: "geometries", format: formatCount },
      textures: { label: "textures", format: formatCount }
    });

    this.#unsubscribe = this.#recorder.subscribe(
      (snapshot) => this.#refresh(snapshot)
    );
    this.#refresh(this.#recorder.snapshot());
  }

  update(
    _deltaTime: number
  ): void {
    this.#recorder.begin();
    this.#recorder.end();
  }

  override destroy(): void {
    this.actor.world.renderer.off("draw", this.#captureFrame);
    this.#unsubscribe?.();
    this.#unsubscribe = null;

    super.destroy();
  }

  #captureFrame = (
    { source }: { source: THREE.WebGPURenderer; }
  ) => {
    this.#frame.calls = source.info.render.drawCalls;
    this.#frame.triangles = source.info.render.triangles;
  };

  #registerMetrics(
    renderer: THREE.WebGPURenderer
  ): void {
    this.#recorder.addMetric({
      id: "calls",
      label: "draw calls",
      sample: () => this.#frame.calls
    });
    this.#recorder.addMetric({
      id: "rendererTriangles",
      label: "rendered tris",
      sample: () => this.#frame.triangles
    });
    this.#recorder.addMetric({
      id: "geometries",
      label: "geometries",
      sample: () => renderer.info.memory.geometries
    });
    this.#recorder.addMetric({
      id: "textures",
      label: "textures",
      sample: () => renderer.info.memory.textures
    });
  }

  #refresh(
    snapshot: Record<string, number>
  ): void {
    this.#stats.calls = snapshot.calls ?? 0;
    this.#stats.triangles = snapshot.rendererTriangles ?? 0;
    this.#stats.geometries = snapshot.geometries ?? 0;
    this.#stats.textures = snapshot.textures ?? 0;
    this.#folder.refresh();
    this.#onRefresh?.();
  }
}
