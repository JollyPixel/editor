// Import Internal Dependencies
import { InteractionRouter } from "#src/input/InteractionRouter.ts";
import { InteractionMode } from "#src/input/modes/InteractionMode.ts";
import type { PointerPosition } from "#src/input/InputActions.ts";
import type { BrushColorSlot } from "#src/tools/Brush.ts";
import type {
  Mode,
  RotationDirection,
  Vec2
} from "#src/types.ts";

export interface FakeModeOptions {
  cursor?: string;
  writesPixels?: boolean;
  pansOnPrimary?: boolean;
}

export class FakeMode extends InteractionMode {
  readonly id: Mode;
  readonly writesPixels: boolean;
  readonly pansOnPrimary: boolean;
  readonly calls: string[] = [];
  #cursor: string;

  constructor(
    id: Mode,
    options: FakeModeOptions = {}
  ) {
    super();
    this.id = id;
    this.#cursor = options.cursor ?? "";
    this.writesPixels = options.writesPixels ?? false;
    this.pansOnPrimary = options.pansOnPrimary ?? false;
  }

  onExit(): void {
    this.calls.push("exit");
  }

  cursor(): string {
    return this.#cursor;
  }

  onPointerDown(
    slot: BrushColorSlot,
    position: PointerPosition,
    ctrlKey: boolean
  ): boolean {
    const { texture, canvas } = position;
    this.calls.push(
      `down:${slot}:${texture.x},${texture.y}@${canvas.x},${canvas.y}${ctrlKey ? ":ctrl" : ""}`
    );

    return true;
  }

  onPointerMove(
    slot: BrushColorSlot,
    position: PointerPosition
  ): void {
    const { texture, canvas } = position;
    this.calls.push(`move:${slot}:${texture.x},${texture.y}@${canvas.x},${canvas.y}`);
  }

  onPointerUp(
    slot: BrushColorSlot
  ): void {
    this.calls.push(`up:${slot}`);
  }

  onHover(
    position: Vec2 | null
  ): void {
    this.calls.push(position ? `hover:${position.x},${position.y}` : "hover:none");
  }

  onCursorMove(
    position: Vec2 | null
  ): void {
    this.calls.push(position ? `cursor:${position.x},${position.y}` : "cursor:none");
  }

  onCtrlWheel(
    delta: number
  ): boolean {
    this.calls.push(`ctrl-wheel:${delta}`);

    return true;
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
  cursor: string[];
  modeChanges: [Mode, Mode][];
}

export function pointerAt(
  texture: Vec2,
  canvas: Vec2 = texture
): PointerPosition {
  return {
    canvas,
    texture,
    boundedTexture: texture
  };
}

export function makeRouter(
  options: {
    modes?: FakeMode[];
    defaultMode?: Mode;
  } = {}
): { router: InteractionRouter; recorder: Recorder; modes: FakeMode[]; } {
  const modes = options.modes ?? [
    new FakeMode("paint"),
    new FakeMode("select", { cursor: "grab" })
  ];
  const recorder: Recorder = {
    cursor: [],
    modeChanges: []
  };

  const router = new InteractionRouter({
    modes,
    defaultMode: options.defaultMode ?? "paint",
    setCursor: (cursor) => recorder.cursor.push(cursor),
    onModeChange: (mode, previous) => recorder.modeChanges.push([mode, previous])
  });

  return {
    router,
    recorder,
    modes
  };
}
