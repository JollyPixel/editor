// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import {
  startPointerDragSession,
  type PointerDragResult,
  type PointerDragSessionHandle
} from "@jolly-pixel/ui";

// CONSTANTS
const kDragThreshold = 4;
const kAutoScrollMargin = 24;
const kAutoScrollStep = 10;

export interface BlockMoveDetail {
  id: number;
  toIndex: number;
}

export interface ReorderableBlock {
  readonly id: number;
}

export interface ClientPoint {
  clientX: number;
  clientY: number;
}

export interface BlockReorderOptions<TBlock extends ReorderableBlock> {
  scroller(): HTMLElement;
  blocks(): readonly TBlock[];
  blockAt(clientX: number, clientY: number): number | null;
  cellOrigin(index: number): ClientPoint | null;
  landingIndexAt(clientX: number, clientY: number): number | null;
  onMove(detail: BlockMoveDetail): void;
}

export interface BlockDrag {
  readonly blockId: number;
  readonly fromIndex: number;
  readonly grab: ClientPoint;
  readonly pointer: ClientPoint;
  readonly landing: number;
}

interface Arrangement<TBlock> {
  readonly source: readonly TBlock[];
  readonly fromIndex: number;
  readonly landing: number;
  readonly blocks: readonly TBlock[];
}

export class BlockReorderController<
  TBlock extends ReorderableBlock
> implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #options: BlockReorderOptions<TBlock>;
  #session: PointerDragSessionHandle | null = null;
  #drag: BlockDrag | null = null;
  #arrangement: Arrangement<TBlock> | null = null;
  #suppressClick = false;

  constructor(
    host: ReactiveControllerHost,
    options: BlockReorderOptions<TBlock>
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  get dragging(): boolean {
    return this.#drag !== null;
  }

  get drag(): BlockDrag | null {
    return this.#drag;
  }

  get arranged(): readonly TBlock[] {
    const source = this.#options.blocks();
    const drag = this.#drag;
    if (drag === null || drag.landing === drag.fromIndex) {
      return source;
    }

    const cached = this.#arrangement;
    if (
      cached?.source === source &&
      cached.fromIndex === drag.fromIndex &&
      cached.landing === drag.landing
    ) {
      return cached.blocks;
    }

    const blocks = source.slice();
    const [lifted] = blocks.splice(drag.fromIndex, 1);
    blocks.splice(drag.landing, 0, lifted);
    this.#arrangement = {
      source,
      fromIndex: drag.fromIndex,
      landing: drag.landing,
      blocks
    };

    return blocks;
  }

  begin(
    event: PointerEvent
  ): void {
    if (event.button !== 0 || this.#session !== null) {
      return;
    }

    const blocks = this.#options.blocks();
    const blockId = this.#options.blockAt(event.clientX, event.clientY);
    if (blockId === null || blocks.length < 2) {
      return;
    }

    const fromIndex = blocks.findIndex((block) => block.id === blockId);
    const cell = fromIndex === -1 ? null : this.#options.cellOrigin(fromIndex);
    if (cell === null) {
      return;
    }

    const lifted = {
      blockId,
      fromIndex,
      grab: {
        clientX: event.clientX - cell.clientX,
        clientY: event.clientY - cell.clientY
      }
    };
    const scroller = this.#options.scroller();
    this.#session = startPointerDragSession({
      element: scroller,
      event,
      threshold: kDragThreshold,
      onMove: (clientX, clientY, moveEvent) => {
        moveEvent.preventDefault();
        autoScroll(scroller, clientY);
        this.#drag = {
          ...lifted,
          pointer: {
            clientX,
            clientY
          },
          landing: this.#options.landingIndexAt(clientX, clientY) ??
            this.#drag?.landing ??
            fromIndex
        };
        this.#host.requestUpdate();
      },
      onFinish: (result, started) => this.#finish(result, started)
    });
  }

  consumeClick(): boolean {
    const suppressed = this.#suppressClick;
    this.#suppressClick = false;

    return suppressed;
  }

  hostDisconnected(): void {
    this.#session?.cancel();
  }

  #finish(
    result: PointerDragResult,
    started: boolean
  ): void {
    const drag = this.#drag;
    this.#session = null;
    this.#drag = null;
    this.#arrangement = null;
    this.#suppressClick = started && result === "commit";
    this.#host.requestUpdate();

    if (
      !this.#suppressClick ||
      drag === null ||
      drag.landing === drag.fromIndex
    ) {
      return;
    }

    this.#options.onMove({
      id: drag.blockId,
      toIndex: drag.landing
    });
  }
}

function autoScroll(
  scroller: HTMLElement,
  clientY: number
): void {
  const bounds = scroller.getBoundingClientRect();
  if (clientY < bounds.top + kAutoScrollMargin) {
    scroller.scrollTop -= kAutoScrollStep;
  }
  else if (clientY > bounds.bottom - kAutoScrollMargin) {
    scroller.scrollTop += kAutoScrollStep;
  }
}
