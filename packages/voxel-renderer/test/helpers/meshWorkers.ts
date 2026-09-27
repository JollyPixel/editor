// Import Node.js Dependencies
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import { runMeshWorker } from "../../src/mesh/workers/runMeshWorker.ts";
import type {
  MeshWorkerPort,
  MeshWorkerRequest
} from "../../src/mesh/workers/protocol.ts";
import type { VoxelEngine } from "../../src/VoxelEngine.ts";
import {
  FACE_TEMPLATE_TEXELS,
  PULLED_FACE_WORDS,
  PULLED_TEMPLATE_BITS,
  PulledChunkGeometry
} from "../../src/mesh/index.ts";
import { chunkMeshes } from "./engine.ts";

// CONSTANTS
const kTemplateFloats = FACE_TEMPLATE_TEXELS * 4;

export interface InProcessWorkers {
  createWorker: () => MeshWorkerPort;
  requests: MeshWorkerRequest[];
  crash: () => void;
}

export function inProcessWorkers(): InProcessWorkers {
  const requests: MeshWorkerRequest[] = [];
  const crashListeners: Array<(event: Event) => void> = [];

  return {
    requests,
    crash() {
      for (const listener of crashListeners) {
        listener(new Event("error"));
      }
    },
    createWorker() {
      const { port1, port2 } = new MessageChannel();
      runMeshWorker(port2);
      port1.start();
      port2.start();

      return {
        postMessage(message, options) {
          requests.push(message);
          port1.postMessage(message, options);
        },
        addEventListener(type: "message" | "error", listener: never) {
          if (type === "error") {
            crashListeners.push(listener);
          }
          else {
            port1.addEventListener(type, listener);
          }
        },
        terminate() {
          port1.close();
          port2.close();
        }
      };
    }
  };
}

export function buildRequests(
  workers: InProcessWorkers
): number {
  return workers.requests.filter((request) => request.type === "build").length;
}

export async function meshInWorkers(
  engine: VoxelEngine
): Promise<void> {
  const state = { idle: false };
  void engine.view.whenIdle().then(() => {
    state.idle = true;
  });

  for (let turn = 0; turn < 1_000; turn++) {
    engine.tick(0);
    await setImmediate();
    if (state.idle) {
      return;
    }
  }

  throw new Error("mesh workers never settled");
}

export interface MeshSnapshot {
  drawCount: number;
  attributes: Record<string, number[]>;
  faces: number[][];
}

export function meshSnapshot(
  engine: VoxelEngine
): Map<string, MeshSnapshot> {
  const snapshot = new Map<string, MeshSnapshot>();
  for (const mesh of chunkMeshes(engine)) {
    const { geometry } = mesh;
    const attributes: Record<string, number[]> = {};
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      attributes[name] = Array.from(attribute.array);
    }
    snapshot.set(mesh.name, {
      drawCount: geometry.drawRange.count,
      attributes,
      faces: geometry instanceof PulledChunkGeometry ? pulledFaces(geometry) : []
    });
  }

  return snapshot;
}

function pulledFaces(
  geometry: PulledChunkGeometry
): number[][] {
  const words = geometry.faces.image.data as Uint32Array;
  const templates = geometry.templates.texture.image.data as Float32Array;
  const templateMask = (1 << PULLED_TEMPLATE_BITS) - 1;
  const faces: number[][] = [];
  for (let face = 0; face < geometry.faceCount; face++) {
    const packed = words[(face * PULLED_FACE_WORDS) + 1];
    const template = (packed & templateMask) * kTemplateFloats;
    faces.push([
      words[face * PULLED_FACE_WORDS],
      packed >>> PULLED_TEMPLATE_BITS,
      ...templates.subarray(template, template + kTemplateFloats)
    ]);
  }

  return faces;
}
