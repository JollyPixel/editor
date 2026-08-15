// Import Third-party Dependencies
import {
  ActorComponent,
  type Actor
} from "@jolly-pixel/engine";
import {
  Pane,
  formatCount,
  formatMilliseconds,
  formatPercent
} from "@jolly-pixel/ui";
import { StatsRecorder } from "@jolly-pixel/ui/stats";
import type {
  VoxelDebugMode,
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer";
import type * as THREE from "three/webgpu";

// CONSTANTS
const kToggleKey = "F3";
const kDebugModeOptions: Record<VoxelDebugMode, VoxelDebugMode> = {
  off: "off",
  overlay: "overlay",
  wireframe: "wireframe"
};

export interface PerformanceHUDOptions {
  vr: VoxelRenderer;
}

export class PerformanceHUD extends ActorComponent {
  #vr: VoxelRenderer;
  #pane: Pane | null = null;
  #worldFolder: ReturnType<Pane["addFolder"]> | null = null;
  #meshFolder: ReturnType<Pane["addFolder"]> | null = null;
  #recorder = new StatsRecorder();
  #unsubscribe: (() => void) | null = null;

  #rendererStats = {
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0
  };
  #frameStats = {
    calls: 0,
    triangles: 0
  };
  #voxelStats = {
    mode: "off" as VoxelDebugMode,
    chunks: 0,
    meshes: 0,
    voxels: 0,
    faces: 0,
    culled: 0,
    merged: 0,
    triangles: 0,
    facesPerVoxel: 0,
    buildMs: 0
  };

  #onKeyDown: (event: KeyboardEvent) => void;

  constructor(
    actor: Actor,
    options: PerformanceHUDOptions
  ) {
    super({
      actor,
      typeName: "PerformanceHUD"
    });
    this.#vr = options.vr;

    this.#onKeyDown = (event: KeyboardEvent) => {
      if (event.key === kToggleKey) {
        event.preventDefault();
        if (this.#pane !== null) {
          this.#pane.hidden = !this.#pane.hidden;
        }
      }
    };
  }

  awake(): void {
    const renderer = this.actor.world.renderer
      .getSource() as THREE.WebGPURenderer;
    this.actor.world.renderer.onDraw(this.#captureFrame);
    this.#registerMetrics(renderer);

    const pane = new Pane({ title: "Voxel Stats [F3]" });
    this.#pane = pane;

    const worldFolder = pane.addFolder({ title: "World" });
    worldFolder.addBinding(this.#voxelStats, "mode", {
      options: kDebugModeOptions,
      label: "debug"
    }).on("change", ({ value }) => {
      this.#vr.engine.debug.mode = value;
    });
    worldFolder.addMonitors(this.#voxelStats, {
      chunks: { label: "chunks", format: formatCount },
      voxels: { label: "voxels", format: formatCount }
    });
    this.#worldFolder = worldFolder;

    const meshFolder = pane.addFolder({ title: "Mesh" });
    meshFolder.addMonitors(this.#voxelStats, {
      meshes: { label: "meshes", format: formatCount },
      faces: { label: "faces", format: formatCount },
      culled: { label: "culled", format: formatPercent },
      merged: { label: "merged", format: formatPercent },
      triangles: { label: "mesh tris", format: formatCount },
      facesPerVoxel: { label: "faces/voxel", format: formatDecimal },
      buildMs: { label: "build time", format: formatMilliseconds }
    });
    meshFolder.addMonitors(this.#rendererStats, {
      calls: { label: "draw calls", format: formatCount },
      triangles: { label: "rendered tris", format: formatCount },
      geometries: { label: "geometries", format: formatCount },
      textures: { label: "textures", format: formatCount }
    });
    this.#meshFolder = meshFolder;

    this.#unsubscribe = this.#recorder.subscribe(
      (snapshot) => this.#refresh(snapshot)
    );
    document.addEventListener("keydown", this.#onKeyDown);
    this.#refresh(this.#recorder.snapshot());
  }

  update(
    _deltaTime: number
  ): void {
    this.#recorder.begin();
    this.#recorder.end();
  }

  override destroy(): void {
    document.removeEventListener("keydown", this.#onKeyDown);
    this.actor.world.renderer.off("draw", this.#captureFrame);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#pane?.dispose();
    this.#pane = null;
    this.#worldFolder = null;
    this.#meshFolder = null;

    super.destroy();
  }

  #registerMetrics(
    renderer: THREE.WebGPURenderer
  ): void {
    this.#recorder.addMetric({
      id: "calls",
      label: "draw calls",
      better: "lower",
      sample: () => this.#frameStats.calls
    });
    this.#recorder.addMetric({
      id: "rendererTriangles",
      label: "rendered tris",
      better: "lower",
      sample: () => this.#frameStats.triangles
    });
    this.#recorder.addMetric({
      id: "geometries",
      label: "geometries",
      better: "lower",
      sample: () => renderer.info.memory.geometries
    });
    this.#recorder.addMetric({
      id: "textures",
      label: "textures",
      better: "lower",
      sample: () => renderer.info.memory.textures
    });
    this.#registerVoxelMetrics();
  }

  #captureFrame = (
    { source }: { source: THREE.WebGPURenderer; }
  ) => {
    this.#frameStats.calls = source.info.render.drawCalls;
    this.#frameStats.triangles = source.info.render.triangles;
  };

  #registerVoxelMetrics(): void {
    const debug = () => this.#vr.engine.debug.stats;
    this.#recorder.addMetric({
      id: "chunks",
      label: "chunks",
      sample: () => debug().chunks
    });
    this.#recorder.addMetric({
      id: "meshes",
      label: "meshes",
      sample: () => debug().meshes
    });
    this.#recorder.addMetric({
      id: "voxels",
      label: "voxels",
      sample: () => debug().voxels
    });
    this.#recorder.addMetric({
      id: "faces",
      label: "faces",
      sample: () => debug().faces
    });
    this.#recorder.addMetric({
      id: "culled",
      label: "culled",
      sample: () => {
        const { faces, culledFaces } = debug();
        const candidates = faces + culledFaces;

        return candidates === 0 ? 0 : (culledFaces / candidates) * 100;
      }
    });
    this.#recorder.addMetric({
      id: "merged",
      label: "merged",
      sample: () => {
        const { faces, mergedFaces } = debug();
        const emitted = faces + mergedFaces;

        return emitted === 0 ? 0 : (mergedFaces / emitted) * 100;
      }
    });
    this.#recorder.addMetric({
      id: "voxelTriangles",
      label: "mesh tris",
      sample: () => debug().triangles
    });
    this.#recorder.addMetric({
      id: "facesPerVoxel",
      label: "faces/voxel",
      sample: () => debug().facesPerSolidVoxel
    });
    this.#recorder.addMetric({
      id: "buildMs",
      label: "build time",
      better: "lower",
      sample: () => debug().buildTimeMs
    });
  }

  #refresh(
    snapshot: Record<string, number>
  ): void {
    this.#rendererStats.calls = snapshot.calls ?? 0;
    this.#rendererStats.triangles = snapshot.rendererTriangles ?? 0;
    this.#rendererStats.geometries = snapshot.geometries ?? 0;
    this.#rendererStats.textures = snapshot.textures ?? 0;

    this.#voxelStats.mode = this.#vr.engine.debug.mode;
    this.#voxelStats.chunks = snapshot.chunks ?? 0;
    this.#voxelStats.meshes = snapshot.meshes ?? 0;
    this.#voxelStats.voxels = snapshot.voxels ?? 0;
    this.#voxelStats.faces = snapshot.faces ?? 0;
    this.#voxelStats.culled = snapshot.culled ?? 0;
    this.#voxelStats.merged = snapshot.merged ?? 0;
    this.#voxelStats.triangles = snapshot.voxelTriangles ?? 0;
    this.#voxelStats.facesPerVoxel = snapshot.facesPerVoxel ?? 0;
    this.#voxelStats.buildMs = snapshot.buildMs ?? 0;
    this.#worldFolder?.refresh();
    this.#meshFolder?.refresh();
  }
}

function formatDecimal(
  value: number
): string {
  return value.toFixed(1);
}
