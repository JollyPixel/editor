// Import Node.js Dependencies
import { afterEach, mock } from "node:test";

// Import Third-party Dependencies
import type { Actor } from "@jolly-pixel/engine";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import * as THREE from "three";

// Import Internal Dependencies
import { editorState } from "../../../src/app/state/index.ts";
import { LocalBrush } from "../../../src/features/painting/LocalBrush.ts";
import { BrushMesh } from "../../../src/features/painting/rendering/BrushMesh.ts";
import type { BrushCursor } from "../../../src/features/painting/model/brushCursor.ts";

export type MouseAction = "left" | "right";

export interface VoxelEntryLike {
  position: { x: number; y: number; z: number; };
}

export interface BrushHarnessOptions {
  maxDistance?: number;
  skyRadius?: number;
  filled?: boolean;
  blocks?: CellLike[];
}

export interface CellLike {
  x: number;
  y: number;
  z: number;
  blockId?: number;
}

export interface BrushHarness {
  cursors: (BrushCursor | null)[];
  brush: LocalBrush;
  camera: THREE.PerspectiveCamera;
  operations: string[];
  removed: VoxelEntryLike[];
  placed: VoxelEntryLike[];
  previewUpdates: number;
  addBlock(cell: CellLike): void;
  setCtrl(down: boolean): void;
  press(action: MouseAction): void;
  settle(): void;
  release(): void;
  setPointer(x: number, y: number): void;
  setMouseMoving(moving: boolean): void;
  setButtonDown(action: string | null): void;
  setHovering(hovering: boolean): void;
}

// CONSTANTS
const kBrushes: LocalBrush[] = [];

afterEach(() => {
  for (const brush of kBrushes.splice(0)) {
    brush.destroy();
  }
});

export function createHarness(
  options: BrushHarnessOptions = {}
): BrushHarness {
  const {
    maxDistance,
    skyRadius,
    filled = false,
    blocks = []
  } = options;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 100);
  camera.position.set(0.5, 10, 0.5);
  camera.lookAt(0.5, 0, 0.5);
  camera.updateMatrixWorld(true);

  let pressed: MouseAction | null = null;
  const down = new Set<string>();
  let mouseMoving = true;
  let hovering = true;
  const pointer = new THREE.Vector2();
  const operations: string[] = [];
  const placed: VoxelEntryLike[] = [];
  const removed: VoxelEntryLike[] = [];
  const occupied = new Set(blocks.map(cellKey));
  const blockIds = new Map(
    blocks.map((block) => [cellKey(block), block.blockId ?? 1])
  );
  let ctrl = false;
  const layer = {
    getVoxelAt(position: CellLike): { blockId: number; } | undefined {
      const key = cellKey(position);
      if (!filled && !occupied.has(key)) {
        return undefined;
      }

      return { blockId: blockIds.get(key) ?? 1 };
    }
  };
  const root = new THREE.Group();
  function addBlock(cell: CellLike): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.position.set(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
    root.add(mesh);
    root.updateMatrixWorld(true);
    occupied.add(cellKey(cell));
    blockIds.set(cellKey(cell), cell.blockId ?? 1);
  }
  for (const block of blocks) {
    addBlock(block);
  }
  const engine = {
    root,
    world: {
      getLayer: () => layer,
      getVoxelAt: (position: CellLike) => layer.getVoxelAt(position),
      setVoxelBulk(_name: string, entries: VoxelEntryLike[]): void {
        placed.push(...entries);
        operations.push(`set:${entries.length}`);
      },
      removeVoxelBulk(_name: string, entries: VoxelEntryLike[]): void {
        removed.push(...entries);
        operations.push(`remove:${entries.length}`);
      }
    },
    flush(): void {
      operations.push("flush");
    }
  };
  const actorValue = {
    components: [],
    componentsRequiringUpdate: [],
    world: {
      input: {
        keyboard: {
          isDown: (code: string) => ctrl && code === "ControlLeft"
        },
        mouse: {
          viewportPositionTo: <T extends THREE.Vector2>(out: T) => out.set(
            pointer.x,
            pointer.y
          ),
          isDown: (action: string) => down.has(action),
          isMoving: () => mouseMoving,
          get hovering() {
            return hovering;
          },
          wasJustPressed: (action: string) => action === pressed
        }
      },
      sceneManager: {
        componentsToBeStarted: [],
        getSource: () => scene
      }
    },
    addChildren(...objects: THREE.Object3D[]) {
      scene.add(...objects);

      return actorValue;
    },
    removeChildren(...objects: THREE.Object3D[]) {
      scene.remove(...objects);

      return actorValue;
    },
    addComponentAndGet<TComponent>(
      ComponentClass: new (actor: Actor) => TComponent
    ): TComponent {
      return new ComponentClass(actor);
    }
  };
  const actor = actorValue as unknown as Actor;
  const draw = mock.method(
    BrushMesh.prototype,
    "draw"
  );
  const brush = new LocalBrush(actor, {
    engine: engine as unknown as VoxelEngine,
    camera,
    groundPlaneSize: 10,
    maxDistance,
    skyRadius
  });
  kBrushes.push(brush);

  const cursors: (BrushCursor | null)[] = [];
  brush.onCursorChange = (cursor) => cursors.push(cursor);

  return {
    addBlock,
    brush,
    camera,
    operations,
    placed,
    removed,
    cursors,
    get previewUpdates(): number {
      return draw.mock.callCount();
    },
    press(action: MouseAction): void {
      pressed = action;
      down.add(action);
    },
    settle(): void {
      pressed = null;
    },
    release(): void {
      pressed = null;
      down.clear();
    },
    setPointer(x: number, y: number): void {
      pointer.set(x, y);
    },
    setMouseMoving(moving: boolean): void {
      mouseMoving = moving;
    },
    setButtonDown(action: string | null): void {
      down.clear();
      if (action !== null) {
        down.add(action);
      }
    },
    setHovering(value: boolean): void {
      hovering = value;
    },
    setCtrl(down: boolean): void {
      ctrl = down;
    }
  };
}

export function sortCells(
  cells: CellLike[]
): CellLike[] {
  return [...cells].sort(
    (left, right) => cellKey(left).localeCompare(cellKey(right))
  );
}

export function cellKey(
  cell: CellLike
): string {
  return `${cell.x},${cell.y},${cell.z}`;
}

export function resetEditorState(): void {
  mock.restoreAll();
  editorState.selection.clear();
  editorState.brush.size = 1;
  editorState.brush.blockId = 1;
}
