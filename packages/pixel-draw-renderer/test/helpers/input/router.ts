// Import Internal Dependencies
import { InteractionRouter } from "#src/input/InteractionRouter.ts";
import { InteractionMode } from "#src/input/modes/InteractionMode.ts";
import type { Viewport } from "#src/rendering/Viewport.ts";
import type {
  Mode,
  RotationDirection,
  Vec2
} from "#src/types.ts";

export class FakeMode extends InteractionMode {
  readonly id: Mode;
  readonly calls: string[] = [];
  #cursor: string;

  constructor(
    id: Mode,
    cursor = ""
  ) {
    super();
    this.id = id;
    this.#cursor = cursor;
  }

  onEnter(previous: Mode): void {
    this.calls.push(`enter:${previous}`);
  }

  onExit(next: Mode): void {
    this.calls.push(`exit:${next}`);
  }

  cursor(): string {
    return this.#cursor;
  }

  onPrimaryDown(pos: Vec2, canvasPos: Vec2): boolean {
    this.calls.push(`down:${pos.x},${pos.y}@${canvasPos.x},${canvasPos.y}`);

    return true;
  }

  onPrimaryMove(pos: Vec2, canvasPos: Vec2): void {
    this.calls.push(`move:${pos.x},${pos.y}@${canvasPos.x},${canvasPos.y}`);
  }

  onPrimaryUp(): void {
    this.calls.push("up");
  }

  onLineHeldChange(
    held: boolean
  ): void {
    this.calls.push(held ? "line-held" : "line-released");
  }

  onBlur(): void {
    this.calls.push("blur");
  }

  onDelete(): boolean {
    this.calls.push("delete");

    return true;
  }

  onRotate(direction: RotationDirection): boolean {
    this.calls.push(`rotate:${direction}`);

    return true;
  }

  onFlipHorizontal(): boolean {
    this.calls.push("flip-horizontal");

    return false;
  }

  onFlipVertical(): boolean {
    this.calls.push("flip-vertical");

    return true;
  }
}

export interface Recorder {
  pan: [number, number][];
  zoom: [number, number, number][];
  cursor: string[];
}

export function makeRouter(
  options: {
    modes?: FakeMode[];
    defaultMode?: Mode;
  } = {}
): { router: InteractionRouter; recorder: Recorder; modes: FakeMode[]; } {
  const modes = options.modes ?? [
    new FakeMode("paint"),
    new FakeMode("select", "grab")
  ];
  const recorder: Recorder = {
    pan: [],
    zoom: [],
    cursor: []
  };

  const viewport = {
    applyPan: (dx: number, dy: number) => recorder.pan.push([dx, dy]),
    applyZoom: (delta: number, mx: number, my: number) => recorder.zoom.push([delta, mx, my])
  } as unknown as Viewport;

  const router = new InteractionRouter({
    modes,
    defaultMode: options.defaultMode ?? "paint",
    viewport,
    setCursor: (cursor) => recorder.cursor.push(cursor),
    onUndo: () => false,
    onRedo: () => false,
    onCopy: () => false,
    onPaste: () => false
  });

  return {
    router,
    recorder,
    modes
  };
}
