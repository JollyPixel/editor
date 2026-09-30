// Import Node.js Dependencies
import { setImmediate } from "node:timers/promises";

// Import Internal Dependencies
import { runMeshWorker } from "../../src/view/workers/runMeshWorker.ts";
import type {
  MeshWorkerPort,
  MeshWorkerRequest
} from "../../src/view/workers/protocol.ts";
import type { VoxelView } from "../../src/view/VoxelView.ts";
import {
  FACE_TEMPLATE_TEXELS,
  PULLED_TEMPLATE_BITS,
  type PulledChunkGeometry
} from "../../src/view/meshing/index.ts";
import { chunkMeshes } from "./view.ts";

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
  view: VoxelView
): Promise<void> {
  const state = { idle: false };
  void view.whenIdle().then(() => {
    state.idle = true;
  });

  for (let turn = 0; turn < 1_000; turn++) {
    view.tick(0);
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
  blends: number[];
}

export function meshSnapshot(
  view: VoxelView
): Map<string, MeshSnapshot> {
  const snapshot = new Map<string, MeshSnapshot>();
  const layers = view.document.world.getLayers();
  for (const mesh of chunkMeshes(view)) {
    const geometry = mesh.geometry as PulledChunkGeometry;
    const attributes: Record<string, number[]> = {};
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      attributes[name] = Array.from(attribute.array);
    }
    const key = layers.reduce(
      (name, layer) => name.replace(layer.id, layer.name),
      mesh.name
    );
    snapshot.set(key, {
      drawCount: geometry.drawRange.count,
      attributes,
      faces: pulledFaces(geometry),
      blends: geometry.blends === null ?
        [] :
        Array.from(geometry.blends.image.data as Float32Array)
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
    const packed = words[(face * geometry.faceWords) + 1];
    const template = (packed & templateMask) * kTemplateFloats;
    faces.push([
      words[face * geometry.faceWords],
      packed >>> PULLED_TEMPLATE_BITS,
      ...templates.subarray(template, template + kTemplateFloats),
      ...words.subarray(
        (face * geometry.faceWords) + 2,
        (face + 1) * geometry.faceWords
      )
    ]);
  }

  return faces;
}
