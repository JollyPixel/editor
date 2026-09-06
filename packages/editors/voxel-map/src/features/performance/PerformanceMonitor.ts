// Import Third-party Dependencies
import {
  ActorComponent,
  type Actor
} from "@jolly-pixel/engine";
import { StatsRecorder } from "@jolly-pixel/ui/stats";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  PerformanceHUD,
  type PerformanceSnapshot
} from "./PerformanceHUD.ts";

export interface PerformanceMonitorOptions {
  engine: VoxelEngine;
}

export class PerformanceMonitor extends ActorComponent {
  #engine: VoxelEngine;
  #hud: PerformanceHUD | null = null;
  #recorder = new StatsRecorder();
  #unsubscribe: (() => void) | null = null;

  #frameStats = {
    calls: 0,
    triangles: 0
  };

  constructor(
    actor: Actor,
    options: PerformanceMonitorOptions
  ) {
    super({
      actor,
      typeName: "PerformanceMonitor"
    });
    this.#engine = options.engine;
  }

  awake(): void {
    const renderer = this.actor.world.renderer
      .getSource() as THREE.WebGPURenderer;
    this.actor.world.renderer.onDraw(this.#captureFrame);
    this.#registerMetrics(renderer);

    this.#hud = new PerformanceHUD({
      keyboard: this.actor.world.input.keyboard,
      onDebugModeChange: (mode) => {
        this.#engine.debug.mode = mode;
      }
    });
    this.#unsubscribe = this.#recorder.subscribe(
      (snapshot) => this.#publishSnapshot(snapshot)
    );
    this.#publishSnapshot(this.#recorder.snapshot());
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
    this.#hud?.dispose();
    this.#hud = null;

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
  ): void => {
    this.#frameStats.calls = source.info.render.drawCalls;
    this.#frameStats.triangles = source.info.render.triangles;
  };

  #registerVoxelMetrics(): void {
    const debug = () => this.#engine.debug.stats;
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

  #publishSnapshot(
    stats: Record<string, number>
  ): void {
    const snapshot: PerformanceSnapshot = {
      renderer: {
        calls: stats.calls ?? 0,
        triangles: stats.rendererTriangles ?? 0,
        geometries: stats.geometries ?? 0,
        textures: stats.textures ?? 0
      },
      voxel: {
        mode: this.#engine.debug.mode,
        chunks: stats.chunks ?? 0,
        meshes: stats.meshes ?? 0,
        voxels: stats.voxels ?? 0,
        faces: stats.faces ?? 0,
        culled: stats.culled ?? 0,
        merged: stats.merged ?? 0,
        triangles: stats.voxelTriangles ?? 0,
        facesPerVoxel: stats.facesPerVoxel ?? 0,
        buildMs: stats.buildMs ?? 0
      }
    };
    this.#hud?.update(snapshot);
  }
}
