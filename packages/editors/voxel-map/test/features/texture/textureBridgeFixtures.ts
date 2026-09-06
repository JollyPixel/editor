// Import Third-party Dependencies
import {
  UVMap,
  type CanvasBufferEvent,
  type PixelArtCanvas,
  type SelectEngineEvent,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import { Emitter } from "@openally/emitt";

// Ghost previews coalesce their presence updates through
// requestAnimationFrame, which happy-dom does not expose globally.
const kFrames = new Map<number, () => void>();
let nextFrameHandle = 0;
Object.assign(globalThis, {
  requestAnimationFrame: (callback: () => void) => {
    kFrames.set(++nextFrameHandle, callback);

    return nextFrameHandle;
  },
  cancelAnimationFrame: (handle: number) => kFrames.delete(handle)
});

export function flushFrames(): void {
  const pending = [...kFrames.values()];
  kFrames.clear();
  for (const frame of pending) {
    frame();
  }
}

export type FakeManager = PixelArtCanvas & {
  document: Emitter<CanvasBufferEvent>;
  selectionEvents: Emitter<SelectEngineEvent>;
  /** Scope depth at each texture assignment; 0 means it broadcast. */
  textureSetDepths: number[];
};

export function makeFakeManager(
  hasTransparency: (rect: SelectionRect) => boolean
): FakeManager {
  const fakeCanvas = { toDataURL: () => "data:image/png;base64," } as unknown as HTMLCanvasElement;
  const textureSetDepths: number[] = [];
  let depth = 0;
  function ignore(): void {
    // Deliberately empty peer-presence sink.
  }

  return {
    document: new Emitter<CanvasBufferEvent>(),
    uv: new UVMap({
      getCanvasSize: () => {
        return { x: 64, y: 64 };
      }
    }),
    peerPresence: {
      cursors: {
        set: ignore,
        remove: ignore,
        clearAll: ignore
      },
      uv: {
        set: ignore,
        remove: ignore,
        removeByRegion: ignore,
        clearAll: ignore
      },
      strokes: {
        set: ignore,
        remove: ignore,
        clearAll: ignore,
        removeOverlapping: ignore
      },
      selectionOutlines: {
        set: ignore,
        remove: ignore,
        clearAll: ignore,
        removeOverlapping: ignore
      },
      floatingSelections: {
        set: ignore,
        remove: ignore,
        clearAll: ignore,
        removeOverlapping: ignore
      }
    },
    selectionEvents: new Emitter<SelectEngineEvent>(),
    textureSize: { x: 64, y: 64 },
    textureCanvas: () => fakeCanvas,
    hasTransparency,
    textureSetDepths,
    loadSnapshot: () => void 0,
    set texture(_source: HTMLImageElement) {
      textureSetDepths.push(depth);
    },
    runLocalRestore: <T>(fn: () => T): T => {
      depth++;
      try {
        return fn();
      }
      finally {
        depth--;
      }
    }
  } as unknown as FakeManager;
}
